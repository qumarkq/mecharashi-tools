/**
 * 鋼嵐工具站 — 機甲(機兵)資料擷取腳本 v3 (API 版)
 *
 * 直接透過官方 WIKI API 取得資料，無需瀏覽器（速度快、穩定）。
 *
 * v3 更新：
 *   - 圖片依機甲分資料夾存放：public/images/mechs/{機甲名}/portrait.png, half.png, torso.png...
 *   - 修正部件圖片 URL（正確路徑為 waparts/，非 mecha/）
 *   - 優化錯誤提示與日誌輸出
 *
 * v2 更新（v1.4）：
 *   - 部件資料獨立存放（每部件含完整屬性 + 圖示）
 *   - 僅使用 manji（滿級）數據
 *   - 偵測到未知模組自動寫入 modules.json（標記為綁定該機甲）
 *   - 模組 ID 自動映射到 modules.json
 *
 * API 發現：
 *   - 機兵在 API 中的 target 名稱是 aircraft_data（不是 mecha_data）
 *   - 列表回傳每隻機兵的「軀幹」部件（共 83 隻）
 *   - 詳情以「機兵名稱」查詢，回傳 4 個部件（軀幹/左臂/右臂/腿部）
 *   - 每個部件有 base 與 manji（滿級）數據
 *   - 部件圖片（mechaIcon）路徑為 waparts/（非 mecha/）
 *
 * 功能：
 *   1. 從官方 API 取得機兵列表 (aircraft_data)
 *   2. 擷取完整資料：裝甲類型、火力、閃避、移動力、部件耐久、模組等
 *   3. 下載機兵圖片到 public/images/mechs/{機甲名}/（分資料夾）
 *   4. 輸出 public/data/mechs.json（繁體中文）
 *   5. 偵測未知模組 → 自動新增至 modules.json
 *
 * 使用方式：
 *   node scripts/scrape-mechs.js                     ← 全量機兵
 *   node scripts/scrape-mechs.js --mech=都卜勒        ← 指定單一機兵（繁體輸入）
 *   node scripts/scrape-mechs.js --no-images          ← 只取文字不下載圖片
 *   node scripts/scrape-mechs.js --force              ← 強制重抓（忽略已有資料）
 *   node scripts/scrape-mechs.js --limit=3            ← 只跑前 N 個
 *   node scripts/scrape-mechs.js --all                ← 含所有品質（預設只抓 S 級）
 *   node scripts/scrape-mechs.js --debug              ← 輸出 debug 資訊
 */

import * as OpenCC from 'opencc-js';
import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── 路徑設定 ──────────────────────────────────────────────────
const API_BASE     = 'https://ma-activity.zlongame.com/common/infodata/mQuery.do';
const APP_KEY      = '1616148215678';
const IMG_BASE     = 'https://media.zlongame.com/media/pictures/cn/community/img/gl/gameInfo';
const OUTPUT_JSON  = path.join(__dirname, '../public/data/mechs.json');
const MODULES_JSON = path.join(__dirname, '../public/data/modules.json');
const MECHS_DIR    = path.join(__dirname, '../public/images/mechs');
const MODULES_DIR  = path.join(__dirname, '../public/images/modules');
const DEBUG_DIR    = path.join(__dirname, '../public/debug');

// ── 命令列參數 ────────────────────────────────────────────────
const args             = process.argv.slice(2);
const DOWNLOAD_IMG     = !args.includes('--no-images');
const FORCE            = args.includes('--force');
const ALL_QUALITY      = args.includes('--all');
const DEBUG            = args.includes('--debug');
const SINGLE_MECH_RAW = (args.find(a => a.startsWith('--mech=')) || '').split('=')[1] || '';
const LIMIT            = (() => {
  const l = args.find(a => a.startsWith('--limit='));
  return l ? parseInt(l.split('=')[1]) : Infinity;
})();

// ════════════════════════════════════════════════════════════
// 中文轉換（OpenCC）
// ════════════════════════════════════════════════════════════
const _s2t = OpenCC.Converter({ from: 'cn', to: 'tw' });
const _t2s = OpenCC.Converter({ from: 'tw', to: 'cn' });

function s2t(text) { return text ? _s2t(text) : text; }
function t2s(text) { return text ? _t2s(text) : text; }

// --mech 繁體輸入 → 簡體比對
const SINGLE_MECH_CN = SINGLE_MECH_RAW ? t2s(SINGLE_MECH_RAW) : '';

// ════════════════════════════════════════════════════════════
// HTTP 工具
// ════════════════════════════════════════════════════════════
function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    mod.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } }, (res) => {
      if (res.statusCode !== 200) { reject(new Error(`HTTP ${res.statusCode} for ${url}`)); return; }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch (e) { reject(e); } });
    }).on('error', reject);
  });
}

function downloadImage(url, dest, depth = 0) {
  return new Promise((resolve, reject) => {
    if (depth > 5) { reject(new Error('too many redirects')); return; }
    if (fs.existsSync(dest) && !FORCE) { resolve(dest); return; }

    const mod  = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(dest);

    const req = mod.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 15000 }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        fs.unlinkSync(dest);
        const redirectUrl = res.headers.location;
        if (!redirectUrl) { reject(new Error('redirect without location')); return; }
        downloadImage(redirectUrl, dest, depth + 1).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        file.close();
        fs.unlink(dest, () => {});
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(dest); });
    });
    req.on('error', (err) => {
      file.close();
      fs.unlink(dest, () => {});
      reject(err);
    });
    req.on('timeout', () => {
      req.destroy();
      file.close();
      fs.unlink(dest, () => {});
      reject(new Error('timeout'));
    });
  });
}

// ════════════════════════════════════════════════════════════
// API 端點
// ════════════════════════════════════════════════════════════
function apiUrl(target, type, query = '') {
  let url = `${API_BASE}?appkey=${APP_KEY}&target=${target}&type=${type}`;
  if (query) url += `&query=${encodeURIComponent(query)}`;
  return url;
}

async function fetchMechList() {
  const res = await fetchJson(apiUrl('aircraft_data', 'list'));
  // 列表中每個項目都是「軀幹」部件，每隻機兵名稱唯一
  const seen = new Set();
  return (res.data?.data || []).filter(m => {
    if (!m.name || seen.has(m.name)) return false;
    seen.add(m.name);
    return true;
  });
}

async function fetchMechDetail(name) {
  // 用機兵名稱（簡體中文）查詢詳情，回傳 4 個部件
  const res = await fetchJson(apiUrl('aircraft_data', 'detail', name));
  return res.data?.data || [];
}

// ════════════════════════════════════════════════════════════
// 文字清理（移除 <color> / <buf> 標籤）
// ════════════════════════════════════════════════════════════
function cleanRichText(text) {
  if (!text) return '';
  return text
    .replace(/<color=[^>]*>/g, '')
    .replace(/<\/color>/g, '')
    .replace(/<buf[^>]*>\[?/g, '')
    .replace(/\]?<\/buf>/g, '')
    .replace(/<skill[^>]*>\[?/g, '')
    .replace(/\]?<\/skill>/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\\n/g, '\n')
    .trim();
}

// ════════════════════════════════════════════════════════════
// 裝甲類型映射
// ════════════════════════════════════════════════════════════
const ARMOR_MAP = {
  'Heavy':  '重型',
  'Medium': '中甲',
  'Light':  '輕型',
};

// ════════════════════════════════════════════════════════════
// 位置映射（API 簡體 → 英文 key）
// ════════════════════════════════════════════════════════════
const POSITION_MAP = {
  '躯干': 'torso',
  '左臂': 'leftArm',
  '右臂': 'rightArm',
  '腿部': 'legs',
};

// ════════════════════════════════════════════════════════════
// 從單一部件建構部件 JSON（使用 manji 滿級數據）
// ════════════════════════════════════════════════════════════
function buildPartJson(rawPart) {
  if (!rawPart) return null;
  const posKey = POSITION_MAP[rawPart.position];
  if (!posKey) return null;

  // 優先使用 manji 滿級數據
  const src = rawPart.manji || rawPart;

  const part = {
    position: posKey,
    durable:  parseInt(src.durable) || 0,
    armor:    parseInt(src.Armor) || 0,
    firepower: parseInt(src.fire) || 0,
    weight:   parseInt(rawPart.aircraftWeight) || 0,
    interface: s2t(src.Interface || rawPart.Interface || ''),
  };

  // 部位特有屬性
  if (posKey === 'torso') {
    part.output   = parseInt(src.output) || 0;
    part.antiRiot = parseInt(src.Antiriot) || 0;
  }
  if (posKey === 'leftArm' || posKey === 'rightArm') {
    part.hit = parseInt(src.Hit) || 0;
  }
  if (posKey === 'legs') {
    part.dodge = parseInt(src.Dodge) || 0;
    const moveRaw = parseInt(src.move) || 0;
    part.move = moveRaw >= 1000 ? moveRaw / 1000 : moveRaw;
  }

  // 部件圖示（正確路徑：waparts/）
  const iconKey = rawPart.mechaIcon || '';
  if (iconKey) {
    part.mechaIcon = iconKey;
    part._iconUrl = `${IMG_BASE}/waparts/${iconKey}.png`;
  }

  return part;
}

// ════════════════════════════════════════════════════════════
// 從軀幹的 ModuleCarried 解析模組，偵測未知模組 → 自動新增
// ════════════════════════════════════════════════════════════
function extractAndSyncModules(torso, mechId, mechNameTW, rarity, modulesMap) {
  // 優先使用 manji（滿級）的 ModuleCarried
  let rawModules = torso.manji?.ModuleCarried;
  if (!Array.isArray(rawModules)) rawModules = torso.ModuleCarried;
  if (!Array.isArray(rawModules)) return { module4Id: '', module8Id: '', moduleFixedIds: [] };

  const sorted = [...rawModules].sort((a, b) => (a.level || 0) - (b.level || 0));
  const mod8 = sorted.find(m => m.level === 8);
  const mod4 = sorted.find(m => m.level === 4);
  const fixed = sorted.filter(m => m !== mod4 && m !== mod8);

  let newModulesAdded = 0;

  function ensureModule(m, slot) {
    if (!m) return '';
    const modId = `mod_${mechNameTW}_${slot}`;
    const iconKey = m.icon || m.SkillIcon || '';

    // 檢查 modules.json 是否已有此模組
    if (!modulesMap.has(modId)) {
      // 新模組 → 視為綁定該機甲，自動新增
      const newModule = {
        id: modId,
        name: s2t(m.name || ''),
        slot,
        boundMechId: mechId,
        boundPart: null,
        dmg: 0,
        crit: 0,
        critDmg: 0,
        acc: 0,
        description: s2t(cleanRichText(m.SpecificEffects || '')),
        rarity,
        icon: iconKey ? `/images/modules/${iconKey}.png` : '',
        source: 'auto',
      };
      modulesMap.set(modId, newModule);
      newModulesAdded++;

      // 下載模組圖示
      if (DOWNLOAD_IMG && iconKey) {
        const iconUrl = `${IMG_BASE}/skill/${iconKey}.png`;
        const dest = path.join(MODULES_DIR, `${iconKey}.png`);
        downloadImage(iconUrl, dest).catch(() => {}); // 靜默忽略
      }
    } else {
      // 已存在：更新描述（若原本為空）
      const existing = modulesMap.get(modId);
      if (!existing.description && m.SpecificEffects) {
        existing.description = s2t(cleanRichText(m.SpecificEffects));
      }
      if (!existing.name && m.name) {
        existing.name = s2t(m.name);
      }
    }

    return modId;
  }

  const module4Id = ensureModule(mod4, '4mod');
  const module8Id = ensureModule(mod8, '8mod');

  const moduleFixedIds = [];
  if (fixed.length === 1) {
    moduleFixedIds.push(ensureModule(fixed[0], 'fixed'));
  } else {
    fixed.forEach((m, idx) => {
      moduleFixedIds.push(ensureModule(m, `fixed_${idx + 1}`));
    });
  }

  if (newModulesAdded > 0) {
    process.stdout.write(` [+${newModulesAdded} 新模組]`);
  }

  return { module4Id, module8Id, moduleFixedIds };
}

// ════════════════════════════════════════════════════════════
// 從 4 個部件組裝機甲 JSON（v2：含完整部件資料）
// ════════════════════════════════════════════════════════════
function buildMechJson(parts, index, modulesMap) {
  const torso    = parts.find(p => p.position === '躯干');
  const leftArm  = parts.find(p => p.position === '左臂');
  const rightArm = parts.find(p => p.position === '右臂');
  const legs     = parts.find(p => p.position === '腿部');

  if (!torso) throw new Error('缺少軀幹資料');

  const nameTW = s2t(torso.name || '');
  const safeName = nameTW.replace(/[^一-龥a-zA-Z0-9\u3000-\u303f\uff00-\uffef\-]/g, '');
  const id = `mech_${String(index + 1).padStart(3, '0')}_${safeName}`;

  // 裝甲類型
  const armorType = ARMOR_MAP[torso.type] || s2t(torso.type) || '中甲';

  // 使用 manji（滿級）數據
  const t  = torso.manji || torso;
  const lg = legs?.manji || legs;

  // 機甲總覽屬性
  const firepower = parseInt(t?.fire) || 0;
  const armor     = parseInt(t?.Armor) || 0;
  const evasion   = parseInt(lg?.Dodge) || 0;
  const moveRaw   = parseInt(lg?.move) || 0;
  const mobility  = moveRaw >= 1000 ? moveRaw / 1000 : moveRaw;
  const output    = parseInt(t?.output) || 0;

  // 總重量 = 各部件重量之和
  const weight = [torso, leftArm, rightArm, legs]
    .reduce((sum, p) => sum + (parseInt(p?.aircraftWeight) || 0), 0);

  // 建構各部件詳細資料
  const partsData = {
    torso:    buildPartJson(torso),
    leftArm:  buildPartJson(leftArm),
    rightArm: buildPartJson(rightArm),
    legs:     buildPartJson(legs),
  };

  // 模組映射（自動偵測未知模組並新增）
  const { module4Id, module8Id, moduleFixedIds } = extractAndSyncModules(
    torso, id, nameTW, torso.quality || 'SSR', modulesMap
  );

  // 圖片（分資料夾存放）
  const iconKey = torso.icon || '';
  const portraitUrl = iconKey ? `${IMG_BASE}/mecha/${iconKey}.png` : '';
  const lihuiUrl = torso.lihuiIcon ? `${IMG_BASE}/mechaHalf/${torso.lihuiIcon}.png` : '';

  // 為各部件設定本地圖片路徑
  const partFileMap = { torso: 'torso.png', leftArm: 'leftArm.png', rightArm: 'rightArm.png', legs: 'legs.png' };
  for (const [key, fileName] of Object.entries(partFileMap)) {
    if (partsData[key]?.mechaIcon) {
      partsData[key].icon = `/images/mechs/${safeName}/${fileName}`;
    }
  }

  return {
    id,
    name:       nameTW,
    armorType,
    firepower,
    armor,
    evasion,
    mobility,
    weight,
    output,
    parts:      partsData,
    module4Id,
    module8Id,
    moduleFixedIds,
    portrait:    `/images/mechs/${safeName}/portrait.png`,
    halfPortrait: lihuiUrl ? `/images/mechs/${safeName}/half.png` : '',
    portraitUrl,
    lihuiUrl,
    quality:     torso.quality || '',
    lore:        s2t(cleanRichText(torso.introduce || '')),
  };
}

// ════════════════════════════════════════════════════════════
// 圖片下載（分資料夾存放）
// ════════════════════════════════════════════════════════════
const PART_FILE_MAP = {
  torso:    'torso.png',
  leftArm:  'leftArm.png',
  rightArm: 'rightArm.png',
  legs:     'legs.png',
};

async function downloadMechImages(mech) {
  if (!DOWNLOAD_IMG) return;

  const safeName = mech.name.replace(/[^一-龥a-zA-Z0-9\u3000-\u303f\uff00-\uffef\-]/g, '');
  const mechDir = path.join(MECHS_DIR, safeName);
  fs.mkdirSync(mechDir, { recursive: true });

  let downloaded = 0;
  let failed = 0;

  // 下載機甲圖示（portrait）
  if (mech.portraitUrl) {
    const dest = path.join(mechDir, 'portrait.png');
    try {
      await downloadImage(mech.portraitUrl, dest);
      downloaded++;
    } catch (e) {
      failed++;
      if (DEBUG) process.stdout.write(` [圖示失敗: ${e.message}]`);
    }
  }

  // 下載立繪（half）
  if (mech.lihuiUrl) {
    const dest = path.join(mechDir, 'half.png');
    try {
      await downloadImage(mech.lihuiUrl, dest);
      downloaded++;
    } catch (e) {
      failed++;
      if (DEBUG) process.stdout.write(` [立繪失敗: ${e.message}]`);
    }
  }

  // 下載各部件圖示（waparts/）
  for (const [partKey, fileName] of Object.entries(PART_FILE_MAP)) {
    const part = mech.parts?.[partKey];
    if (part?._iconUrl) {
      const dest = path.join(mechDir, fileName);
      try {
        await downloadImage(part._iconUrl, dest);
        downloaded++;
      } catch (e) {
        failed++;
        if (DEBUG) process.stdout.write(` [${partKey}失敗: ${e.message}]`);
      }
    }
  }

  if (downloaded > 0 || failed > 0) {
    process.stdout.write(` [圖:${downloaded}✓${failed > 0 ? ` ${failed}✗` : ''}]`);
  }
}

// ════════════════════════════════════════════════════════════
// 主流程
// ════════════════════════════════════════════════════════════
async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║  鋼嵐工具站 — 機兵擷取腳本 v3 (API 版)       ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log(`  圖片: ${DOWNLOAD_IMG ? '✓' : '✗'}  強制: ${FORCE ? '✓' : '✗'}  全品質: ${ALL_QUALITY ? '✓' : '✗'}  Debug: ${DEBUG ? '✓' : '✗'}`);
  if (SINGLE_MECH_RAW) console.log(`  指定機兵: ${SINGLE_MECH_RAW}（簡體: ${SINGLE_MECH_CN}）`);
  if (isFinite(LIMIT))  console.log(`  數量限制: ${LIMIT}`);
  console.log('');

  // 建立輸出目錄
  if (DOWNLOAD_IMG) {
    fs.mkdirSync(MECHS_DIR, { recursive: true });
    fs.mkdirSync(MODULES_DIR, { recursive: true });
  }
  if (DEBUG) fs.mkdirSync(DEBUG_DIR, { recursive: true });

  // ── 載入已有機甲資料 ──
  let existingMechs = new Map();
  if (!FORCE && fs.existsSync(OUTPUT_JSON)) {
    try {
      const arr = JSON.parse(fs.readFileSync(OUTPUT_JSON, 'utf-8'));
      for (const m of arr) {
        existingMechs.set(t2s(m.name), m);
      }
      console.log(`📦 已有 ${arr.length} 個機兵資料`);
    } catch {}
  }

  // ── 載入已有模組資料 ──
  const modulesMap = new Map();
  if (fs.existsSync(MODULES_JSON)) {
    try {
      const arr = JSON.parse(fs.readFileSync(MODULES_JSON, 'utf-8'));
      for (const m of arr) modulesMap.set(m.id, m);
      console.log(`📦 已有 ${arr.length} 個模組資料`);
    } catch {}
  }
  const modulesCountBefore = modulesMap.size;

  // ── 取得機兵列表 ──
  console.log('📋 正在取得機兵列表 (target: aircraft_data)...');
  let allMechs;
  try {
    allMechs = await fetchMechList();
  } catch (err) {
    console.log(`  ⚠ API 請求失敗: ${err.message}`);
    allMechs = [];
  }
  console.log(`  → 總共 ${allMechs.length} 個機兵`);

  if (allMechs.length === 0) {
    console.log('  ⚠ 沒有取到任何機兵資料。');
    return;
  }

  // Debug: 保存原始列表
  if (DEBUG) {
    const debugPath = path.join(DEBUG_DIR, 'aircraft_list_raw.json');
    fs.writeFileSync(debugPath, JSON.stringify(allMechs, null, 2), 'utf-8');
    console.log(`  📁 原始列表已存: ${debugPath}`);
  }

  // ── 篩選目標 ──
  let targets;
  if (SINGLE_MECH_CN) {
    targets = allMechs.filter(m => m.name === SINGLE_MECH_CN);
    if (targets.length === 0) {
      targets = allMechs.filter(m => (m.name || '').includes(SINGLE_MECH_CN));
    }
    if (targets.length === 0) {
      console.log(`  ⚠ 找不到「${SINGLE_MECH_RAW}」(${SINGLE_MECH_CN})，可用機兵列表：`);
      console.log('  ' + allMechs.map(m => s2t(m.name)).join('、'));
      process.exit(1);
    }
  } else if (ALL_QUALITY) {
    targets = allMechs;
  } else {
    const ssrMechs = allMechs.filter(m => m.quality === 'SSR');
    if (ssrMechs.length > 0) {
      targets = ssrMechs;
      console.log(`  → S 級 (SSR): ${targets.length} 個`);
    } else {
      targets = allMechs;
    }
  }

  // ── 比對已有，決定要跑哪些 ──
  const toDo = FORCE
    ? targets
    : targets.filter(m => !existingMechs.has(m.name));
  const toSkip = targets.length - toDo.length;

  if (toSkip > 0) console.log(`  → 跳過已有: ${toSkip} 個`);

  const finalTargets = toDo.slice(0, LIMIT);
  console.log(`  → 本次擷取: ${finalTargets.length} 個`);
  console.log('');

  // ── 逐一擷取 ──
  const results = new Map(existingMechs);
  let newCount = 0;

  for (let i = 0; i < finalTargets.length; i++) {
    const mech = finalTargets[i];
    const nameTW = s2t(mech.name);
    process.stdout.write(`  [${i + 1}/${finalTargets.length}] ⏳ ${nameTW}...`);

    try {
      const parts = await fetchMechDetail(mech.name);

      if (parts.length === 0) {
        process.stdout.write(` ✗ 詳情為空\n`);
        continue;
      }

      if (DEBUG && i === 0) {
        const debugPath = path.join(DEBUG_DIR, 'aircraft_detail_sample.json');
        fs.writeFileSync(debugPath, JSON.stringify(parts, null, 2), 'utf-8');
      }

      const currentIndex = existingMechs.size + newCount;
      const mechJson = buildMechJson(parts, currentIndex, modulesMap);

      // 下載圖片
      await downloadMechImages(mechJson);

      results.set(mech.name, mechJson);
      newCount++;

      process.stdout.write(` ✓ [${mechJson.armorType}] 火力:${mechJson.firepower} 閃避:${mechJson.evasion}\n`);
    } catch (err) {
      process.stdout.write(` ✗ ${err.message}\n`);
    }

    // 禮貌延遲
    if (i < finalTargets.length - 1) {
      await new Promise(r => setTimeout(r, 300));
    }
  }

  // ── 輸出 mechs.json ──
  const mechArray = Array.from(results.values()).map(m => {
    const { portraitUrl, lihuiUrl, ...rest } = m;
    // 清理部件的 _iconUrl 內部欄位
    if (rest.parts) {
      for (const key of ['torso', 'leftArm', 'rightArm', 'legs']) {
        if (rest.parts[key]?._iconUrl) {
          delete rest.parts[key]._iconUrl;
        }
      }
    }
    return rest;
  });
  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(mechArray, null, 2), 'utf-8');

  // ── 輸出 modules.json（保留已有手動數值）──
  const modulesArray = Array.from(modulesMap.values());
  fs.writeFileSync(MODULES_JSON, JSON.stringify(modulesArray, null, 2), 'utf-8');
  const newModules = modulesMap.size - modulesCountBefore;

  console.log('');
  console.log('═══════════════════════════════════════════');
  console.log(`✅ 完成！`);
  console.log(`   本次新增機兵: ${newCount} 個`);
  console.log(`   機兵合計:     ${mechArray.length} 個`);
  console.log(`   模組合計:     ${modulesArray.length} 個 (新增 ${newModules} 個)`);
  console.log(`   📁 ${OUTPUT_JSON}`);
  console.log(`   📁 ${MODULES_JSON}`);
  if (DOWNLOAD_IMG) {
    console.log(`   📁 ${MECHS_DIR}/{機甲名}/portrait.png, half.png, torso.png, leftArm.png, rightArm.png, legs.png`);
    console.log(`   📁 ${MODULES_DIR}`);
  }
}

main().catch(err => {
  console.error('\n❌ 腳本執行失敗：', err.message);
  console.error(err.stack);
  process.exit(1);
});

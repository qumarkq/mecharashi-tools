/**
 * 鋼嵐工具站 — 機甲(機兵)資料擷取腳本 v1 (API 版)
 *
 * 直接透過官方 WIKI API 取得資料，無需瀏覽器（速度快、穩定）。
 * 參考 scrape-pilots-v3.js 的行為模式。
 *
 * API 發現：
 *   - 機兵在 API 中的 target 名稱是 aircraft_data（不是 mecha_data）
 *   - 列表回傳每隻機兵的「軀幹」部件（共 83 隻）
 *   - 詳情以「機兵名稱」查詢，回傳 4 個部件（軀幹/左臂/右臂/腿部）
 *   - 每個部件有 base 與 manji（滿級）數據
 *
 * 功能：
 *   1. 從官方 API 取得機兵列表 (aircraft_data)
 *   2. 擷取完整資料：裝甲類型、火力、閃避、移動力、部件耐久、模組等
 *   3. 下載機兵圖片到 public/images/mechs/（繁體中文檔名）
 *   4. 輸出 public/data/mechs.json（繁體中文）
 *
 * 使用方式：
 *   node scripts/scrape-mechs.js                     ← 全量機兵
 *   node scripts/scrape-mechs.js --mech=都卜勒        ← 指定單一機兵（繁體輸入）
 *   node scripts/scrape-mechs.js --no-images          ← 只取文字不下載圖片
 *   node scripts/scrape-mechs.js --force              ← 強制重抓（忽略已有資料）
 *   node scripts/scrape-mechs.js --limit=3            ← 只跑前 N 個
 *   node scripts/scrape-mechs.js --all                ← 含所有品質（預設只抓 S 級）
 *   node scripts/scrape-mechs.js --debug              ← 輸出 debug 資訊
 *   node scripts/scrape-mechs.js --base               ← 使用 base 數據（預設 manji 滿級）
 */

import * as OpenCC from 'opencc-js';
import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── 路徑設定 ──────────────────────────────────────────────────
const API_BASE    = 'https://ma-activity.zlongame.com/common/infodata/mQuery.do';
const APP_KEY     = '1616148215678';
const IMG_BASE    = 'https://media.zlongame.com/media/pictures/cn/community/img/gl/gameInfo';
const OUTPUT_JSON = path.join(__dirname, '../public/data/mechs.json');
const MECHS_DIR   = path.join(__dirname, '../public/images/mechs');
const DEBUG_DIR   = path.join(__dirname, '../public/debug');

// ── 命令列參數 ────────────────────────────────────────────────
const args             = process.argv.slice(2);
const DOWNLOAD_IMG     = !args.includes('--no-images');
const FORCE            = args.includes('--force');
const ALL_QUALITY      = args.includes('--all');
const DEBUG            = args.includes('--debug');
const USE_BASE         = args.includes('--base');
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
    if (fs.existsSync(dest)) { resolve(dest); return; }

    const mod  = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(dest);

    mod.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        fs.unlinkSync(dest);
        downloadImage(res.headers.location, dest, depth + 1).then(resolve).catch(reject);
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
    }).on('error', (err) => {
      file.close();
      fs.unlink(dest, () => {});
      reject(err);
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
// 從 4 個部件組裝機甲 JSON
// ════════════════════════════════════════════════════════════
function buildMechJson(parts, index) {
  // 按 position 分類
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

  // 決定使用 base 或 manji（滿級）數據
  const src = (part) => (!USE_BASE && part?.manji) ? part.manji : part;

  const t = src(torso);
  const la = src(leftArm);
  const ra = src(rightArm);
  const lg = src(legs);

  // 基本屬性
  const firepower = parseInt(t?.fire) || 0;
  const armor     = parseInt(t?.Armor) || 0;
  const evasion   = parseInt(lg?.Dodge) || 0;
  const moveRaw   = parseInt(lg?.move) || 0;
  const mobility  = moveRaw >= 1000 ? moveRaw / 1000 : moveRaw; // 4000 → 4
  const output    = parseInt(t?.output) || 0;

  // 總重量 = 各部件重量之和
  const weight = [torso, leftArm, rightArm, legs]
    .reduce((sum, p) => sum + (parseInt(p?.aircraftWeight) || 0), 0);

  // 部件耐久（使用對應 src 的 durable）
  const mechParts = {
    torso:    parseInt(t?.durable) || 0,
    leftArm:  parseInt(la?.durable) || 0,
    rightArm: parseInt(ra?.durable) || 0,
    legs:     parseInt(lg?.durable) || 0,
  };

  // 模組效果
  const { module4, module8, moduleFixed } = buildModules(torso);

  // 圖片
  const iconKey = torso.icon || '';
  const portraitUrl = iconKey ? `${IMG_BASE}/mecha/${iconKey}.png` : '';
  const lihuiUrl = torso.lihuiIcon ? `${IMG_BASE}/mechaHalf/${torso.lihuiIcon}.png` : '';

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
    parts:      mechParts,
    module4,
    module8,
    moduleFixed,
    portrait:    `/images/mechs/${safeName}.png`,
    portraitUrl,
    lihuiUrl,
    quality:     torso.quality || '',
    lore:        s2t(cleanRichText(torso.introduce || '')),
  };
}

/**
 * 從軀幹的 ModuleCarried（base 與 manji）組裝 module4 / module8 / moduleFixed
 *
 * 邏輯：
 *   - base  ModuleCarried 是初始模組（level 通常為 2 或 4）
 *   - manji ModuleCarried 是滿級模組（level 通常升到 4 或 8）
 *   - 找 manji 中 level=4 的模組作為 module4
 *   - 找 manji 中 level=8 的模組作為 module8
 *   - 其他模組歸入 moduleFixed
 */
function buildModules(torso) {
  const emptyModule = { name: '', dmg: 0, crit: 0, critDmg: 0, acc: 0, description: '' };

  // 優先用 manji 的 ModuleCarried（滿級模組資訊最完整）
  let modules = torso.manji?.ModuleCarried;
  if (!Array.isArray(modules)) {
    modules = torso.ModuleCarried;
  }
  if (!Array.isArray(modules)) {
    return { module4: { ...emptyModule }, module8: { ...emptyModule }, moduleFixed: { ...emptyModule } };
  }

  // 按 level 排序
  const sorted = [...modules].sort((a, b) => (a.level || 0) - (b.level || 0));

  // level=8 的模組 → module8
  const mod8 = sorted.find(m => m.level === 8);
  // level=4 的模組 → module4
  const mod4 = sorted.find(m => m.level === 4);
  // 剩餘的 → moduleFixed（取第一個）
  const fixedCandidates = sorted.filter(m => m !== mod4 && m !== mod8);
  const modFixed = fixedCandidates[0];

  function toModule(m) {
    if (!m) return { ...emptyModule };
    return {
      name:        s2t(m.name || ''),
      dmg:         0,
      crit:        0,
      critDmg:     0,
      acc:         0,
      description: s2t(cleanRichText(m.SpecificEffects || '')),
    };
  }

  return {
    module4:     toModule(mod4),
    module8:     toModule(mod8),
    moduleFixed: toModule(modFixed),
  };
}

// ════════════════════════════════════════════════════════════
// 圖片下載
// ════════════════════════════════════════════════════════════
async function downloadMechImages(mech) {
  if (!DOWNLOAD_IMG) return;

  const safeName = mech.name.replace(/[^一-龥a-zA-Z0-9\u3000-\u303f\uff00-\uffef\-]/g, '');

  // 下載機甲圖示
  if (mech.portraitUrl) {
    const dest = path.join(MECHS_DIR, `${safeName}.png`);
    try {
      await downloadImage(mech.portraitUrl, dest);
      console.log(`    📷 圖示: ${safeName}.png`);
    } catch (e) {
      console.log(`    ⚠ 圖示下載失敗: ${e.message}`);
    }
  }

  // 下載立繪
  if (mech.lihuiUrl) {
    const dest = path.join(MECHS_DIR, `${safeName}_half.png`);
    try {
      await downloadImage(mech.lihuiUrl, dest);
      console.log(`    📷 立繪: ${safeName}_half.png`);
    } catch (e) {
      console.log(`    ⚠ 立繪下載失敗: ${e.message}`);
    }
  }
}

// ════════════════════════════════════════════════════════════
// 主流程
// ════════════════════════════════════════════════════════════
async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║  鋼嵐工具站 — 機兵擷取腳本 v1 (API 版)       ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log(`  圖片: ${DOWNLOAD_IMG ? '✓' : '✗'}  強制: ${FORCE ? '✓' : '✗'}  全品質: ${ALL_QUALITY ? '✓' : '✗'}  數值: ${USE_BASE ? 'base' : 'manji(滿級)'}  Debug: ${DEBUG ? '✓' : '✗'}`);
  if (SINGLE_MECH_RAW) console.log(`  指定機兵: ${SINGLE_MECH_RAW}（簡體: ${SINGLE_MECH_CN}）`);
  if (isFinite(LIMIT))  console.log(`  數量限制: ${LIMIT}`);
  console.log('');

  // 建立輸出目錄
  if (DOWNLOAD_IMG) fs.mkdirSync(MECHS_DIR, { recursive: true });
  if (DEBUG) fs.mkdirSync(DEBUG_DIR, { recursive: true });

  // ── 載入已有資料 ──
  let existingMechs = new Map(); // key: 簡體名 → value: mech json
  if (!FORCE && fs.existsSync(OUTPUT_JSON)) {
    try {
      const arr = JSON.parse(fs.readFileSync(OUTPUT_JSON, 'utf-8'));
      for (const m of arr) {
        existingMechs.set(t2s(m.name), m);
      }
      console.log(`📦 已有 ${arr.length} 個機兵資料`);
    } catch {}
  }

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
    // 精確 → 模糊比對
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
    // 預設只抓 SSR (S 級)
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
        console.log(`\n    📁 Detail 範例已存: ${debugPath}`);
      }

      const currentIndex = existingMechs.size + newCount;
      const mechJson = buildMechJson(parts, currentIndex);

      // 下載圖片
      await downloadMechImages(mechJson);

      results.set(mech.name, mechJson);
      newCount++;

      process.stdout.write(` ✓ [${mechJson.armorType}] 火力:${mechJson.firepower} 閃避:${mechJson.evasion} 移動:${mechJson.mobility}\n`);
    } catch (err) {
      process.stdout.write(` ✗ ${err.message}\n`);
    }

    // 禮貌延遲（避免被限速）
    if (i < finalTargets.length - 1) {
      await new Promise(r => setTimeout(r, 300));
    }
  }

  // ── 輸出 JSON ──
  // 從結果 Map 中取出，移除內部欄位 (portraitUrl, lihuiUrl)
  const mechArray = Array.from(results.values()).map(m => {
    const { portraitUrl, lihuiUrl, ...rest } = m;
    return rest;
  });
  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(mechArray, null, 2), 'utf-8');

  console.log('');
  console.log('═══════════════════════════════════════════');
  console.log(`✅ 完成！`);
  console.log(`   本次新增: ${newCount} 個機兵`);
  console.log(`   合計:     ${mechArray.length} 個機兵`);
  console.log(`   📁 ${OUTPUT_JSON}`);
  if (DOWNLOAD_IMG) {
    console.log(`   📁 ${MECHS_DIR}`);
  }
}

main().catch(err => {
  console.error('\n❌ 腳本執行失敗：', err.message);
  console.error(err.stack);
  process.exit(1);
});

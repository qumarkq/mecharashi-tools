/**
 * 鋼嵐工具站 — 模組資料擷取腳本 v2 (API 版)
 *
 * 透過機甲 API 擷取模組資料，下載模組圖示，更新 modules.json。
 * 模組圖示路徑：${IMG_BASE}/skill/${icon}.png（已驗證可用）
 *
 * v2 更新（v1.4）：
 *   - 新增 boundPart 欄位（綁定部位，預設 null）
 *   - 新增 source 欄位："auto" 表腳本自動擷取
 *   - 偵測到未知模組自動新增，標記為綁定該機甲
 *
 * 使用方式：
 *   node scripts/scrape-modules.js                   ← 全量更新（SSR 機甲）
 *   node scripts/scrape-modules.js --mech=都卜勒      ← 指定單一機甲的模組
 *   node scripts/scrape-modules.js --no-images        ← 只更新文字，不下載圖示
 *   node scripts/scrape-modules.js --force            ← 強制重抓（含已有圖片）
 *   node scripts/scrape-modules.js --all              ← 含所有品質（非僅 SSR）
 *   node scripts/scrape-modules.js --debug            ← 輸出 debug 資訊
 *   node scripts/scrape-modules.js --limit=5          ← 只跑前 N 台機甲
 */

import * as OpenCC from 'opencc-js';
import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── 路徑設定 ────────────────────────────────────────────────────────────────
const API_BASE     = 'https://ma-activity.zlongame.com/common/infodata/mQuery.do';
const APP_KEY      = '1616148215678';
const IMG_BASE     = 'https://media.zlongame.com/media/pictures/cn/community/img/gl/gameInfo';
const OUTPUT_JSON  = path.join(__dirname, '../public/data/modules.json');
const MECHS_JSON   = path.join(__dirname, '../public/data/mechs.json');
const MODULES_DIR  = path.join(__dirname, '../public/images/modules');
const DEBUG_DIR    = path.join(__dirname, '../public/debug');

// ── 命令列參數 ───────────────────────────────────────────────────────────────
const args            = process.argv.slice(2);
const DOWNLOAD_IMG    = !args.includes('--no-images');
const FORCE           = args.includes('--force');
const ALL_QUALITY     = args.includes('--all');
const DEBUG           = args.includes('--debug');
const SINGLE_MECH_RAW = (args.find(a => a.startsWith('--mech=')) || '').split('=')[1] || '';
const LIMIT = (() => {
  const l = args.find(a => a.startsWith('--limit='));
  return l ? parseInt(l.split('=')[1]) : Infinity;
})();

// ════════════════════════════════════════════════════════════════════════════
// 中文轉換（OpenCC）
// ════════════════════════════════════════════════════════════════════════════
const _s2t = OpenCC.Converter({ from: 'cn', to: 'tw' });
const _t2s = OpenCC.Converter({ from: 'tw', to: 'cn' });
function s2t(text) { return text ? _s2t(text) : text; }
function t2s(text) { return text ? _t2s(text) : text; }

const SINGLE_MECH_CN = SINGLE_MECH_RAW ? t2s(SINGLE_MECH_RAW) : '';

// ════════════════════════════════════════════════════════════════════════════
// HTTP 工具
// ════════════════════════════════════════════════════════════════════════════
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
    if (!FORCE && fs.existsSync(dest)) { resolve('skipped'); return; }

    const mod  = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(dest);

    mod.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        if (fs.existsSync(dest)) fs.unlinkSync(dest);
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
      file.on('finish', () => { file.close(); resolve('downloaded'); });
    }).on('error', (err) => {
      file.close();
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

// ════════════════════════════════════════════════════════════════════════════
// API 端點
// ════════════════════════════════════════════════════════════════════════════
function apiUrl(target, type, query = '') {
  let url = `${API_BASE}?appkey=${APP_KEY}&target=${target}&type=${type}`;
  if (query) url += `&query=${encodeURIComponent(query)}`;
  return url;
}

async function fetchMechList() {
  const res = await fetchJson(apiUrl('aircraft_data', 'list'));
  const seen = new Set();
  return (res.data?.data || []).filter(m => {
    if (!m.name || seen.has(m.name)) return false;
    seen.add(m.name);
    return true;
  });
}

async function fetchMechDetail(name) {
  const res = await fetchJson(apiUrl('aircraft_data', 'detail', name));
  return res.data?.data || [];
}

// ════════════════════════════════════════════════════════════════════════════
// 文字清理
// ════════════════════════════════════════════════════════════════════════════
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

// ════════════════════════════════════════════════════════════════════════════
// 從軀幹的 ModuleCarried 提取模組資料
// ════════════════════════════════════════════════════════════════════════════
function extractModules(torso, mechId, mechNameTW, rarity) {
  // 優先使用 manji（滿級）數據，描述最完整
  let rawModules = torso.manji?.ModuleCarried;
  if (!Array.isArray(rawModules)) rawModules = torso.ModuleCarried;
  if (!Array.isArray(rawModules)) return [];

  // 按 level 排序，level=8 → 8mod，level=4 首個 → 4mod，其餘 → fixed
  const sorted = [...rawModules].sort((a, b) => (a.level || 0) - (b.level || 0));
  const mod8   = sorted.find(m => m.level === 8);
  const mod4   = sorted.find(m => m.level === 4);
  const fixed  = sorted.filter(m => m !== mod4 && m !== mod8);

  const results = [];

  function buildEntry(m, slot) {
    if (!m) return null;
    const iconKey = m.icon || m.SkillIcon || '';
    return {
      id:          `mod_${mechNameTW}_${slot}`,
      name:        s2t(m.name || ''),
      slot,
      boundMechId: mechId,
      boundPart:   null,
      dmg:         0,
      crit:        0,
      critDmg:     0,
      acc:         0,
      description: s2t(cleanRichText(m.SpecificEffects || '')),
      rarity,
      icon:        iconKey ? `/images/modules/${iconKey}.png` : '',
      source:      'auto',
      _iconUrl:    iconKey ? `${IMG_BASE}/skill/${iconKey}.png` : '',  // 下載用，不寫入 JSON
    };
  }

  const e4 = buildEntry(mod4, '4mod');
  const e8 = buildEntry(mod8, '8mod');
  if (e4) results.push(e4);
  if (e8) results.push(e8);

  // 固定模（通常 1 個，特殊機甲可能多個）
  fixed.forEach((m, idx) => {
    const slot = fixed.length === 1 ? 'fixed' : `fixed_${idx + 1}`;
    const ef = buildEntry(m, slot);
    if (ef) results.push(ef);
  });

  return results;
}

// ════════════════════════════════════════════════════════════════════════════
// 主流程
// ════════════════════════════════════════════════════════════════════════════
async function main() {
  console.log('');
  console.log('╔════════════════════════════════════════════════╗');
  console.log('║  鋼嵐工具站 — 模組擷取腳本 v1 (API 版)          ║');
  console.log('╚════════════════════════════════════════════════╝');
  console.log(`  圖示: ${DOWNLOAD_IMG ? '✓ 下載' : '✗ 跳過'}  強制: ${FORCE ? '✓' : '✗'}  Debug: ${DEBUG ? '✓' : '✗'}`);
  if (SINGLE_MECH_RAW) console.log(`  指定機甲: ${SINGLE_MECH_RAW}（簡體: ${SINGLE_MECH_CN}）`);
  if (isFinite(LIMIT))  console.log(`  數量限制: ${LIMIT} 台機甲`);
  console.log('');

  // 建立輸出目錄
  if (DOWNLOAD_IMG) fs.mkdirSync(MODULES_DIR, { recursive: true });
  if (DEBUG) fs.mkdirSync(DEBUG_DIR, { recursive: true });

  // ── 讀取現有 mechs.json → name → mechId 映射 ──
  const mechNameToId = new Map();
  let mechsData = [];
  if (fs.existsSync(MECHS_JSON)) {
    try {
      mechsData = JSON.parse(fs.readFileSync(MECHS_JSON, 'utf-8'));
      for (const m of mechsData) mechNameToId.set(m.name, m.id);
      console.log(`📦 mechs.json: ${mechsData.length} 台機甲（用於 ID 對照）`);
    } catch (e) {
      console.log(`  ⚠ 讀取 mechs.json 失敗: ${e.message}`);
    }
  }
  // 記錄需要更新 moduleFixedIds 的機甲
  const mechFixedIdsUpdate = new Map(); // mechName → string[]

  // ── 讀取現有 modules.json（保留手動填寫的 dmg/crit/critDmg/acc）──
  const existingMap = new Map();
  if (fs.existsSync(OUTPUT_JSON)) {
    try {
      const arr = JSON.parse(fs.readFileSync(OUTPUT_JSON, 'utf-8'));
      for (const m of arr) existingMap.set(m.id, m);
      console.log(`📦 modules.json: ${arr.length} 個模組（保留現有數值）`);
    } catch (e) {
      console.log(`  ⚠ 讀取 modules.json 失敗: ${e.message}`);
    }
  }
  console.log('');

  // ── 取得機甲列表 ──
  console.log('📋 正在取得機甲列表 (target: aircraft_data)...');
  let allMechs;
  try {
    allMechs = await fetchMechList();
  } catch (err) {
    console.log(`  ⚠ API 請求失敗: ${err.message}`);
    allMechs = [];
  }
  console.log(`  → 總共 ${allMechs.length} 個機甲`);

  // ── 篩選目標 ──
  let targets;
  if (SINGLE_MECH_CN) {
    targets = allMechs.filter(m => m.name === SINGLE_MECH_CN || (m.name || '').includes(SINGLE_MECH_CN));
    if (targets.length === 0) {
      console.log(`  ⚠ 找不到「${SINGLE_MECH_RAW}」(${SINGLE_MECH_CN})`);
      process.exit(1);
    }
  } else if (ALL_QUALITY) {
    targets = allMechs;
  } else {
    targets = allMechs.filter(m => m.quality === 'SSR');
    console.log(`  → SSR 機甲: ${targets.length} 台`);
  }

  const finalTargets = targets.slice(0, LIMIT);
  console.log(`  → 本次處理: ${finalTargets.length} 台`);
  console.log('');

  // ── 逐一擷取 ──
  const outputMap = new Map(existingMap);
  const downloadedIcons = new Set();
  let updatedMechs = 0;
  let newIcons = 0;
  let skipIcons = 0;

  for (let i = 0; i < finalTargets.length; i++) {
    const mech = finalTargets[i];
    const mechNameTW = s2t(mech.name);
    process.stdout.write(`  [${i + 1}/${finalTargets.length}] ⏳ ${mechNameTW}...`);

    try {
      const parts = await fetchMechDetail(mech.name);
      const torso = parts.find(p => p.position === '躯干');
      if (!torso) { process.stdout.write(` ✗ 缺少軀幹資料\n`); continue; }

      // 用 mechs.json 查真實 mechId；若找不到（新機甲），用名稱回退
      const mechId = mechNameToId.get(mechNameTW) || `mech_???_${mechNameTW}`;
      const rarity = mech.quality || 'SSR';

      if (DEBUG && i === 0) {
        fs.writeFileSync(
          path.join(DEBUG_DIR, 'module_torso_sample.json'),
          JSON.stringify(torso, null, 2), 'utf-8'
        );
      }

      const entries = extractModules(torso, mechId, mechNameTW, rarity);

      // 若此機甲有多個固定模（fixed_N），先刪除舊的單一 _fixed 殘留條目
      const hasMultiFixed = entries.some(e => /fixed_\d+$/.test(e.slot));
      if (hasMultiFixed) {
        outputMap.delete(`mod_${mechNameTW}_fixed`);
        // 收集新的 fixed IDs，稍後寫回 mechs.json
        const fixedIds = entries.filter(e => /fixed/.test(e.slot)).map(e => e.id);
        mechFixedIdsUpdate.set(mechNameTW, fixedIds);
      }

      for (const entry of entries) {
        const { _iconUrl, ...moduleData } = entry;

        // 合併：保留手動填寫的加成數值
        const prev = existingMap.get(entry.id) || {};
        outputMap.set(entry.id, {
          ...moduleData,
          dmg:       prev.dmg       ?? moduleData.dmg,
          crit:      prev.crit      ?? moduleData.crit,
          critDmg:   prev.critDmg   ?? moduleData.critDmg,
          acc:       prev.acc       ?? moduleData.acc,
          boundPart: prev.boundPart ?? moduleData.boundPart,
          source:    prev.source    ?? moduleData.source,
        });

        // 下載圖示（相同 iconKey 只下載一次）
        if (DOWNLOAD_IMG && _iconUrl && !downloadedIcons.has(_iconUrl)) {
          downloadedIcons.add(_iconUrl);
          const iconFile = path.basename(entry.icon);
          const dest = path.join(MODULES_DIR, iconFile);
          try {
            const result = await downloadImage(_iconUrl, dest);
            if (result === 'downloaded') newIcons++;
            else skipIcons++;
          } catch {
            // 部分圖示可能不存在，靜默忽略
          }
        }
      }

      updatedMechs++;
      process.stdout.write(` ✓ (${entries.length} 個模組)\n`);
    } catch (err) {
      process.stdout.write(` ✗ ${err.message}\n`);
    }

    // 禮貌延遲
    if (i < finalTargets.length - 1) await new Promise(r => setTimeout(r, 300));
  }

  // ── 輸出 modules.json ──
  const output = Array.from(outputMap.values());
  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(output, null, 2), 'utf-8');

  // ── 更新 mechs.json（多固定模的機甲） ──
  if (mechFixedIdsUpdate.size > 0 && mechsData.length > 0) {
    const updatedMechsData = mechsData.map(m => {
      if (!mechFixedIdsUpdate.has(m.name)) return m;
      return { ...m, moduleFixedIds: mechFixedIdsUpdate.get(m.name) };
    });
    fs.writeFileSync(MECHS_JSON, JSON.stringify(updatedMechsData, null, 2), 'utf-8');
    console.log(`   🔄 mechs.json 更新了 ${mechFixedIdsUpdate.size} 台多固定模機甲`);
  }

  console.log('');
  console.log('═══════════════════════════════════════════════');
  console.log(`✅ 完成！`);
  console.log(`   更新機甲: ${updatedMechs} / ${finalTargets.length} 台`);
  console.log(`   模組合計: ${output.length} 個`);
  if (DOWNLOAD_IMG) {
    console.log(`   圖示下載: ${newIcons} 新 / ${skipIcons} 已有`);
    console.log(`   📁 ${MODULES_DIR}`);
  }
  console.log(`   📁 ${OUTPUT_JSON}`);
}

main().catch(err => {
  console.error('\n❌ 腳本執行失敗：', err.message);
  console.error(err.stack);
  process.exit(1);
});

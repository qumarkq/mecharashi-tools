/**
 * 鋼嵐工具站 — 模組資料擷取腳本 v5
 *
 * 來源：module_data API → 機甲特性模組 / 機甲8級模組 / 通用模組
 *
 * slot 定義（ModuleSlot enum）：
 *   "機甲特性模組" — ID 1xxx；需 4 模組槽；max 4 levels；名稱不帶 Ⅰ/Ⅱ
 *   "機甲8級模組"  — ID 3xxx；需 8 模組槽；max 8 levels
 *   "通用模組"     — ID 2xxx（A級）或 ID 4xxx；max 4 levels；
 *                    4xxx 名稱含 Ⅰ/Ⅱ / · I / · II
 *
 * ⚠ master ID 可能為 4 位數或 5 位數（新模組）：
 *   - 4 位數（1xxx/2xxx/3xxx/4xxx）為原始 master
 *   - 5 位數新 master：根 ID 不在 4 位數清單，或同根 ID 下有不同名稱
 *   - 純等級變體（5位數，根 ID 在 4 位數清單且同名）→ 腳本自動跳過
 *
 * ⚠ 機甲副模組（mod_機甲_4mod / _8mod / _fixed）由機甲腳本另行維護，
 *   執行本腳本不會更新這些資料。
 *
 * source 欄位（ModuleSource enum）— 遊戲取得途徑（圖鑑顯示）：
 *   "商店"    — 可在商店購買
 *   "拆機甲"  — 拆解機甲取得
 *   "未知"    — 來源未確認（預設）
 *
 * managedBy 欄位（ModuleDataSource enum）— 資料維護方式：
 *   "auto"    — 腳本自動擷取（預設）
 *   "manual"  — 管理者手動維護，腳本跳過此條目
 *
 * 使用方式：
 *   node scripts/scrape-modules.js            ← 更新機甲特性/8級/通用模組
 *   node scripts/scrape-modules.js --no-images ← 只更新文字，不下載圖示
 *   node scripts/scrape-modules.js --force     ← 強制重抓（含已有圖片）
 *   node scripts/scrape-modules.js --debug     ← 輸出 debug 資訊
 */

import * as OpenCC from 'opencc-js';
import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import { fileURLToPath } from 'url';
import { resolve } from 'path';
import admin from 'firebase-admin';
import readline from 'readline';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = resolve(__dirname, '..');

// ── 路徑設定 ────────────────────────────────────────────────────────────────
const API_BASE    = 'https://ma-activity.zlongame.com/common/infodata/mQuery.do';
const APP_KEY     = '1616148215678';
const IMG_BASE    = 'https://media.zlongame.com/media/pictures/cn/community/img/gl/gameInfo';
// const OUTPUT_JSON = path.join(__dirname, '../public/data/modules.json');  // 已停用：資料改由 Firestore 管理
const MODULES_DIR = path.join(__dirname, '../public/images/modules');
const DEBUG_DIR   = path.join(__dirname, '../public/debug');

// ── 命令列參數 ───────────────────────────────────────────────────────────────
const args         = process.argv.slice(2);
const DOWNLOAD_IMG = !args.includes('--no-images');
const FORCE        = args.includes('--force');
const DEBUG        = args.includes('--debug');
const AUTO         = args.includes('--auto');    // 略過確認，直接寫入 Firestore

// ════════════════════════════════════════════════════════════════════════════
// Firebase Admin 初始化
// ════════════════════════════════════════════════════════════════════════════
let db = null;

function initFirebase() {
  try {
    const envPath = resolve(ROOT, '.env.migration');
    if (fs.existsSync(envPath)) {
      fs.readFileSync(envPath, 'utf-8').split('\n').forEach(line => {
        const eqIdx = line.indexOf('=');
        if (eqIdx > 0) {
          const k = line.slice(0, eqIdx).trim();
          const v = line.slice(eqIdx + 1).trim();
          if (k && v) process.env[k] = v;
        }
      });
    }
    const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (!credPath) throw new Error('GOOGLE_APPLICATION_CREDENTIALS 未設定');
    const absCredPath = resolve(ROOT, credPath);
    if (!fs.existsSync(absCredPath)) throw new Error(`找不到服務帳號金鑰：${absCredPath}`);
    const serviceAccount = JSON.parse(fs.readFileSync(absCredPath, 'utf-8'));
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    db = admin.firestore();
    return true;
  } catch (err) {
    console.log(`  ⚠ Firebase 初始化失敗: ${err.message}`);
    return false;
  }
}

async function loadFirestoreModules() {
  if (!db) return new Map();
  const snap = await db.collection('modules').get();
  const map  = new Map();
  for (const doc of snap.docs) {
    map.set(doc.id, { id: doc.id, ...doc.data() });
  }
  return map;
}

async function batchWrite(collectionName, docs) {
  if (!db || docs.length === 0) return 0;
  let written = 0;
  for (let i = 0; i < docs.length; i += 500) {
    const batch = db.batch();
    docs.slice(i, i + 500).forEach(d => {
      batch.set(db.collection(collectionName).doc(d.id), d, { merge: true });
    });
    await batch.commit();
    written += Math.min(500, docs.length - i);
  }
  return written;
}

async function promptConfirm(question) {
  if (AUTO) return true;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(res => {
    rl.question(question, answer => {
      rl.close();
      res(answer.trim().toLowerCase() === 'y');
    });
  });
}

// ════════════════════════════════════════════════════════════════════════════
// 中文轉換（OpenCC）
// ════════════════════════════════════════════════════════════════════════════
const _s2t = OpenCC.Converter({ from: 'cn', to: 'tw' });
const _t2s = OpenCC.Converter({ from: 'tw', to: 'cn' });
function s2t(text) { return text ? _s2t(text) : text; }
function t2s(text) { return text ? _t2s(text) : text; }

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

async function fetchModuleList() {
  const res = await fetchJson(apiUrl('module_data', 'list'));
  return res.data?.data || [];
}

async function fetchModuleDetail(id) {
  const res = await fetchJson(apiUrl('module_data', 'detail', id));
  return res.data?.data || null;
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

// 判斷是否為通用模組（名稱含全形 Ⅰ/Ⅱ、·I/·II、末尾空白+I，或中文字直接接 I/II）
function isUniversalModule(nameTW) {
  return /[ⅠⅡⅢ]/.test(nameTW)
    || /·\s*I{1,3}$/.test(nameTW)
    || /\s+I{1,3}$/.test(nameTW)
    || /[一-鿿]I{1,3}$/.test(nameTW); // 中文字直接接 I/II/III（如「迴避模組I」）
}

// ════════════════════════════════════════════════════════════════════════════
// 識別所有真正的 master 主條目（4 位數 + 新增的 5 位數）
//
// 背景：API 清單混合了「master 主條目」與「等級變體」兩種條目：
//   - 4 位數 ID（如 1001, 4026）：一定是 master
//   - 5 位數 ID 分兩種：
//       * 等級變體：root（去掉末位）= 已知 4 位數 master，且同 root 內名稱全同
//         → 這些只是不同等級，不需單獨處理
//       * 新 master：root 不在 4 位數清單，或同 root 內名稱各異
//         → 需呼叫 detail 確認 mappingIds.length > 0
// ════════════════════════════════════════════════════════════════════════════
async function identifyMasterItems(list) {
  const fourDigitItems = list.filter(item => item.ID.toString().length <= 4);
  const fiveDigitItems = list.filter(item => item.ID.toString().length === 5);
  const fourDigitIds   = new Set(fourDigitItems.map(item => item.ID.toString()));

  // 按 root（前 4 位）分組
  const groups = new Map();
  for (const item of fiveDigitItems) {
    const root = Math.floor(item.ID / 10).toString();
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(item);
  }

  // 找出需要驗證的疑似新 master
  const potentialNewMasterItems = [];
  for (const [root, items] of groups) {
    const names = [...new Set(items.map(i => i.name || i.ModuleName || ''))];
    // 確認等級變體條件：root 存在於 4 位數 master 且同組名稱完全相同
    if (fourDigitIds.has(root) && names.length === 1) continue;
    for (const item of items) potentialNewMasterItems.push(item);
  }

  if (potentialNewMasterItems.length > 0) {
    process.stdout.write(`  → 驗證 ${potentialNewMasterItems.length} 個疑似新 master...`);
  }

  // 逐一呼叫 detail，確認 mappingIds.length > 0 才算真正的 master
  const confirmedNewMasters = [];
  for (const item of potentialNewMasterItems) {
    try {
      const detail = await fetchModuleDetail(item.ID.toString());
      if (detail && (detail.mappingIds?.length ?? 0) > 0) {
        confirmedNewMasters.push(item);
      }
      await new Promise(r => setTimeout(r, 150));
    } catch { /* skip */ }
  }

  if (potentialNewMasterItems.length > 0) {
    console.log(` 確認 ${confirmedNewMasters.length} 個新 master`);
  }

  return [...fourDigitItems, ...confirmedNewMasters];
}

// ════════════════════════════════════════════════════════════════════════════
// Part A: 從 module_data API 擷取 4模組/8模組/通用模組
// ════════════════════════════════════════════════════════════════════════════
async function scrapeWikiModules(existingMap, downloadedIcons) {
  console.log('');
  console.log('【A】module_data API — 4模組/8模組/通用模組');
  console.log('──────────────────────────────────────────────');

  const list = await fetchModuleList();
  console.log(`  → 清單共 ${list.length} 條目`);

  // 識別所有真正的 master 主條目（含 5 位數新模組）
  const masterItems = await identifyMasterItems(list);
  console.log(`  → master 主條目: ${masterItems.length} 個（含新增 5 位數 master）`);

  const outputMap = new Map();
  let newCount  = 0;
  let skipCount = 0;
  let newIcons  = 0;
  let skipIcons = 0;

  for (let i = 0; i < masterItems.length; i++) {
    const item = masterItems[i];
    const masterId = item.ID.toString();

    // 取 detail（含 mappingIds）
    let detail;
    try {
      detail = await fetchModuleDetail(masterId);
      await new Promise(r => setTimeout(r, 150));
    } catch (err) {
      console.log(`  [${i+1}/${masterItems.length}] ✗ ${masterId}: ${err.message}`);
      continue;
    }

    if (!detail) continue;

    // 取出各等級
    const mappingIds = detail.mappingIds || [];
    const levelCount = mappingIds.length; // 4 or 8
    if (levelCount === 0) continue;

    // 模組名稱（Traditional Chinese）
    // 主條目名稱（用作備用）
    const nameCN = detail.name || item.name || item.ModuleName || '';
    const nameTW = s2t(nameCN);

    // 取第一個等級的資料（名稱含 Ⅰ/Ⅱ，用於通用模組判斷與圖示）
    const firstLevel    = mappingIds[0] || {};
    const iconKey       = firstLevel.SkillIcon || firstLevel.icon || '';
    const firstLevelCN  = firstLevel.name || nameCN;
    const firstLevelTW  = s2t(firstLevelCN);

    // 決定 slot（ModuleSlot enum）
    // ID 2xxx = A 級通用模組；4xxx（S 級）名稱含 Ⅰ/Ⅱ = 通用模組
    const masterIdNum = parseInt(masterId);
    const isAGrade  = masterIdNum >= 2000 && masterIdNum < 3000;
    const isSGrade  = masterIdNum >= 4000 && masterIdNum < 5000;
    let slot;
    if (levelCount >= 8)                                                                slot = '機甲8級模組';
    else if (isAGrade || isSGrade || isUniversalModule(nameTW) || isUniversalModule(firstLevelTW)) slot = '通用模組';
    else                                                                                slot = '機甲特性模組';

    // 通用模組使用第一等級名稱（含 Ⅰ/Ⅱ）作為顯示名稱。
    // 4xxx S 級模組的 API 等級名稱一律為「xxxⅠ」（API 資料問題），
    // 實際遊戲中顯示為「xxxⅡ」，需替換。
    let displayName;
    if (slot !== '通用模組') {
      displayName = nameTW;
    } else if (isSGrade) {
      displayName = firstLevelTW.replace('Ⅰ', 'Ⅱ') || nameTW + 'Ⅱ';
    } else {
      displayName = firstLevelTW;
    }

    const moduleId = `mod_${masterId}`;

    // 如果已存在且 managedBy=manual，跳過
    const prev = existingMap.get(moduleId);
    if (prev && prev.managedBy === 'manual') {
      outputMap.set(moduleId, prev);
      skipCount++;
      continue;
    }

    // 建立各等級資料（保留 Firestore 中的數值，只更新 API 提供的 description）
    const levels = mappingIds.map((lv, idx) => {
      const p = prev?.levels?.[idx];
      const base = {
        level:            idx + 1,
        description:      s2t(cleanRichText(lv.SpecificEffects || '')),
        dmg:              p?.dmg              ?? 0,
        crit_rate:        p?.crit_rate        ?? 0,
        critDmg:          p?.critDmg          ?? 0,
        acc_rate:         p?.acc_rate         ?? 0,
        firepower_rate:   p?.firepower_rate   ?? 0,
        armor_rate:       p?.armor_rate       ?? 0,
        crit_resist_rate: p?.crit_resist_rate ?? 0,
        output_bonus:     p?.output_bonus     ?? 0,
        dodge_rate:       p?.dodge_rate       ?? 0,
        durable_rate:     p?.durable_rate     ?? 0,
        dmg_resist_rate:  p?.dmg_resist_rate  ?? 0,
      };
      // v2.0 武器增傷欄位（選填，只在有值時保留）
      const weaponFields = [
        'dmg_assault','dmg_melee','dmg_shooting','dmg_tactical',
        'dmg_blade','dmg_polearm','dmg_missile','dmg_rocket',
        'dmg_shotgun','dmg_machinegun','dmg_heavy_machinegun',
        'dmg_railgun','dmg_funnel','dmg_sniper_light','dmg_sniper',
        'dmg_fist','dmg_pile','dmg_chainsaw','dmg_flamethrower',
        'dmg_counter','dmg_enemy_phase',
      ];
      for (const f of weaponFields) {
        if (p?.[f] != null) base[f] = p[f];
      }
      return base;
    });

    // 最高等級描述作為頂層 description
    const maxLevel   = levels[levels.length - 1];
    const description = maxLevel?.description || '';

    const moduleData = {
      id:              moduleId,
      name:            displayName,
      slot,
      boundMechId:     null,
      boundPart:       prev?.boundPart         ?? null,
      available:       true,
      source:          prev?.source            ?? ['未知'],
      dismantleMechIds: prev?.dismantleMechIds ?? null,
      managedBy:       prev?.managedBy         ?? 'auto',
      moduleAddLevel:  prev?.moduleAddLevel     ?? 1,
      output_bonus:    prev?.output_bonus      ?? 0,
      dmg:             prev?.dmg               ?? 0,
      crit_rate:       prev?.crit_rate         ?? 0,
      critDmg:         prev?.critDmg           ?? 0,
      acc_rate:        prev?.acc_rate          ?? 0,
      firepower_rate:  prev?.firepower_rate    ?? 0,
      armor_rate:      prev?.armor_rate        ?? 0,
      crit_resist_rate: prev?.crit_resist_rate ?? 0,
      dodge_rate:      prev?.dodge_rate        ?? 0,
      durable_rate:    prev?.durable_rate      ?? 0,
      dmg_resist_rate: prev?.dmg_resist_rate   ?? 0,
      levels,
      description,
      rarity:          prev?.rarity            ?? '',
      icon:            iconKey ? `/images/modules/${iconKey}.png` : (prev?.icon ?? ''),
      conditionalEffects: prev?.conditionalEffects ?? [],
      _iconUrl:        iconKey ? `${IMG_BASE}/skill/${iconKey}.png` : '',
    };

    // v2.0 武器增傷欄位（選填，只在有值時保留）
    const topWeaponFields = [
      'dmg_assault','dmg_melee','dmg_shooting','dmg_tactical',
      'dmg_blade','dmg_polearm','dmg_missile','dmg_rocket',
      'dmg_shotgun','dmg_machinegun','dmg_heavy_machinegun',
      'dmg_railgun','dmg_funnel','dmg_sniper_light','dmg_sniper',
      'dmg_fist','dmg_pile','dmg_chainsaw','dmg_flamethrower',
      'dmg_counter','dmg_enemy_phase',
    ];
    for (const f of topWeaponFields) {
      if (prev?.[f] != null) moduleData[f] = prev[f];
    }

    // 下載圖示
    if (DOWNLOAD_IMG && moduleData._iconUrl && !downloadedIcons.has(moduleData._iconUrl)) {
      downloadedIcons.add(moduleData._iconUrl);
      const dest = path.join(MODULES_DIR, `${iconKey}.png`);
      try {
        const r = await downloadImage(moduleData._iconUrl, dest);
        if (r === 'downloaded') newIcons++;
        else skipIcons++;
      } catch { /* 靜默 */ }
    }

    const { _iconUrl, ...cleanData } = moduleData;
    outputMap.set(moduleId, cleanData);
    newCount++;

    if (DEBUG || (i + 1) % 20 === 0) {
      process.stdout.write(`  [${i+1}/${masterItems.length}] ✓ ${displayName} (${slot}, ${levelCount}lv)\n`);
    }
  }

  console.log(`  ✅ WIKI 模組: ${newCount} 個新增/更新，${skipCount} 個手動跳過`);
  if (DOWNLOAD_IMG) console.log(`  圖示: ${newIcons} 新 / ${skipIcons} 已有`);

  return outputMap;
}

// ════════════════════════════════════════════════════════════════════════════
// 主流程
// ════════════════════════════════════════════════════════════════════════════
async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║  鋼嵐工具站 — 模組擷取腳本 v6 (Firebase 版)       ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log(`  圖示: ${DOWNLOAD_IMG?'✓':'✗'}  強制: ${FORCE?'✓':'✗'}  自動寫入: ${AUTO?'✓':'✗（互動確認）'}`);
  console.log('');

  // ── 初始化 Firebase ──
  const firebaseReady = initFirebase();
  if (!firebaseReady) {
    console.log('❌ Firebase 未連線，請確認 .env.migration 與服務帳號金鑰。');
    process.exit(1);
  }
  console.log('🔥 Firebase 連線成功');
  console.log('');

  if (DOWNLOAD_IMG) fs.mkdirSync(MODULES_DIR, { recursive: true });
  if (DEBUG)        fs.mkdirSync(DEBUG_DIR,   { recursive: true });

  // ── 從 Firestore 載入現有模組 ──
  process.stdout.write('📦 載入 Firestore 模組資料...');
  const existingMap = await loadFirestoreModules();
  console.log(` ${existingMap.size} 個`);
  console.log('');

  const downloadedIcons = new Set();
  const finalMap = new Map();

  // ── 擷取 WIKI 模組（機甲特性/8級/通用）──
  const wikiMap = await scrapeWikiModules(existingMap, downloadedIcons);
  for (const [k, v] of wikiMap) finalMap.set(k, v);

  // ── 保留 manual 條目（Firestore 中有但此次未擷取到）──
  for (const [k, v] of existingMap) {
    if (finalMap.has(k)) continue;
    if (v.managedBy === 'manual') finalMap.set(k, v);
  }

  // ── 分類：全新 / 描述更新（managedBy=auto 且已存在）──
  const newModules     = [];
  const updatedModules = [];
  for (const [id, m] of finalMap) {
    if (!existingMap.has(id)) {
      newModules.push(m);
    } else if (m.managedBy !== 'manual') {
      const prev = existingMap.get(id);
      const maxLv = (m.levels ?? []).at(-1);
      const prevMaxLv = (prev.levels ?? []).at(-1);
      if (maxLv?.description !== prevMaxLv?.description) {
        updatedModules.push(m);
      }
    }
  }

  // ── 差異報告 ──
  const count4   = Array.from(finalMap.values()).filter(m => m.slot === '機甲特性模組').length;
  const count8   = Array.from(finalMap.values()).filter(m => m.slot === '機甲8級模組').length;
  const countUni = Array.from(finalMap.values()).filter(m => m.slot === '通用模組').length;

  console.log('');
  console.log('═══════════════════════════════════════════════════');
  console.log(`📊 差異報告`);
  console.log(`   機甲特性模組: ${count4} 個 / 機甲8級模組: ${count8} 個 / 通用模組: ${countUni} 個`);
  console.log(`   🆕 新增: ${newModules.length} 個  🔄 描述更新: ${updatedModules.length} 個`);
  if (newModules.length > 0) {
    console.log('   新增模組：');
    newModules.slice(0, 15).forEach(m => console.log(`     + ${m.id.padEnd(12)}  ${m.name}  (${m.slot})`));
    if (newModules.length > 15) console.log(`     ... 及其他 ${newModules.length - 15} 個`);
  }
  if (updatedModules.length > 0) {
    console.log('   描述更新：');
    updatedModules.slice(0, 5).forEach(m => console.log(`     ~ ${m.id.padEnd(12)}  ${m.name}`));
    if (updatedModules.length > 5) console.log(`     ... 及其他 ${updatedModules.length - 5} 個`);
  }
  console.log('');

  // ── 寫入 Firestore（含確認）──
  const toWrite = [...newModules, ...updatedModules];
  if (toWrite.length === 0) {
    console.log('✅ Firestore 已是最新，無需寫入。');
    return;
  }

  const confirmed = await promptConfirm(`將 ${toWrite.length} 筆資料寫入 Firestore？ [y/N] `);
  if (!confirmed) { console.log('已取消。'); process.exit(0); }

  process.stdout.write('🔥 寫入 Firestore...');
  const written = await batchWrite('modules', toWrite);
  console.log(` ${written} 筆完成`);
  console.log('');
  console.log('✅ 完成！');
  console.log('⚠ 機甲副模組（_4mod / _8mod / _fixed）請另行執行機甲腳本更新。');
}

main().catch(err => {
  console.error('\n❌ 腳本執行失敗：', err.message);
  console.error(err.stack);
  process.exit(1);
});

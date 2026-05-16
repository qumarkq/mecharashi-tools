/**
 * 鋼嵐工具站 — 機甲(機兵)資料擷取腳本 v4 (Firebase 版)
 *
 * v4 更新：
 *   - 整合 Firebase Admin SDK，直接讀寫 Firestore
 *   - 品質欄位改用 ItemRarity enum（SSR→S / SR→A / R→B）
 *   - --clear-mechs：清空 Firestore mechs 集合（再搭配 --force 重抓所有機甲）
 *   - --no-firebase：略過 Firebase，僅更新本地 JSON（向下相容）
 *
 * v5 更新：
 *   - 移除關鍵字副模組判定，改用 Firestore ID 前綴優先查詢：
 *     1. sub_mod 前綴（手動維護的副模組）→ 名稱比對，找到直接 mapping
 *     2. mod 前綴（一般模組）→ 名稱比對，找到直接 mapping
 *     3. 查不到 → 新增「機甲專屬模組」，綁定機甲（boundPart='torso'），
 *        僅寫最高等級資料，其餘由管理者手動填入
 *   - 新模組欄位命名統一為 schema 規範（crit_rate / acc_rate / output_bonus …）
 *
 * 使用方式：
 *   node scripts/scrape-mechs.js                      ← 全量機兵（僅新增）
 *   node scripts/scrape-mechs.js --mech=都卜勒         ← 指定單一機兵
 *   node scripts/scrape-mechs.js --no-images           ← 只取文字不下載圖片
 *   node scripts/scrape-mechs.js --force               ← 強制重抓（忽略已有資料）
 *   node scripts/scrape-mechs.js --limit=3             ← 只跑前 N 個
 *   node scripts/scrape-mechs.js --all                 ← 含所有品質（預設只抓 S 級）
 *   node scripts/scrape-mechs.js --clear-mechs --force ← 清空 Firebase 後全量重抓
 *   node scripts/scrape-mechs.js --no-firebase         ← 不連 Firebase，僅存本地 JSON
 *   node scripts/scrape-mechs.js --debug               ← 輸出 debug 資訊
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

// ── 路徑設定 ──────────────────────────────────────────────────
const API_BASE    = 'https://ma-activity.zlongame.com/common/infodata/mQuery.do';
const APP_KEY     = '1616148215678';
const IMG_BASE    = 'https://media.zlongame.com/media/pictures/cn/community/img/gl/gameInfo';
// const OUTPUT_JSON = path.join(__dirname, '../public/data/mechs.json');  // 已停用：資料改由 Firestore 管理
const MECHS_DIR   = path.join(__dirname, '../public/images/mechs');
const MODULES_DIR = path.join(__dirname, '../public/images/modules');
const DEBUG_DIR   = path.join(__dirname, '../public/debug');

// ── 命令列參數 ────────────────────────────────────────────────
const args            = process.argv.slice(2);
const DOWNLOAD_IMG    = !args.includes('--no-images');
const FORCE           = args.includes('--force');
const ALL_QUALITY     = args.includes('--all');
const DEBUG           = args.includes('--debug');
const CLEAR_MECHS     = args.includes('--clear-mechs');
const NO_FIREBASE     = args.includes('--no-firebase');
const AUTO            = args.includes('--auto');    // 略過確認，直接寫入 Firestore
const SINGLE_MECH_RAW = (args.find(a => a.startsWith('--mech=')) || '').split('=')[1] || '';
const LIMIT           = (() => {
  const l = args.find(a => a.startsWith('--limit='));
  return l ? parseInt(l.split('=')[1]) : Infinity;
})();

// ── 品質映射（API → ItemRarity enum）────────────────────────
const RARITY_MAP = {
  SSR: 'S', SR: 'A', R: 'B', N: 'B',
  S: 'S', A: 'A', B: 'B', EX: 'EX',
};

// ── 裝甲類型映射（API → ArmorType enum）─────────────────────
const ARMOR_MAP = {
  Heavy:  '重型',
  Medium: '中甲',
  Light:  '輕型',
};

// ── 位置映射（API 簡體 → 英文 key）──────────────────────────
const POSITION_MAP = {
  '躯干': 'torso',
  '左臂': 'leftArm',
  '右臂': 'rightArm',
  '腿部': 'legs',
};

// ════════════════════════════════════════════════════════════
// 中文轉換（OpenCC）
// ════════════════════════════════════════════════════════════
const _s2t = OpenCC.Converter({ from: 'cn', to: 'tw' });
const _t2s = OpenCC.Converter({ from: 'tw', to: 'cn' });
function s2t(text) { return text ? _s2t(text) : text; }
function t2s(text) { return text ? _t2s(text) : text; }

const SINGLE_MECH_CN = SINGLE_MECH_RAW ? t2s(SINGLE_MECH_RAW) : '';

// ════════════════════════════════════════════════════════════
// 互動確認
// ════════════════════════════════════════════════════════════
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

// ════════════════════════════════════════════════════════════
// Firebase Admin 初始化
// ════════════════════════════════════════════════════════════
let db = null;

function initFirebase() {
  if (NO_FIREBASE) return false;
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
    req.on('error', (err) => { file.close(); fs.unlink(dest, () => {}); reject(err); });
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
  const res  = await fetchJson(apiUrl('aircraft_data', 'list'));
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

// ════════════════════════════════════════════════════════════
// 文字清理
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
// Firestore — 載入模組清單
// subModByName：ID 以 sub_mod 開頭（手動維護的副模組）
// modByName   ：其餘 ID（scrape-modules.js 抓入的一般模組）
// ════════════════════════════════════════════════════════════
async function loadFirestoreModules() {
  if (!db) return { byId: new Map(), subModByName: new Map(), modByName: new Map() };
  const snap         = await db.collection('modules').get();
  const byId         = new Map();
  const subModByName = new Map();
  const modByName    = new Map();
  for (const doc of snap.docs) {
    const data = { id: doc.id, ...doc.data() };
    byId.set(doc.id, data);
    if (data.name) {
      if (doc.id.startsWith('sub_mod')) subModByName.set(data.name, data);
      else                               modByName.set(data.name, data);
    }
  }
  return { byId, subModByName, modByName };
}

// ════════════════════════════════════════════════════════════
// Firestore — 批次寫入（每批 ≤ 500）
// ════════════════════════════════════════════════════════════
async function batchWrite(collection, docs) {
  if (!db || docs.length === 0) return 0;
  let written = 0;
  for (let i = 0; i < docs.length; i += 500) {
    const batch = db.batch();
    docs.slice(i, i + 500).forEach(d => {
      batch.set(db.collection(collection).doc(d.id), d, { merge: true });
    });
    await batch.commit();
    written += Math.min(500, docs.length - i);
  }
  return written;
}

// ════════════════════════════════════════════════════════════
// Firestore — 清空 mechs 集合
// ════════════════════════════════════════════════════════════
async function clearMechsCollection() {
  if (!db) return 0;
  const snap = await db.collection('mechs').get();
  if (snap.empty) return 0;
  let deleted = 0;
  for (let i = 0; i < snap.docs.length; i += 500) {
    const batch = db.batch();
    snap.docs.slice(i, i + 500).forEach(d => batch.delete(d.ref));
    await batch.commit();
    deleted += Math.min(500, snap.docs.length - i);
  }
  return deleted;
}

// ════════════════════════════════════════════════════════════
// 從單一部件建構部件 JSON（使用 manji 滿級數據）
// ════════════════════════════════════════════════════════════
function buildPartJson(rawPart) {
  if (!rawPart) return null;
  const posKey = POSITION_MAP[rawPart.position];
  if (!posKey) return null;

  const src = rawPart.manji || rawPart;

  const part = {
    position:  posKey,
    durable:   parseInt(src.durable)          || 0,
    armor:     parseInt(src.Armor)            || 0,
    firepower: parseInt(src.fire)             || 0,
    weight:    parseInt(rawPart.aircraftWeight) || 0,
    interface: s2t(src.Interface || rawPart.Interface || ''),
  };

  if (posKey === 'torso') {
    part.output   = parseInt(src.output)    || 0;
    part.antiRiot = parseInt(src.Antiriot)  || 0;
  }
  if (posKey === 'leftArm' || posKey === 'rightArm') {
    part.hit = parseInt(src.Hit) || 0;
  }
  if (posKey === 'legs') {
    part.dodge = parseInt(src.Dodge) || 0;
    const moveRaw = parseInt(src.move) || 0;
    part.move = moveRaw >= 1000 ? moveRaw / 1000 : moveRaw;
  }

  const iconKey = rawPart.mechaIcon || '';
  if (iconKey) {
    part.mechaIcon = iconKey;
    part._iconUrl  = `${IMG_BASE}/waparts/${iconKey}.png`;
  }

  return part;
}

// ════════════════════════════════════════════════════════════
// 解析並同步模組（v5：sub_mod 優先查詢版）
//
// 查詢順序：
//   1. 名稱比對 sub_mod 前綴模組（手動維護的副模組）→ 找到直接 mapping
//   2. 名稱比對 mod 前綴模組（scrape-modules.js 抓入的一般模組）→ 找到直接 mapping
//   3. 查不到 → 視為「機甲專屬模組」，綁定此機甲（boundPart='torso'），
//      寫入最高等級資料（levels 只含一筆），其餘等級由管理者手動填入
// ════════════════════════════════════════════════════════════
function extractAndSyncModules(torso, mechId, mechNameTW, rarity, firestoreModules, pendingModules) {
  let rawModules = torso.manji?.ModuleCarried;
  if (!Array.isArray(rawModules)) rawModules = torso.ModuleCarried;
  if (!Array.isArray(rawModules)) return { module4Id: '', module8Id: '', moduleFixedIds: [] };

  const sorted = [...rawModules].sort((a, b) => (a.level || 0) - (b.level || 0));
  const mod8   = sorted.find(m => m.level === 8);
  const mod4   = sorted.find(m => m.level === 4);
  const fixed  = sorted.filter(m => m !== mod4 && m !== mod8);

  let newCount = 0;
  const { byId, subModByName, modByName } = firestoreModules;

  // slotKey  : 用於產生新模組 ID 的後綴（'4mod' / '8mod' / 'fixed' / 'fixed_N'）
  // slotLevel: 該槽最高等級（4 / 8 / 0）；0 表示固定副模組，不帶等級進階
  function processModule(m, slotKey, slotLevel) {
    if (!m) return '';
    const nameTW  = s2t(m.name || '');
    const iconKey = m.icon || m.SkillIcon || '';
    const desc    = s2t(cleanRichText(m.SpecificEffects || ''));

    // 1. 先查 sub_mod 前綴（手動維護的副模組）
    if (subModByName.has(nameTW)) return subModByName.get(nameTW).id;

    // 2. 再查 mod 前綴（一般模組）
    if (modByName.has(nameTW)) return modByName.get(nameTW).id;

    // 3. 查不到 → 新增機甲專屬模組
    const moduleSlot = slotLevel === 8 ? '機甲8級模組'
                     : slotLevel === 4 ? '機甲特性模組'
                     : '機甲副模組';
    const expectedId = `mod_${mechNameTW}_${slotKey}`;

    const levelEntry = {
      level:           slotLevel || 1,
      description:     desc,
      dmg:             0,
      crit_rate:       0,
      critDmg:         0,
      acc_rate:        0,
      firepower_rate:  0,
      armor_rate:      0,
      crit_resist_rate: 0,
      output_bonus:    0,
      dodge_rate:      0,
      durable_rate:    0,
      dmg_resist_rate: 0,
    };

    const newModule = {
      id:              expectedId,
      name:            nameTW,
      slot:            moduleSlot,
      boundMechId:     mechId,
      boundPart:       'torso',
      available:       false,
      source:          '未知',
      managedBy:       'auto',
      output_bonus:    0,
      dmg:             0,
      crit_rate:       0,
      critDmg:         0,
      acc_rate:        0,
      firepower_rate:  0,
      armor_rate:      0,
      crit_resist_rate: 0,
      dodge_rate:      0,
      durable_rate:    0,
      dmg_resist_rate: 0,
      levels:          [levelEntry],
      description:     desc,
      rarity,
      icon:            iconKey ? `/images/modules/${iconKey}.png` : '',
    };

    if (!pendingModules.has(expectedId)) {
      pendingModules.set(expectedId, newModule);
      byId.set(expectedId, newModule);
      modByName.set(nameTW, newModule);
      newCount++;

      if (DOWNLOAD_IMG && iconKey) {
        const dest = path.join(MODULES_DIR, `${iconKey}.png`);
        downloadImage(`${IMG_BASE}/skill/${iconKey}.png`, dest).catch(() => {});
      }
    }

    return expectedId;
  }

  const module4Id      = processModule(mod4, '4mod', 4);
  const module8Id      = processModule(mod8, '8mod', 8);
  const moduleFixedIds = [];

  if (fixed.length === 1) {
    moduleFixedIds.push(processModule(fixed[0], 'fixed', 0));
  } else {
    fixed.forEach((m, idx) => moduleFixedIds.push(processModule(m, `fixed_${idx + 1}`, 0)));
  }

  if (newCount > 0) process.stdout.write(` [+${newCount}專屬模組]`);

  return { module4Id, module8Id, moduleFixedIds };
}

// ════════════════════════════════════════════════════════════
// 從 4 個部件組裝機甲 JSON
// ════════════════════════════════════════════════════════════
function buildMechJson(parts, index, firestoreModules, pendingModules) {
  const torso    = parts.find(p => p.position === '躯干');
  const leftArm  = parts.find(p => p.position === '左臂');
  const rightArm = parts.find(p => p.position === '右臂');
  const legs     = parts.find(p => p.position === '腿部');

  if (!torso) throw new Error('缺少軀幹資料');

  const nameTW   = s2t(torso.name || '');
  const safeName = nameTW.replace(/[^一-龥a-zA-Z0-9　-〿＀-￯\-]/g, '');
  const id       = `mech_${String(index + 1).padStart(3, '0')}_${safeName}`;

  const armorType = ARMOR_MAP[torso.type] || s2t(torso.type) || '中甲';
  const rarity    = RARITY_MAP[torso.quality] || 'S';

  const t  = torso.manji || torso;
  const lg = legs?.manji || legs;

  const firepower = parseInt(t?.fire)   || 0;
  const armor     = parseInt(t?.Armor)  || 0;
  const evasion   = parseInt(lg?.Dodge) || 0;
  const moveRaw   = parseInt(lg?.move)  || 0;
  const mobility  = moveRaw >= 1000 ? moveRaw / 1000 : moveRaw;
  const output    = parseInt(t?.output) || 0;

  const weight = [torso, leftArm, rightArm, legs]
    .reduce((sum, p) => sum + (parseInt(p?.aircraftWeight) || 0), 0);

  const partsData = {
    torso:    buildPartJson(torso),
    leftArm:  buildPartJson(leftArm),
    rightArm: buildPartJson(rightArm),
    legs:     buildPartJson(legs),
  };

  const { module4Id, module8Id, moduleFixedIds } = extractAndSyncModules(
    torso, id, nameTW, rarity, firestoreModules, pendingModules
  );

  const iconKey    = torso.icon || '';
  const portraitUrl = iconKey ? `${IMG_BASE}/mecha/${iconKey}.png` : '';
  const lihuiUrl    = torso.lihuiIcon ? `${IMG_BASE}/mechaHalf/${torso.lihuiIcon}.png` : '';

  for (const [key, fileName] of Object.entries({
    torso: 'torso.png', leftArm: 'leftArm.png',
    rightArm: 'rightArm.png', legs: 'legs.png',
  })) {
    if (partsData[key]?.mechaIcon) {
      partsData[key].icon = `/images/mechs/${safeName}/${fileName}`;
    }
  }

  return {
    id,
    name:          nameTW,
    armorType,
    rarity,
    firepower,
    armor,
    evasion,
    mobility,
    weight,
    output,
    parts:         partsData,
    module4Id,
    module8Id,
    moduleFixedIds,
    portrait:      `/images/mechs/${safeName}/portrait.png`,
    halfPortrait:  lihuiUrl ? `/images/mechs/${safeName}/half.png` : '',
    portraitUrl,
    lihuiUrl,
    lore:          s2t(cleanRichText(torso.introduce || '')),
  };
}

// ════════════════════════════════════════════════════════════
// 圖片下載（依機甲分資料夾存放）
// ════════════════════════════════════════════════════════════
const PART_FILE_MAP = {
  torso: 'torso.png', leftArm: 'leftArm.png',
  rightArm: 'rightArm.png', legs: 'legs.png',
};

async function downloadMechImages(mech) {
  if (!DOWNLOAD_IMG) return;

  const safeName = mech.name.replace(/[^一-龥a-zA-Z0-9　-〿＀-￯\-]/g, '');
  const mechDir  = path.join(MECHS_DIR, safeName);
  fs.mkdirSync(mechDir, { recursive: true });

  let downloaded = 0, failed = 0;

  async function dl(url, dest) {
    try { await downloadImage(url, dest); downloaded++; }
    catch (e) { failed++; if (DEBUG) process.stdout.write(` [失敗:${e.message}]`); }
  }

  if (mech.portraitUrl) await dl(mech.portraitUrl, path.join(mechDir, 'portrait.png'));
  if (mech.lihuiUrl)    await dl(mech.lihuiUrl,    path.join(mechDir, 'half.png'));

  for (const [partKey, fileName] of Object.entries(PART_FILE_MAP)) {
    const part = mech.parts?.[partKey];
    if (part?._iconUrl) await dl(part._iconUrl, path.join(mechDir, fileName));
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
  console.log('║  鋼嵐工具站 — 機兵擷取腳本 v4 (Firebase 版)  ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log(`  圖片: ${DOWNLOAD_IMG?'✓':'✗'}  強制: ${FORCE?'✓':'✗'}  全品質: ${ALL_QUALITY?'✓':'✗'}  Debug: ${DEBUG?'✓':'✗'}`);
  console.log(`  Firebase: ${NO_FIREBASE?'✗':'✓'}  清空機甲: ${CLEAR_MECHS?'✓':'✗'}`);
  if (SINGLE_MECH_RAW) console.log(`  指定機兵: ${SINGLE_MECH_RAW}（簡體: ${SINGLE_MECH_CN}）`);
  if (isFinite(LIMIT))  console.log(`  數量限制: ${LIMIT}`);
  console.log('');

  // ── 初始化 Firebase ──
  const firebaseReady = initFirebase();
  if (firebaseReady) {
    console.log('🔥 Firebase 連線成功');
  } else if (!NO_FIREBASE) {
    console.log('⚠ Firebase 未連線，僅更新本地 JSON（加 --no-firebase 可略過此警告）');
  }
  console.log('');

  // ── 清空 mechs 集合 ──
  if (CLEAR_MECHS) {
    if (firebaseReady) {
      process.stdout.write('🗑  清空 Firestore mechs 集合...');
      const deleted = await clearMechsCollection();
      console.log(` 已刪除 ${deleted} 筆`);
    } else {
      console.log('⚠ --clear-mechs 需要 Firebase 連線，已略過。');
    }
    console.log('');
  }

  // ── 建立輸出目錄 ──
  if (DOWNLOAD_IMG) {
    fs.mkdirSync(MECHS_DIR, { recursive: true });
    fs.mkdirSync(MODULES_DIR, { recursive: true });
  }
  if (DEBUG) fs.mkdirSync(DEBUG_DIR, { recursive: true });

  // ── 從 Firestore 載入已有機甲資料 ──
  const existingMechs = new Map();
  if (!FORCE && db) {
    try {
      process.stdout.write('📦 載入 Firestore 機甲資料...');
      const snap = await db.collection('mechs').get();
      for (const doc of snap.docs) {
        const data = { id: doc.id, ...doc.data() };
        existingMechs.set(t2s(data.name || ''), data);
      }
      console.log(` ${existingMechs.size} 個`);
    } catch (e) {
      console.log(`\n  ⚠ 載入 Firestore 機甲資料失敗: ${e.message}`);
    }
  }

  // ── 載入 Firestore 模組 ──
  process.stdout.write('📦 載入 Firestore 模組清單...');
  const firestoreModules = await loadFirestoreModules();
  console.log(` 副模組 ${firestoreModules.subModByName.size} 個 + 一般模組 ${firestoreModules.modByName.size} 個`);
  console.log('');

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

  if (DEBUG) {
    fs.writeFileSync(
      path.join(DEBUG_DIR, 'aircraft_list_raw.json'),
      JSON.stringify(allMechs, null, 2), 'utf-8'
    );
  }

  // ── 篩選目標 ──
  let targets;
  if (SINGLE_MECH_CN) {
    targets = allMechs.filter(m => m.name === SINGLE_MECH_CN);
    if (targets.length === 0) targets = allMechs.filter(m => (m.name || '').includes(SINGLE_MECH_CN));
    if (targets.length === 0) {
      console.log(`  ⚠ 找不到「${SINGLE_MECH_RAW}」(${SINGLE_MECH_CN})，可用機兵：`);
      console.log('  ' + allMechs.map(m => s2t(m.name)).join('、'));
      process.exit(1);
    }
  } else if (ALL_QUALITY) {
    targets = allMechs;
  } else {
    const ssrMechs = allMechs.filter(m => m.quality === 'SSR');
    targets = ssrMechs.length > 0 ? ssrMechs : allMechs;
    console.log(`  → S 級 (SSR): ${targets.length} 個`);
  }

  const toDo   = FORCE ? targets : targets.filter(m => !existingMechs.has(m.name));
  const toSkip = targets.length - toDo.length;
  if (toSkip > 0) console.log(`  → 跳過已有: ${toSkip} 個`);

  const finalTargets = toDo.slice(0, LIMIT);
  console.log(`  → 本次擷取: ${finalTargets.length} 個`);
  console.log('');

  // ── 逐一擷取 ──
  const results        = new Map(existingMechs);
  const pendingModules = new Map();
  let newCount = 0;

  for (let i = 0; i < finalTargets.length; i++) {
    const mech   = finalTargets[i];
    const nameTW = s2t(mech.name);
    process.stdout.write(`  [${i+1}/${finalTargets.length}] ⏳ ${nameTW}...`);

    try {
      const parts = await fetchMechDetail(mech.name);
      if (parts.length === 0) { process.stdout.write(' ✗ 詳情為空\n'); continue; }

      if (DEBUG && i === 0) {
        fs.writeFileSync(
          path.join(DEBUG_DIR, 'aircraft_detail_sample.json'),
          JSON.stringify(parts, null, 2), 'utf-8'
        );
      }

      const currentIndex = existingMechs.size + newCount;
      const mechJson = buildMechJson(parts, currentIndex, firestoreModules, pendingModules);

      await downloadMechImages(mechJson);

      results.set(mech.name, mechJson);
      newCount++;

      process.stdout.write(` ✓ [${mechJson.armorType}/${mechJson.rarity}] 火力:${mechJson.firepower} 閃避:${mechJson.evasion}\n`);
    } catch (err) {
      process.stdout.write(` ✗ ${err.message}\n`);
    }

    if (i < finalTargets.length - 1) await new Promise(r => setTimeout(r, 300));
  }

  // ── 清理 _iconUrl / mechaIcon（內部欄位，不寫入輸出）──
  function cleanMechForOutput(m) {
    const { portraitUrl, lihuiUrl, ...rest } = m;
    if (rest.parts) {
      for (const key of ['torso', 'leftArm', 'rightArm', 'legs']) {
        if (!rest.parts[key]) continue;
        delete rest.parts[key]._iconUrl;
        delete rest.parts[key].mechaIcon;
      }
    }
    return rest;
  }

  // ── 整理輸出（去除內部欄位）──
  const newMechList    = Array.from(results.values())
    .filter(m => !existingMechs.has(t2s(m.name)))
    .map(cleanMechForOutput);
  const newModuleList  = Array.from(pendingModules.values());
  const mechArray      = Array.from(results.values()).map(cleanMechForOutput);

  // ── 差異報告 ──
  console.log('');
  console.log('═══════════════════════════════════════════');
  console.log('📊 差異報告');
  console.log(`   🆕 新增機甲: ${newMechList.length} 個 / 新增模組: ${newModuleList.length} 個 / 合計機甲: ${mechArray.length} 個`);
  if (newMechList.length > 0) {
    newMechList.slice(0, 10).forEach(m => console.log(`     + ${m.name}  [${m.armorType}/${m.rarity}]`));
    if (newMechList.length > 10) console.log(`     ... 及其他 ${newMechList.length - 10} 個`);
  }
  if (newModuleList.length > 0) {
    console.log(`   新模組:`);
    newModuleList.slice(0, 5).forEach(m => console.log(`     + ${m.id}  ${m.name}`));
    if (newModuleList.length > 5) console.log(`     ... 及其他 ${newModuleList.length - 5} 個`);
  }
  console.log('');

  if (newMechList.length + newModuleList.length === 0) {
    console.log('✅ Firestore 已是最新，無需寫入。');
    return;
  }

  // ── 寫入 Firestore（含確認）──
  let mechsWritten   = 0;
  let modulesWritten = 0;

  if (firebaseReady) {
    const confirmed = await promptConfirm(`將 ${newMechList.length} 個機甲 + ${newModuleList.length} 個模組寫入 Firestore？ [y/N] `);
    if (!confirmed) { console.log('已取消。'); process.exit(0); }

    process.stdout.write('🔥 寫入 Firestore...');
    if (newModuleList.length > 0) modulesWritten = await batchWrite('modules', newModuleList);
    if (newMechList.length > 0)   mechsWritten   = await batchWrite('mechs', newMechList);
    console.log(` 機甲 ${mechsWritten} 筆 + 模組 ${modulesWritten} 筆`);
  }

  console.log('');
  console.log('✅ 完成！');
  if (DOWNLOAD_IMG) {
    console.log(`   📁 ${MECHS_DIR}/{機甲名}/portrait.png, half.png, torso.png...`);
  }
}

main().catch(err => {
  console.error('\n❌ 腳本執行失敗：', err.message);
  console.error(err.stack);
  process.exit(1);
});

/**
 * 鋼嵐工具站 — 武器資料擷取腳本 v1
 *
 * 來源：weapon_data API → Firestore weapons collection
 * Schema：PLAN-003（rangeType / minRange / maxRange / mechRestriction / WeaponRarity）
 *
 * 使用方式：
 *   node scripts/scrape-weapons.js --probe --limit=3   ← 印出原始 API 資料（不寫入）
 *   node scripts/scrape-weapons.js --dry-run --limit=3 ← 解析並預覽前 3 筆，不寫入
 *   node scripts/scrape-weapons.js --limit=3           ← 實際寫入前 3 筆（互動確認）
 *   node scripts/scrape-weapons.js                     ← 全量更新（互動確認）
 *   node scripts/scrape-weapons.js --no-images         ← 只更新文字，不下載圖示
 *   node scripts/scrape-weapons.js --force             ← 強制重抓（含已有圖片）
 *   node scripts/scrape-weapons.js --auto              ← 略過確認，直接寫入 Firestore
 *   node scripts/scrape-weapons.js --debug             ← 輸出完整原始欄位
 *
 * 射程解析規則：
 *   "2-4"  → rangeType:'linear', minRange:2, maxRange:4
 *   "2+"   → rangeType:'ring',   minRange:0, maxRange:2
 *   "1"    → rangeType:'linear', minRange:1, maxRange:1（近戰）
 *   無法解析 → rangeType:'linear', minRange:0, maxRange:0，並標記 __REVIEW__
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

// ── 路徑設定 ─────────────────────────────────────────────────────────────────
const API_BASE   = 'https://ma-activity.zlongame.com/common/infodata/mQuery.do';
const APP_KEY    = '1616148215678';
const IMG_BASE   = 'https://media.zlongame.com/media/pictures/cn/community/img/gl/gameInfo';
const WEAPONS_DIR = path.join(__dirname, '../public/images/weapons');

// ── 命令列參數 ────────────────────────────────────────────────────────────────
const args         = process.argv.slice(2);
const PROBE        = args.includes('--probe');    // 印出原始 API JSON，不做解析
const DRY_RUN      = args.includes('--dry-run');  // 解析並預覽，不寫入 Firestore
const DOWNLOAD_IMG = !args.includes('--no-images');
const FORCE        = args.includes('--force');
const DEBUG        = args.includes('--debug');
const AUTO         = args.includes('--auto');
const LIMIT        = (() => {
  const l = args.find(a => a.startsWith('--limit='));
  return l ? parseInt(l.split('=')[1]) : Infinity;
})();

// ── 武器類型映射（API → WeaponType enum 值）──────────────────────────────────
// 含英文（WeaponType1/WeaponType2 可能出現）、簡體、繁體
const WEAPON_TYPE_MAP = {
  // 英文（與 enums.ts WeaponType enum key 一致）
  'Sniper':  '射擊',  // WeaponType.Sniper
  'Melee':   '格鬥',  // WeaponType.Melee
  'Assault': '突擊',  // WeaponType.Assault
  'Heavy':   '戰術',  // WeaponType.Heavy
  // 簡體中文
  '射击': '射擊', '格斗': '格鬥', '突击': '突擊', '战术': '戰術',
  // 繁體直通
  '射擊': '射擊', '格鬥': '格鬥', '突擊': '突擊', '戰術': '戰術',
};

// WeaponType 大分類英文值（與 enums.ts WeaponType enum key 一致）
const WEAPON_TYPE_EN_VALUES = new Set(['Sniper', 'Melee', 'Assault', 'Heavy']);

// 根據兩欄值判斷哪個是大分類（type）、哪個是細分類（kind）
// 官方資料有時 WeaponType1/2 會互換，需透過值的語意來確認
function resolveTypeAndKind(wt1, wt2) {
  const isBroad1 = WEAPON_TYPE_EN_VALUES.has(wt1) || WEAPON_TYPE_MAP[wt1] !== undefined;
  const isBroad2 = WEAPON_TYPE_EN_VALUES.has(wt2) || WEAPON_TYPE_MAP[wt2] !== undefined;
  // 若 wt2 才是大分類（互換情況），交換回來
  if (!isBroad1 && isBroad2) return { typeRaw: wt2, kindRaw: wt1 };
  // 正常情況或無法判斷，預設 wt1=type、wt2=kind
  return { typeRaw: wt1, kindRaw: wt2 };
}

// ── 武器種類映射（API 字串 → WeaponKind enum 值）─────────────────────────────
// 含英文（WeaponType1/WeaponType2 可能出現）、簡體、繁體
const WEAPON_KIND_MAP = {
  // 英文（格鬥類）
  'Shield':      '大盾', 'LargeShield': '大盾',
  'Buckler':     '手盾', 'HandShield':  '手盾',
  'Blade':       '刀劍', 'Sword':       '刀劍',
  'Knuckle':     '拳套',
  'PileBunker':  '打樁機',
  'Chainsaw':    '電鋸',
  'Polearm':     '長柄',
  // 英文（戰術類）
  'Railgun':           '電磁炮',
  'Funnel':            '浮游炮',
  'Missile':           '導彈',
  'Rocket':            '火箭',
  // 英文（突擊類）
  'Shotgun':           '霰彈槍',
  'Machinegun':        '機槍', 'MachineGun':      '機槍',
  'HeavyMachinegun':   '重機槍', 'HeavyMachineGun': '重機槍',
  'Flamethrower':      '噴火器',
  // 英文（射擊類）
  'SniperLight': '輕型狙擊步槍', 'LightSniper': '輕型狙擊步槍',
  'Sniper':      '狙擊步槍',     'HeavySniper': '狙擊步槍',
  // 大小寫變體補充
  'RailGun': '電磁炮', 'ShotGun': '霰彈槍', 'Saw': '電鋸', 'Rod': '長柄',
  // 簡體中文
  '大盾': '大盾', '手盾': '手盾',
  '刀剑': '刀劍', '刀劍': '刀劍',
  '拳套': '拳套',
  '打桩机': '打樁機', '打樁機': '打樁機',
  '电锯': '電鋸',   '電鋸': '電鋸',
  '长柄': '長柄',   '長柄': '長柄',
  '电磁炮': '電磁炮', '電磁炮': '電磁炮',
  '浮游炮': '浮游炮',
  '导弹': '導彈',   '導彈': '導彈',
  '火箭': '火箭',
  '霰弹枪': '霰彈槍', '霰彈槍': '霰彈槍',
  '机枪': '機槍',   '機槍': '機槍',
  '重机枪': '重機槍', '重機槍': '重機槍',
  '喷火器': '噴火器', '噴火器': '噴火器',
  '轻型狙击步枪': '輕型狙擊步槍', '輕型狙擊步槍': '輕型狙擊步槍',
  '狙击步枪': '狙擊步槍',       '狙擊步槍': '狙擊步槍',
};

// ── 武器種類預設值（統一管理；API 無提供時使用）──────────────────────────────
// 欄位：equipSlot / mechRestriction（省略 = 'none'）/ ammoCount / hitCount / rangeType / minRange / maxRange
// 新增種類時在此加一列即可，buildWeaponJson 直接查 kd = KIND_DEFAULTS[kindTW]
const KIND_DEFAULTS = {
  // ── 格鬥類 ──────────────────────────────────────────────────────────────
  '大盾':         { equipSlot: 'dualHand',   ammoCount: 0, hitCount:  1, rangeType: 'linear', minRange: 1, maxRange: 1 },
  '手盾':         { equipSlot: 'singleHand', ammoCount: 0, hitCount:  1, rangeType: 'linear', minRange: 1, maxRange: 1 },
  '刀劍':         { equipSlot: 'singleHand', ammoCount: 0, hitCount:  1, rangeType: 'ring',   minRange: 0, maxRange: 1 },
  '拳套':         { equipSlot: 'singleHand', ammoCount: 0, hitCount:  1, rangeType: 'linear', minRange: 1, maxRange: 1 },
  '打樁機':       { equipSlot: 'singleHand', ammoCount: 0, hitCount:  1, rangeType: 'linear', minRange: 1, maxRange: 1 },
  '電鋸':         { equipSlot: 'dualHand',   ammoCount: 0, hitCount: 10, rangeType: 'ring',   minRange: 0, maxRange: 1 },
  '長柄':         { equipSlot: 'dualHand',   ammoCount: 0, hitCount:  1, rangeType: 'ring',   minRange: 0, maxRange: 1 },
  // ── 戰術類 ──────────────────────────────────────────────────────────────
  '電磁炮':       { equipSlot: 'back',     mechRestriction: 'medium', ammoCount: 3, hitCount:  1, rangeType: 'linear', minRange: 0, maxRange: 5 },
  '浮游炮':       { equipSlot: 'back',     mechRestriction: 'medium', ammoCount: 3, hitCount:  6, rangeType: 'linear', minRange: 1, maxRange: 4 },
  '導彈':         { equipSlot: 'shoulder', mechRestriction: 'medium', ammoCount: 2, hitCount:  1, rangeType: 'linear', minRange: 3, maxRange: 6 },
  '火箭':         { equipSlot: 'shoulder', mechRestriction: 'medium', ammoCount: 1, hitCount:  1, rangeType: 'linear', minRange: 3, maxRange: 6 },
  // ── 突擊類 ──────────────────────────────────────────────────────────────
  '霰彈槍':       { equipSlot: 'singleHand', ammoCount: 0, hitCount: 12, rangeType: 'linear', minRange: 1, maxRange: 2 },
  '機槍':         { equipSlot: 'singleHand', ammoCount: 0, hitCount: 10, rangeType: 'linear', minRange: 1, maxRange: 3 },
  '重機槍':       { equipSlot: 'dualHand',   ammoCount: 0, hitCount: 10, rangeType: 'linear', minRange: 1, maxRange: 3 },
  '噴火器':       { equipSlot: 'singleHand', ammoCount: 0, hitCount:  8, rangeType: 'ring',   minRange: 0, maxRange: 2 },
  // ── 射擊類 ──────────────────────────────────────────────────────────────
  '輕型狙擊步槍': { equipSlot: 'singleHand', ammoCount: 0, hitCount:  1, rangeType: 'linear', minRange: 2, maxRange: 4 },
  '狙擊步槍':     { equipSlot: 'dualHand',   ammoCount: 0, hitCount:  1, rangeType: 'linear', minRange: 2, maxRange: 4 },
};

// ── 稀有度映射（API quality → WeaponRarity enum 值）─────────────────────────
// 對應 enums.ts WeaponRarity（SS / S+ / S / A / B）
const RARITY_FROM_API = {
  SSSR: 'SS',  // 專屬武器
  UR:   'S+',
  SSR:  'S',
  SR:   'A',
  R:    'B',
};

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

async function loadFirestoreWeapons() {
  if (!db) return new Map();
  const snap = await db.collection('weapons').get();
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
function s2t(text) { return text ? _s2t(text) : text; }

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

async function fetchWeaponList() {
  const res = await fetchJson(apiUrl('weapon_data', 'list'));
  return res.data?.data || [];
}

async function fetchWeaponDetail(id) {
  const res = await fetchJson(apiUrl('weapon_data', 'detail', id));
  const d = res.data?.data;
  // 空陣列 = endpoint 無此資料，回傳 null
  if (!d || (Array.isArray(d) && d.length === 0)) return null;
  return d;
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
// 射程解析：range string → { rangeType, minRange, maxRange, needsReview }
// ════════════════════════════════════════════════════════════════════════════
function parseRange(raw) {
  const str = (raw || '').toString().trim();

  // 環形 N 圈：數字後接 "+" 或 "＋"（以持有者為中心的 (2N+1)×(2N+1) 方形區域）
  const ringMatch = str.match(/^(\d+)[+＋]$/);
  if (ringMatch) {
    return { rangeType: 'ring', minRange: 0, maxRange: parseInt(ringMatch[1]), needsReview: false };
  }

  // 線性射程：數字-數字（如 "2-4" 或 "2～4"）
  const linearMatch = str.match(/^(\d+)[-～~](\d+)$/);
  if (linearMatch) {
    return {
      rangeType: 'linear',
      minRange:  parseInt(linearMatch[1]),
      maxRange:  parseInt(linearMatch[2]),
      needsReview: false,
    };
  }

  // 單一數字（固定射程，視為 linear）
  const singleMatch = str.match(/^(\d+)$/);
  if (singleMatch) {
    const n = parseInt(singleMatch[1]);
    return { rangeType: 'linear', minRange: n, maxRange: n, needsReview: false };
  }

  // 無法解析，標記為待審
  return { rangeType: 'linear', minRange: 0, maxRange: 0, needsReview: true };
}

// ════════════════════════════════════════════════════════════════════════════
// 稀有度推斷（quality 欄位優先；名稱規則作 fallback）
//   SSSR → SS（專屬武器）  UR → S+  SSR → S  SR → A  R → B
// ════════════════════════════════════════════════════════════════════════════
function inferRarity(nameTW, isExclusive, apiQuality) {
  if (RARITY_FROM_API[apiQuality]) return RARITY_FROM_API[apiQuality];
  // quality 欄位無法對應時，以名稱特徵推斷
  if (isExclusive) return 'SS';
  if (nameTW.includes('改')) return 'S+';
  if (nameTW.toUpperCase().includes('EX')) return 'S';
  return 'B';
}

// ════════════════════════════════════════════════════════════════════════════
// 組裝武器 JSON（PLAN-003 Schema）
// listItem = 清單 API 回傳的單筆物件；detail = detail API 回傳（可能為 null）
// ════════════════════════════════════════════════════════════════════════════
function buildWeaponJson(listItem, detail, index, prev) {
  // 合併：detail 有值時補充，否則純用清單資料
  const src = (detail && typeof detail === 'object' && !Array.isArray(detail))
    ? { ...listItem, ...detail }
    : { ...listItem };

  // ── 名稱 ──
  const nameCN = src.WeaponName || src.name || '';
  const nameTW = s2t(nameCN);

  // ── 文件 ID ──
  const safeId = nameTW.replace(/[^一-龥a-zA-Z0-9　-〿＀-￯+]/g, '_');
  const id = prev?.id || `weapon_${String(index + 1).padStart(3, '0')}_${safeId}`;

  // ── 武器類型 / 種類（WeaponType enum / WeaponKind enum）──
  // WeaponType1/WeaponType2 官方資料可能互換，以值的語意自動識別
  const wt1 = src.WeaponType1 || src.weaponType1 || src.WeaponType || '';
  const wt2 = src.WeaponType2 || src.weaponType2 || src.type || '';
  const { typeRaw, kindRaw } = resolveTypeAndKind(wt1, wt2);
  const typeTW = WEAPON_TYPE_MAP[typeRaw] || WEAPON_TYPE_MAP[s2t(typeRaw)] || s2t(typeRaw) || '射擊';
  const kindTW = WEAPON_KIND_MAP[kindRaw] || WEAPON_KIND_MAP[s2t(kindRaw)] || s2t(kindRaw) || prev?.kind || '';

  // ── 種類係數 ──
  const kindCoefficient = parseFloat(src.TypeCoefficient ?? src.kindCoefficient ?? prev?.kindCoefficient ?? 1);

  // ── 攻擊力（範圍字串）──
  const atkMin  = src.MinAttack ?? src.minAttack ?? '';
  const atkMax  = src.MaxAttack ?? src.maxAttack ?? '';
  const attack  = atkMin && atkMax ? `${atkMin}~${atkMax}`
                : String(src.Attack ?? src.attack ?? prev?.attack ?? '');

  // ── 命中 / 爆擊值 / 重量 ──
  const accuracy  = parseInt(src.Accuracy  ?? src.accuracy  ?? prev?.accuracy  ?? 0) || 0;
  const critValue = parseInt(src.CritValue ?? src.critValue ?? src.Crit ?? prev?.critValue ?? 0) || 0;
  const weight    = parseInt(src.Weight    ?? src.weight    ?? prev?.weight    ?? 0) || 0;

  // ── 種類預設值（單一來源查表）──
  const kd = KIND_DEFAULTS[kindTW] ?? {};

  // ── 射程解析（API 無法提供時以種類預設值填入）──
  const rawRange = src.Range ?? src.range ?? prev?.__rawRange ?? '';
  let { rangeType, minRange, maxRange, needsReview } = parseRange(rawRange);
  if (needsReview || !rawRange) {
    if (kd.rangeType) { rangeType = kd.rangeType; minRange = kd.minRange; maxRange = kd.maxRange; needsReview = false; }
  }

  // ── 彈藥量（API > prev > 種類預設 > 0）──
  const ammoCount = parseInt(src.AmmoCount ?? src.ammoCount ?? prev?.ammoCount ?? kd.ammoCount ?? 0) || 0;

  // ── 連擊數（API > prev > 種類預設 > 1）──
  const hitCount = parseInt(src.HitCount ?? src.hitCount ?? prev?.hitCount ?? kd.hitCount ?? 1) || 1;

  // ── 機甲限制（API > prev > 種類預設 > none）──
  const mechRaw = src.MechRestriction ?? src.mechRestriction ?? '';
  const mechMap = {
    Heavy: 'heavy', Medium: 'medium', Light: 'light',
    heavy: 'heavy', medium: 'medium', light: 'light',
    '重型': 'heavy', '中甲': 'medium', '中型': 'medium',
    '輕型': 'light', '轻型': 'light',
  };
  const mechRestriction = mechMap[mechRaw] ?? prev?.mechRestriction ?? kd.mechRestriction ?? 'none';

  // ── 裝備部位（equipSlot）──
  const equipSlotRaw = src.EquipSlot ?? src.equipSlot ?? src.WeaponSlot ?? '';
  const equipSlotMap = {
    singleHand: 'singleHand', dualHand: 'dualHand', shoulder: 'shoulder', back: 'back',
    '單手': 'singleHand', '单手': 'singleHand',
    '雙手': 'dualHand',   '双手': 'dualHand',
    '肩膀': 'shoulder',
    '背後': 'back',       '背后': 'back',
  };
  const equipSlot = equipSlotMap[equipSlotRaw] ?? prev?.equipSlot ?? kd.equipSlot ?? 'singleHand';

  // ── 專屬武器 ──
  const apiQuality = src.Quality ?? src.quality ?? src.Rarity ?? '';
  // quality=SSSR 即為專屬武器；也支援 API 有明確旗標的情況
  const isExclusive = apiQuality === 'SSSR' || !!(src.IsExclusive ?? src.isExclusive ?? src.ExclusiveWeapon ?? false);
  const exclusiveFor = s2t(src.ExclusiveFor ?? src.exclusiveFor ?? '') || prev?.exclusiveFor;

  // ── 稀有度（quality 欄位優先） ──
  const rarity = prev?.rarity || inferRarity(nameTW, isExclusive, apiQuality);

  // ── 元件插槽（A/B 稀有度 = 0；其餘 = 3）──
  const hasSlots = rarity !== 'A' && rarity !== 'B';
  const triggerSlots = hasSlots ? 3 : 0;
  const effectSlots  = hasSlots ? 3 : 0;

  // ── 固定改裝 ──
  const fixedMod = prev?.fixedMod ?? {
    planName: s2t(src.FixedModName ?? src.fixedModName ?? ''),
    maxLevel: parseInt(src.FixedModMaxLevel ?? 10) || 10,
    effects:  [],
  };

  // ── 浮動改裝 ──
  const floatingMod = prev?.floatingMod ?? {
    planName:       s2t(src.FloatingModName ?? ''),
    slots:          parseInt(src.FloatingModSlots ?? 3) || 3,
    possibleEffects: [],
  };

  // ── 武器技能 ──
  const skills = prev?.skills ?? buildWeaponSkills(src);

  // ── 圖示 ──
  const iconKey  = src.icon || src.Icon || src.SkillIcon || '';
  const iconPath = iconKey ? `/images/weapons/${iconKey}.png` : (prev?.icon ?? '');
  const iconUrl  = iconKey ? `${IMG_BASE}/weapons/${iconKey}.png` : '';

  const weapon = {
    id,
    name: nameTW,
    type: typeTW,
    kind: kindTW,
    kindCoefficient,
    attack,
    accuracy,
    critValue,
    rangeType:       needsReview ? '__REVIEW__linear' : rangeType,
    minRange:        needsReview ? 0 : minRange,
    maxRange:        needsReview ? 0 : maxRange,
    weight,
    ammoCount,
    hitCount,
    rarity,
    mechRestriction,
    equipSlot,
    isExclusive,
    triggerSlots,
    effectSlots,
    fixedMod,
    floatingMod,
    skills,
    icon: iconPath,
    _iconUrl: iconUrl,
    _rawRange: needsReview ? rawRange : undefined,
  };

  if (exclusiveFor) weapon.exclusiveFor = exclusiveFor;

  return weapon;
}

// ── 武器技能骨架（API 有資料時填入，否則留空陣列供管理員補填）────────────────
function buildWeaponSkills(detail) {
  const skillData = detail.Skills ?? detail.skills ?? detail.WeaponSkills ?? [];
  if (!Array.isArray(skillData) || skillData.length === 0) return [];
  return skillData.map(sk => ({
    name:        s2t(sk.name ?? sk.SkillName ?? ''),
    type:        s2t(sk.type ?? sk.SkillType ?? '被動技能'),
    activation:  sk.activation ?? sk.Activation ?? 'equip',
    description: s2t(cleanRichText(sk.SpecificEffects ?? sk.description ?? sk.describe ?? '')),
    effects:     [],
    buffIds:     [],
  }));
}

// ════════════════════════════════════════════════════════════════════════════
// 主擷取流程
// ════════════════════════════════════════════════════════════════════════════
async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║  鋼嵐工具站 — 武器擷取腳本 v1 (PLAN-003 Schema)   ║');
  console.log('╚══════════════════════════════════════════════════╝');
  const modeLabel = PROBE ? 'PROBE（原始 API）' : DRY_RUN ? 'DRY-RUN（預覽）' : '寫入 Firestore';
  console.log(`  模式: ${modeLabel}  圖示: ${DOWNLOAD_IMG?'✓':'✗'}  上限: ${isFinite(LIMIT)?LIMIT:'全部'}`);
  console.log('');

  // ── 初始化 Firebase（非 PROBE 模式皆需連線）──
  if (!PROBE) {
    const ready = initFirebase();
    if (!ready) {
      console.log('❌ Firebase 未連線，請確認 .env.migration 與服務帳號金鑰。');
      process.exit(1);
    }
    console.log('🔥 Firebase 連線成功');
    console.log('');
  }

  // ── 取得武器清單 ──
  process.stdout.write('📋 取得武器清單...');
  let list;
  try {
    list = await fetchWeaponList();
  } catch (err) {
    console.log(`\n❌ 取得清單失敗: ${err.message}`);
    process.exit(1);
  }
  // 去重（API 可能有重複）
  const seen = new Set();
  list = list.filter(item => {
    const key = item.ID ?? item.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  console.log(` ${list.length} 筆`);

  // ── 套用上限 ──
  if (isFinite(LIMIT)) list = list.slice(0, LIMIT);

  // ── PROBE 模式：印出原始 API JSON 後結束 ──
  if (PROBE) {
    console.log('');
    console.log(`══════════════════ 原始武器清單（${list.length} 筆）══════════════════`);
    console.log(JSON.stringify(list, null, 2));
    console.log('');
    for (let i = 0; i < list.length; i++) {
      const probeId = list[i]?.ID ?? list[i]?.id;
      if (!probeId) continue;
      console.log(`══════════════════ Detail [${i + 1}/${list.length}] ID=${probeId} ══════════════════`);
      try {
        const detail = await fetchWeaponDetail(String(probeId));
        console.log(JSON.stringify(detail, null, 2));
      } catch (err) {
        console.log(`❌ 取得 detail 失敗: ${err.message}`);
      }
    }
    return;
  }

  // ── 載入既有 Firestore 資料 ──
  process.stdout.write('📦 載入 Firestore 武器資料...');
  const existingMap = await loadFirestoreWeapons();
  console.log(` ${existingMap.size} 筆`);
  console.log('');

  if (DOWNLOAD_IMG) fs.mkdirSync(WEAPONS_DIR, { recursive: true });

  // ── 逐筆擷取 detail，組裝 JSON ──
  const results = [];
  let reviewCount = 0;
  let newIconCount = 0;
  let skipIconCount = 0;

  for (let i = 0; i < list.length; i++) {
    const item     = list[i];
    const apiId    = String(item.ID ?? item.id);
    const nameCN   = item.WeaponName ?? item.name ?? '';
    const nameTW   = s2t(nameCN);

    // 以名稱從既有資料查找（保護管理員手動填入的欄位）
    let prev = null;
    for (const [, v] of existingMap) {
      if (v.name === nameTW) { prev = v; break; }
    }

    // 取 detail（可能為 null，此時以清單資料為準）
    let detail = null;
    try {
      detail = await fetchWeaponDetail(apiId);
      await new Promise(r => setTimeout(r, 150));
    } catch (err) {
      console.log(`  [${i+1}/${list.length}] ⚠ ${nameTW || apiId} detail 失敗（略過 detail）: ${err.message}`);
    }

    const weapon = buildWeaponJson(item, detail, i, prev);

    if (weapon.rangeType.startsWith('__REVIEW__')) {
      reviewCount++;
      console.log(`  [${i+1}/${list.length}] ⚠ ${weapon.name} — 射程「${weapon._rawRange}」需人工確認`);
    } else if (DEBUG) {
      console.log(`  [${i+1}/${list.length}] ✓ ${weapon.name} (${weapon.type}/${weapon.kind}, 射程:${weapon.rangeType} ${weapon.minRange}-${weapon.maxRange})`);
    } else {
      process.stdout.write(`  [${i+1}/${list.length}] ✓ ${weapon.name}\n`);
    }

    // ── 下載圖示 ──
    if (DOWNLOAD_IMG && weapon._iconUrl) {
      const iconKey = path.basename(weapon._iconUrl, '.png');
      const dest    = path.join(WEAPONS_DIR, `${iconKey}.png`);
      try {
        const r = await downloadImage(weapon._iconUrl, dest);
        if (r === 'downloaded') newIconCount++;
        else skipIconCount++;
      } catch (err) { console.warn(`  ⚠ 圖示下載失敗 ${iconKey}: ${err.message}`); }
    }

    // 清除腳本內部工作欄位
    const { _iconUrl, _rawRange, ...cleanWeapon } = weapon;
    results.push(cleanWeapon);
  }

  console.log('');
  console.log('═══════════════════════════════════════════════════');
  console.log(`📊 解析結果`);
  console.log(`   共解析: ${results.length} 筆`);
  if (reviewCount > 0) console.log(`   ⚠ 射程需人工確認: ${reviewCount} 筆（rangeType 以 __REVIEW__linear 標記）`);
  if (DOWNLOAD_IMG)    console.log(`   圖示: ${newIconCount} 新 / ${skipIconCount} 已有`);

  // ── DRY RUN：預覽資料後結束 ──
  if (DRY_RUN) {
    console.log('');
    console.log('═══════════════════ DRY RUN 預覽 ═══════════════════');
    results.forEach(w => {
      console.log(`\n── ${w.name} (${w.id})`);
      console.log(`   type: ${w.type} / kind: ${w.kind}`);
      console.log(`   attack: ${w.attack}  accuracy: ${w.accuracy}  critValue: ${w.critValue}  weight: ${w.weight}`);
      console.log(`   rangeType: ${w.rangeType}  minRange: ${w.minRange}  maxRange: ${w.maxRange}`);
      console.log(`   rarity: ${w.rarity}  mechRestriction: ${w.mechRestriction}  equipSlot: ${w.equipSlot}  isExclusive: ${w.isExclusive}`);
      console.log(`   triggerSlots: ${w.triggerSlots}  effectSlots: ${w.effectSlots}`);
      console.log(`   skills: ${w.skills.length} 筆  icon: ${w.icon}`);
    });
    console.log('');
    console.log('（DRY RUN 完成，未寫入 Firestore）');
    return;
  }

  // ── 確認後寫入 Firestore ──
  if (results.length === 0) {
    console.log('⚠ 無可寫入資料。');
    return;
  }

  console.log('');
  const confirmed = await promptConfirm(`將 ${results.length} 筆武器寫入 Firestore weapons 集合？ [y/N] `);
  if (!confirmed) { console.log('已取消。'); process.exit(0); }

  process.stdout.write('🔥 寫入 Firestore...');
  const written = await batchWrite('weapons', results);
  console.log(` ${written} 筆完成`);
  console.log('');
  console.log('✅ 完成！');
  if (reviewCount > 0) {
    console.log(`⚠ 請至 Firestore 搜尋 rangeType 含 "__REVIEW__" 的文件，人工確認射程。`);
  }
}

main().catch(err => {
  console.error('\n❌ 腳本執行失敗：', err.message);
  console.error(err.stack);
  process.exit(1);
});

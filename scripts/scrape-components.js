/**
 * 鋼嵐工具站 — 元件資料擷取腳本 v1
 *
 * 來源：component_props API → Firestore components collection
 * Schema：資料模型文件（docs/02_技術文件/02_資料模型/components.html）
 *
 * 元件圖示說明：
 *   · 元件圖示由兩層構成：
 *     1. 框架圖（statetype_Condition.png / statetype_Function.png）— 靜態資源，須手動放入 public/images/components/
 *     2. 技能圖示（Icon_skill_passive_XXXX.png）— 由腳本自動下載至 public/images/components/
 *   · 顯示時將技能圖示疊於框架圖上即可組成完整元件圖示
 *
 * ConditionType 自動推斷規則（推斷結果建議人工確認）：
 *   · 描述含「两把」/「双持」/「兩把」        → dualWield
 *   · 描述含「单把」/「单武器」/「单一武器」   → singleWield
 *   · 描述含「首次」/「第一次」               → firstAttack
 *   · 描述含「AP」/「行动点」且含「消耗」/「每」→ apCost
 *   · 描述含「躯干」/「軀幹」                 → targetTorso
 *   · 其他                                  → always（預設）
 *
 * EffectType 自動推斷規則（推斷結果建議人工確認）：
 *   · 描述含「子弹数」/「子彈數」              → bulletAdd
 *   · 描述含「倍率」                          → multiplierBoost
 *   · 描述含「破甲」/「装甲」/「裝甲」         → armorBreak
 *   · 描述含「AP」/「行动点」且含「伤害」       → apDmgBoost
 *   · 描述含「躯干」/「軀幹」且含「伤害」       → torsoDmgBoost
 *   · 描述含「伤害」/「傷害」/「%」            → dmgBoost
 *   · 其他                                  → dmgBoost（預設，需人工確認）
 *
 * ComponentsWType 自動推斷規則：
 *   · 名稱含「W」                            → W
 *   · 其他                                  → Normal
 *
 * 使用方式：
 *   node scripts/scrape-components.js --probe --limit=3        ← 印出原始 API 資料（不寫入）
 *   node scripts/scrape-components.js --dry-run --limit=3      ← 解析並預覽前 3 筆，不寫入
 *   node scripts/scrape-components.js --limit=3                ← 實際寫入前 3 筆（互動確認）
 *   node scripts/scrape-components.js                          ← 全量更新（互動確認）
 *   node scripts/scrape-components.js --no-images              ← 只更新文字，不下載圖示
 *   node scripts/scrape-components.js --force                  ← 強制重抓（含已有圖片）
 *   node scripts/scrape-components.js --new-only               ← 只新增不存在的元件（不更新已有資料）
 *   node scripts/scrape-components.js --auto                   ← 略過確認，直接寫入 Firestore
 *   node scripts/scrape-components.js --debug                  ← 輸出完整原始欄位
 *   node scripts/scrape-components.js --type=Function          ← 只處理應元件
 *   node scripts/scrape-components.js --type=Condition         ← 只處理觸元件
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
const API_BASE        = 'https://ma-activity.zlongame.com/common/infodata/mQuery.do';
const APP_KEY         = '1616148215678';
const IMG_BASE        = 'https://media.zlongame.com/media/pictures/cn/community/img/gl/gameInfo';
const COMPONENTS_DIR  = path.join(__dirname, '../public/images/components');

// ── 命令列參數 ────────────────────────────────────────────────────────────────
const args         = process.argv.slice(2);
const PROBE        = args.includes('--probe');
const DRY_RUN      = args.includes('--dry-run');
const DOWNLOAD_IMG = !args.includes('--no-images');
const FORCE        = args.includes('--force');
const DEBUG        = args.includes('--debug');
const AUTO         = args.includes('--auto');
const NEW_ONLY     = args.includes('--new-only');  // 只寫入 Firestore 不存在的元件
const LIMIT        = (() => {
  const l = args.find(a => a.startsWith('--limit='));
  return l ? parseInt(l.split('=')[1]) : Infinity;
})();
// --type=Function 或 --type=Condition：只處理指定類型
const TYPE_FILTER = (() => {
  const t = args.find(a => a.startsWith('--type='));
  return t ? t.split('=')[1].trim() : null;
})();

// ── API ModuleType → ComponentType enum 對應表 ───────────────────────────────
// 原始 API 欄位：ModuleType；對應 enums.ts ComponentType
const MODULE_TYPE_MAP = {
  Condition: 'Condition', // 觸元件
  Function:  'Function',  // 應元件
};

// ── 品質 → ItemRarity 映射（對應 enums.ts ItemRarity）────────────────────────
// 元件稀有度：SSR=金(EX) / SR=紫(S) / R=藍(A)
const RARITY_FROM_QUALITY = {
  SSR:  'S',
  SR:   'A',
  R:    'B',
  UR:   'EX',  // 保險映射
  SSSR: 'EX+',
};

// ── 允許武器種類解析（從 attention 欄位推斷）────────────────────────────────
const ALL_WEAPON_TYPES = ['射擊', '格鬥', '突擊', '戰術'];

function parseAllowedWeaponTypes(attention) {
  if (!attention) return [...ALL_WEAPON_TYPES];
  const lines = attention.split(/\n|■/).map(l => l.trim()).filter(Boolean);
  const restrictLine = lines.find(l => l.includes('限') && l.includes('武器'));
  if (!restrictLine) return [...ALL_WEAPON_TYPES];

  const found = new Set();
  const checks = [
    ['射击', '射擊'], ['射擊', '射擊'],
    ['格斗', '格鬥'], ['格鬥', '格鬥'],
    ['突击', '突擊'], ['突擊', '突擊'],
    ['战术', '戰術'], ['戰術', '戰術'],
  ];
  for (const [cn, tw] of checks) {
    if (restrictLine.includes(cn)) found.add(tw);
  }
  return found.size > 0 ? [...found] : [...ALL_WEAPON_TYPES];
}

// ── ConditionType 推斷（從 ModuleDescription 描述文字）──────────────────────
// 對應 enums.ts ConditionType
function inferConditionType(desc) {
  const d = desc || '';
  if (d.includes('两把') || d.includes('双持') || d.includes('兩把') || d.includes('雙持')) return 'dualWield';
  if (d.includes('单把') || d.includes('單把') || d.includes('单武器') || d.includes('單武器') || d.includes('单一武器')) return 'singleWield';
  if (d.includes('首次') || d.includes('第一次')) return 'firstAttack';
  if ((d.includes('AP') || d.includes('行动点') || d.includes('行動點')) && (d.includes('消耗') || d.includes('每'))) return 'apCost';
  if (d.includes('躯干') || d.includes('軀幹')) return 'targetTorso';
  return 'always';
}

// ── ComponentsWType 推斷（從元件名稱判斷是否含 W 字樣）──────────────────────
// 對應 enums.ts ComponentsWType
function inferComponentsWType(name) {
  return name.includes('W') ? 'W' : 'Normal';
}

// ── EffectType 推斷（從 ModuleDescription 描述文字）────────────────────────
// 對應 enums.ts EffectType
function inferEffectType(desc) {
  const d = desc || '';
  if (d.includes('子弹数') || d.includes('子彈數')) return 'bulletAdd';
  if (d.includes('倍率')) return 'multiplierBoost';
  if (d.includes('破甲') || d.includes('装甲') || d.includes('裝甲')) return 'armorBreak';
  if ((d.includes('AP') || d.includes('行动点') || d.includes('行動點')) && (d.includes('伤害') || d.includes('傷害'))) return 'apDmgBoost';
  if ((d.includes('躯干') || d.includes('軀幹')) && (d.includes('伤害') || d.includes('傷害'))) return 'torsoDmgBoost';
  return 'dmgBoost';
}

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

async function loadFirestoreComponents() {
  if (!db) return new Map();
  const snap = await db.collection('components').get();
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
// 文字清理（去除遊戲 rich text 標記）
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

async function fetchComponentList() {
  const res = await fetchJson(apiUrl('component_props', 'list'));
  return res.data?.data || [];
}

async function fetchComponentDetail(idOrName) {
  const res = await fetchJson(apiUrl('component_props', 'detail', idOrName));
  const d = res.data?.data;
  if (!d || (Array.isArray(d) && d.length === 0)) return null;
  return d;
}

// ════════════════════════════════════════════════════════════════════════════
// 組裝元件 JSON
// listItem = 清單 API 回傳的單筆物件；detail = detail API 回傳（可能為 null）
// prev = Firestore 現有資料（管理員手動填入的欄位以 prev 保護，不被 API 覆蓋）
// ════════════════════════════════════════════════════════════════════════════
function buildComponentJson(listItem, detail, index, prev) {
  // 合併：detail 為陣列時取第一筆（元件 detail 通常為單一物件）
  const src = (() => {
    if (!detail) return { ...listItem };
    if (Array.isArray(detail)) return { ...listItem, ...detail[0] };
    return { ...listItem, ...detail };
  })();

  // ── 名稱 ──
  const nameCN = src.ModuleName || src.name || '';
  const nameTW = s2t(nameCN);

  // ── 文件 ID ──
  const safeId = nameTW.replace(/[^一-龥a-zA-Z0-9　-〿＀-￯+]/g, '_');
  const id = prev?.id || `comp_${String(index + 1).padStart(4, '0')}_${safeId}`;

  // ── 元件類型（API ModuleType → ComponentType enum）──
  const rawModuleType = src.ModuleType ?? src.moduleType ?? '';
  const componentType = MODULE_TYPE_MAP[rawModuleType] ?? prev?.componentType ?? 'Function';

  // ── 子類型（ModuleSubtype enum 對應數字 1–11）──
  const moduleSubtype = parseInt(src.ModuleSubtype ?? src.moduleSubtype ?? prev?.moduleSubtype ?? 0) || 0;

  // ── 等級 ──
  const probabilityLevel = parseInt(src.ProbabilityLevel ?? src.probabilityLevel ?? prev?.probabilityLevel ?? 0) || 0;

  // ── 效果描述 ──
  const rawDesc     = src.ModuleDescription ?? src.moduleDescription ?? src.description ?? '';
  const description = s2t(cleanRichText(rawDesc));

  // ── 允許武器種類（attention 解析；prev 保護管理員手動維護結果）──
  const rawAttention      = src.attention ?? src.Attention ?? '';
  const allowedWeaponTypes = prev?.allowedWeaponTypes ?? parseAllowedWeaponTypes(rawAttention);

  // ── 稀有度（quality 欄位 → ItemRarity enum）──
  const apiQuality = src.quality ?? src.Quality ?? '';
  const rarity     = prev?.rarity ?? RARITY_FROM_QUALITY[apiQuality] ?? apiQuality ?? 'A';

  // ── 圖示（技能圖示 key，框架圖由 componentType 決定，靜態資源不由腳本管理）──
  const iconKey   = src.IconPath ?? src.icon ?? src.Icon ?? '';
  const iconLocal = iconKey ? `/images/components/${iconKey}.png` : (prev?.iconLocal ?? '');
  const _iconUrl  = iconKey ? `${IMG_BASE}/skill/${iconKey}.png` : '';

  // ── ComponentsWType（prev 保護管理員手動設定）──
  const componentsWType = prev?.componentsWType ?? inferComponentsWType(nameTW);

  // ── 組裝基礎物件 ──
  const comp = {
    id,
    name: nameTW,
    componentType,
    moduleSubtype,
    probabilityLevel,
    description,
    allowedWeaponTypes,
    rarity,
    icon:      iconKey,
    iconLocal,
    componentsWType,
    _iconUrl,
  };

  // ── Condition 專用欄位（prev 保護管理員手動設定的 conditionType / condition）──
  if (componentType === 'Condition') {
    comp.conditionType = prev?.conditionType ?? inferConditionType(rawDesc);
    comp.condition     = prev?.condition     ?? description;
  }

  // ── Function 專用欄位（prev 保護管理員手動設定的 effectType）──
  if (componentType === 'Function') {
    comp.effectType = prev?.effectType ?? inferEffectType(rawDesc);
  }

  return comp;
}

// ════════════════════════════════════════════════════════════════════════════
// 主擷取流程
// ════════════════════════════════════════════════════════════════════════════
async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║  鋼嵐工具站 — 元件擷取腳本 v1                      ║');
  console.log('╚══════════════════════════════════════════════════╝');
  const modeLabel = PROBE ? 'PROBE（原始 API）' : DRY_RUN ? 'DRY-RUN（預覽）' : '寫入 Firestore';
  console.log(`  模式: ${modeLabel}  圖示: ${DOWNLOAD_IMG ? '✓' : '✗'}  上限: ${isFinite(LIMIT) ? LIMIT : '全部'}`);
  if (TYPE_FILTER) console.log(`  類型過濾: ${TYPE_FILTER}`);
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

  // ── 取得元件清單 ──
  process.stdout.write('📋 取得元件清單...');
  let list;
  try {
    list = await fetchComponentList();
  } catch (err) {
    console.log(`\n❌ 取得清單失敗: ${err.message}`);
    process.exit(1);
  }

  // 去重（以 ID 為 key）
  const seen = new Set();
  list = list.filter(item => {
    const key = item.ID ?? item.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  console.log(` ${list.length} 筆`);

  // ── 套用類型預篩（在 LIMIT 之前）──
  if (TYPE_FILTER) {
    const before = list.length;
    list = list.filter(item => (item.ModuleType ?? item.moduleType) === TYPE_FILTER);
    console.log(`🔍 類型過濾 (${TYPE_FILTER}): ${before} → ${list.length} 筆`);
  }

  // ── 套用上限 ──
  if (isFinite(LIMIT)) list = list.slice(0, LIMIT);

  // ── PROBE 模式：印出原始 API JSON 後結束 ──
  if (PROBE) {
    console.log('');
    console.log(`══════════════════ 原始元件清單（${list.length} 筆）══════════════════`);
    console.log(JSON.stringify(list, null, 2));
    console.log('');
    for (let i = 0; i < list.length; i++) {
      const probeId = list[i]?.ID ?? list[i]?.id ?? String(i + 1);
      console.log(`══════════════════ Detail [${i + 1}/${list.length}] ID=${probeId} ══════════════════`);
      try {
        const detail = await fetchComponentDetail(probeId);
        console.log(JSON.stringify(detail, null, 2));
      } catch (err) {
        console.log(`❌ 取得 detail 失敗: ${err.message}`);
      }
    }
    return;
  }

  // ── 載入既有 Firestore 資料 ──
  process.stdout.write('📦 載入 Firestore 元件資料...');
  const existingMap = await loadFirestoreComponents();
  console.log(` ${existingMap.size} 筆`);
  console.log('');

  if (DOWNLOAD_IMG) {
    fs.mkdirSync(COMPONENTS_DIR, { recursive: true });
  }

  // ── 逐筆擷取 detail，組裝 JSON ──
  const results = [];
  let newIconCount  = 0;
  let skipIconCount = 0;
  let reviewCount   = 0;

  for (let i = 0; i < list.length; i++) {
    const item   = list[i];
    const apiId  = String(item.ID ?? item.id ?? '');
    const nameCN = item.ModuleName ?? item.name ?? '';
    const nameTW = s2t(nameCN);

    // 以名稱從既有資料查找（保護管理員手動填入的欄位）
    let prev = null;
    for (const [, v] of existingMap) {
      if (v.name === nameTW) { prev = v; break; }
    }

    // 取 detail（以 ID 查詢，無法取得時以清單資料為準）
    let detail = null;
    try {
      detail = await fetchComponentDetail(apiId);
      await new Promise(r => setTimeout(r, 150));
    } catch (err) {
      console.log(`  [${i + 1}/${list.length}] ⚠ ${nameTW || apiId} detail 失敗（略過 detail）: ${err.message}`);
    }

    const isNew = !prev;
    const comp = buildComponentJson(item, detail, i, prev);

    // 標記需人工確認的推斷結果
    const needsReview = (
      (comp.componentType === 'Condition' && comp.conditionType === 'always' && !prev?.conditionType) ||
      (comp.componentType === 'Function'  && comp.effectType === 'dmgBoost'  && !prev?.effectType)
    );
    if (needsReview) reviewCount++;

    if (DEBUG) {
      console.log(`  [${i + 1}/${list.length}] ✓ ${comp.name} (${comp.componentType} / lv.${comp.probabilityLevel} / ${comp.rarity})`);
      console.log(`     moduleSubtype:${comp.moduleSubtype}  icon:${comp.icon}  componentsWType:${comp.componentsWType}`);
      if (comp.componentType === 'Condition') {
        console.log(`     conditionType:${comp.conditionType}  condition:${comp.condition}`);
      } else {
        console.log(`     effectType:${comp.effectType}  desc:${comp.description}`);
      }
      console.log(`     allowedWeaponTypes:[${comp.allowedWeaponTypes.join(', ')}]`);
    } else {
      const reviewNote = needsReview ? ' [⚠需確認類型]' : '';
      process.stdout.write(`  [${i + 1}/${list.length}] ✓ ${comp.name} (${comp.rarity})${reviewNote}\n`);
    }

    // ── 下載技能圖示 ──
    if (DOWNLOAD_IMG && comp._iconUrl) {
      const dest = path.join(COMPONENTS_DIR, `${comp.icon}.png`);
      try {
        const r = await downloadImage(comp._iconUrl, dest);
        if (r === 'downloaded') newIconCount++;
        else skipIconCount++;
      } catch (err) {
        console.warn(`  ⚠ 圖示下載失敗 ${comp.icon}: ${err.message}`);
      }
    }

    // 清除腳本內部工作欄位
    const { _iconUrl, ...cleanComp } = comp;
    results.push({ ...cleanComp, _isNew: isNew });
  }

  console.log('');
  console.log('═══════════════════════════════════════════════════');
  console.log(`📊 解析結果`);
  console.log(`   共解析: ${results.length} 筆`);
  const conditionCount = results.filter(c => c.componentType === 'Condition').length;
  const functionCount  = results.filter(c => c.componentType === 'Function').length;
  console.log(`   觸元件 (Condition): ${conditionCount} 筆 / 應元件 (Function): ${functionCount} 筆`);
  if (NEW_ONLY) {
    const newCount      = results.filter(c => c._isNew).length;
    const existingCount = results.length - newCount;
    console.log(`   新增: ${newCount} 筆 / 已存在(略過): ${existingCount} 筆`);
  }
  if (reviewCount > 0) {
    console.log(`   ⚠ conditionType/effectType 為預設值，建議人工確認: ${reviewCount} 筆`);
  }
  if (DOWNLOAD_IMG) {
    console.log(`   圖示: ${newIconCount} 新下載 / ${skipIconCount} 已有`);
  }

  // ── DRY RUN：預覽資料後結束 ──
  if (DRY_RUN) {
    const previewList = NEW_ONLY ? results.filter(c => c._isNew) : results;
    console.log('');
    console.log('═══════════════════ DRY RUN 預覽 ═══════════════════');
    if (NEW_ONLY) {
      const existingCount = results.length - previewList.length;
      console.log(`🆕 新增元件: ${previewList.length} 筆 / 已存在略過: ${existingCount} 筆`);
    }
    previewList.forEach(c => {
      const newTag = c._isNew ? ' [NEW]' : '';
      console.log(`\n── ${c.name} (${c.id})${newTag}`);
      console.log(`   componentType: ${c.componentType}  moduleSubtype: ${c.moduleSubtype}  rarity: ${c.rarity}`);
      console.log(`   probabilityLevel: ${c.probabilityLevel}`);
      if (c.componentType === 'Condition') {
        console.log(`   conditionType: ${c.conditionType}`);
        console.log(`   condition: ${c.condition}`);
      }
      if (c.componentType === 'Function') {
        console.log(`   effectType: ${c.effectType}`);
      }
      console.log(`   description: ${c.description}`);
      console.log(`   allowedWeaponTypes: [${c.allowedWeaponTypes.join(', ')}]`);
      console.log(`   icon: ${c.icon}  iconLocal: ${c.iconLocal}`);
      console.log(`   componentsWType: ${c.componentsWType}`);
    });
    console.log('');
    console.log('（DRY RUN 完成，未寫入 Firestore）');
    return;
  }

  // ── NEW_ONLY：過濾掉已存在的元件 ──
  let writeList = results.map(({ _isNew, ...c }) => c);
  if (NEW_ONLY) {
    const beforeCount = writeList.length;
    writeList = results.filter(c => c._isNew).map(({ _isNew, ...c }) => c);
    console.log(`🆕 新增元件: ${writeList.length} 筆 / 已存在略過: ${beforeCount - writeList.length} 筆`);
  }

  // ── 確認後寫入 Firestore ──
  if (writeList.length === 0) {
    console.log('⚠ 無可寫入資料（所有元件已存在 Firestore）。');
    return;
  }

  console.log('');
  const confirmed = await promptConfirm(`將 ${writeList.length} 筆元件寫入 Firestore components 集合？ [y/N] `);
  if (!confirmed) { console.log('已取消。'); process.exit(0); }

  process.stdout.write('🔥 寫入 Firestore...');
  const written = await batchWrite('components', writeList);
  console.log(` ${written} 筆完成`);
  console.log('');
  console.log('✅ 完成！');

  if (reviewCount > 0) {
    console.log(`⚠ ${reviewCount} 筆元件的 conditionType/effectType 為自動推斷預設值，建議人工確認：`);
    writeList
      .filter(c =>
        (c.componentType === 'Condition' && c.conditionType === 'always') ||
        (c.componentType === 'Function'  && c.effectType === 'dmgBoost')
      )
      .forEach(c => {
        const typeNote = c.componentType === 'Condition'
          ? `conditionType:${c.conditionType}`
          : `effectType:${c.effectType}`;
        console.log(`   · ${c.name} (${c.id}) — ${typeNote}`);
      });
  }
}

main().catch(err => {
  console.error('\n❌ 腳本執行失敗：', err.message);
  console.error(err.stack);
  process.exit(1);
});

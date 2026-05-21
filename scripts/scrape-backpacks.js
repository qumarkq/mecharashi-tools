/**
 * 鋼嵐工具站 — 背包資料擷取腳本 v2
 *
 * 來源：backpack_data API → Firestore backpacks collection
 * Schema：PLAN-009（BackpackType / AssemblableArmorType / repairAmount / mainSkill）
 *
 * SS 背包（SSSR）技能處理：
 *   · API detail 以 WithPassiveSkills[] 欄位返回技能陣列
 *   · 腳本保護 prev.mainSkill 中管理員手動填入的 dmg/crit/critDmg/acc/specialEffects
 *   · 執行後列出尚無 mainSkill 的 SS 背包清單（理論上不應出現，作為驗證用）
 *
 * 圖片下載：
 *   · 背包圖示下載至 public/images/backpacks/，icon 欄位改為本地路徑
 *   · SS 背包技能圖示下載至 public/images/skills/，mainSkill.icon 同步更新
 *   · 使用 --no-images 略過所有圖片下載
 *   · 使用 --force 強制重新下載（含已有圖片）
 *
 * 使用方式：
 *   node scripts/scrape-backpacks.js --probe --limit=3        ← 印出原始 API 資料（不寫入）
 *   node scripts/scrape-backpacks.js --dry-run --limit=3      ← 解析並預覽前 3 筆，不寫入
 *   node scripts/scrape-backpacks.js --limit=3                ← 實際寫入前 3 筆（互動確認）
 *   node scripts/scrape-backpacks.js                          ← 全量更新（互動確認）
 *   node scripts/scrape-backpacks.js --auto                   ← 略過確認，直接寫入 Firestore
 *   node scripts/scrape-backpacks.js --debug                  ← 輸出完整原始欄位
 *   node scripts/scrape-backpacks.js --no-images              ← 只更新文字，不下載圖示
 *   node scripts/scrape-backpacks.js --force                  ← 強制重抓（含已有圖片）
 *   node scripts/scrape-backpacks.js --rarity=SS              ← 只處理 SS 背包（SSSR）
 *   node scripts/scrape-backpacks.js --rarity=SS,S+           ← 只處理 SS 和 S+ 背包
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
const API_BASE      = 'https://ma-activity.zlongame.com/common/infodata/mQuery.do';
const APP_KEY       = '1616148215678';
const IMG_BASE      = 'https://media.zlongame.com/media/pictures/cn/community/img/gl/gameInfo';
const BACKPACKS_DIR = path.join(__dirname, '../public/images/backpacks');
const SKILLS_DIR    = path.join(__dirname, '../public/images/skills');

// ── 命令列參數 ────────────────────────────────────────────────────────────────
const args         = process.argv.slice(2);
const PROBE        = args.includes('--probe');
const DRY_RUN      = args.includes('--dry-run');
const DEBUG        = args.includes('--debug');
const AUTO         = args.includes('--auto');
const DOWNLOAD_IMG = !args.includes('--no-images');
const FORCE        = args.includes('--force');
const LIMIT   = (() => {
  const l = args.find(a => a.startsWith('--limit='));
  return l ? parseInt(l.split('=')[1]) : Infinity;
})();
const RARITY_FILTER = (() => {
  const r = args.find(a => a.startsWith('--rarity='));
  if (!r) return null;
  return new Set(r.split('=')[1].split(',').map(s => s.trim()));
})();

// ── 稀有度映射（API quality → WeaponRarity enum 值）─────────────────────────
const RARITY_MAP = {
  SSSR: 'SS',
  UR:   'S+',
  SSR:  'S',
  SR:   'A',
  R:    'B',
};

// ── 背包種類（BackpackType，共 11 種）：Heal / Ammo / Interference / Invisible /
//    BackupEquipment / MovePointAdd / Flow / Radar / EMP / Enhance / PowerAdd
//    API BackpackMainType 英文值直接對應 enum 值，無需映射。

// ── 可裝備機甲類型解析（API AssemblableAirmenType → AssemblableArmorType[]）──
// 空值 / 其他 → []（無限制）；'Light'/'Medium'/'Heavy' 或多值（斜線分隔）→ 陣列
const ASSEMBLABLE_KNOWN = new Set(['Light', 'Medium', 'Heavy']);
function parseAssemblableTypes(raw) {
  if (!raw) return [];
  return String(raw).split('/').map(s => s.trim()).filter(s => ASSEMBLABLE_KNOWN.has(s));
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

async function loadFirestoreBackpacks() {
  if (!db) return new Map();
  const snap = await db.collection('backpacks').get();
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
// 圖片下載
// ════════════════════════════════════════════════════════════════════════════
function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
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

// ════════════════════════════════════════════════════════════════════════════
// API 端點
// ════════════════════════════════════════════════════════════════════════════
function apiUrl(target, type, query = '') {
  let url = `${API_BASE}?appkey=${APP_KEY}&target=${target}&type=${type}`;
  if (query) url += `&query=${encodeURIComponent(query)}`;
  return url;
}

async function fetchBackpackList() {
  const res = await fetchJson(apiUrl('backpack_data', 'list'));
  return res.data?.data || [];
}

async function fetchBackpackDetail(id) {
  const res = await fetchJson(apiUrl('backpack_data', 'detail', id));
  const d = res.data?.data;
  if (!d || (Array.isArray(d) && d.length === 0)) return null;
  return d;
}

// ════════════════════════════════════════════════════════════════════════════
// 文字清理（rich text 標籤）
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
// 組裝背包 JSON（PLAN-009 Schema）
// listItem = 清單 API 回傳的單筆物件；detail = detail API 回傳（可能為 null）
// prev = Firestore 既有資料（可能為 null）
// ════════════════════════════════════════════════════════════════════════════
function buildBackpackJson(listItem, detail, prev) {
  // 合併：detail 為陣列時取第一筆，否則直接合併（或僅用清單資料）
  const src = (() => {
    if (!detail) return { ...listItem };
    if (Array.isArray(detail)) return { ...listItem, ...detail[0] };
    return { ...listItem, ...detail };
  })();

  // ── 文件 ID：直接使用 API ID（數字字串） ──
  const apiId = String(src.ID ?? src.id ?? listItem.ID ?? listItem.id ?? '');
  const id = apiId;

  // ── 名稱 ──
  const nameTW = s2t(src.name ?? src.Name ?? '');

  // ── 背包種類（BackpackType enum）──
  // API: BackpackMainType；英文值與 enum 值完全一致（Heal/Ammo/…）
  const type = src.BackpackMainType ?? src.backpackMainType ?? prev?.type ?? '';

  // ── 稀有度（WeaponRarity enum）──
  const apiQuality = src.Quality ?? src.quality ?? '';
  const rarity = RARITY_MAP[apiQuality] ?? prev?.rarity ?? 'B';

  // ── 重量（頂層 weight 欄位；勿與 WithPassiveSkills 內的排序用 weight 混用）──
  const weight = parseInt(src.weight ?? src.Weight ?? prev?.weight ?? 0) || 0;

  // ── 裝配位置（背包固定背部，對齊 WeaponEquipSlot.BACK）──
  const slot = 'back';

  // ── 圖示（API icon 欄位為正確的 icon key，非 apiId）──
  const iconKey      = src.icon ?? src.BackpackIcon ?? src.backpackIcon ?? `Icon_backpack_${apiId}`;
  const iconFilename = `${iconKey}.png`;
  const _iconUrl     = `${IMG_BASE}/pack/${iconFilename}`;
  const icon         = `/images/backpacks/${iconFilename}`;

  // ── 可裝備機甲類型（正向邏輯，陣列）──
  // API AssemblableAirmenType："Light" / "Medium" / "Heavy" / 斜線分隔多值 / 空白
  // 空陣列 = 無限制（所有機甲皆可裝備）
  const rawAssemblable = src.AssemblableAirmenType ?? src.assemblableAirmenType ?? '';
  const assemblableArmorType = parseAssemblableTypes(rawAssemblable);

  // ── 修理量 ──
  const repairAmount = parseInt(src.AmountOfRepair ?? src.amountOfRepair ?? 0) || 0;

  // ── mainSkill（僅 SS / SSSR 稀有度）──
  const isSSS = apiQuality === 'SSSR' || rarity === 'SS';
  const mainSkill = buildMainSkill(src, prev, isSSS);

  const backpack = {
    id,
    name:                nameTW,
    icon,
    _iconUrl,
    type,
    rarity,
    weight,
    slot,
    assemblableArmorType,
    repairAmount,
  };

  if (mainSkill) backpack.mainSkill = mainSkill;

  return backpack;
}

// ── mainSkill 解析（API WithPassiveSkills[0] → mainSkill object）────────────
// 保護管理員手動填入的 dmg/crit/critDmg/acc/specialEffects
function buildMainSkill(src, prev, isSSS) {
  if (!isSSS) return null;

  const skills = src.WithPassiveSkills ?? src.withPassiveSkills ?? [];
  if (!Array.isArray(skills) || skills.length === 0) {
    // SSSR 背包但 API 無技能資料：保留既有 mainSkill（若有）
    return prev?.mainSkill ?? null;
  }

  const sk = skills[0];
  const rawIconKey = sk.SkillIcon ?? sk.icon ?? sk.skillIcon ?? '';
  const iconKey    = rawIconKey.endsWith('.png') ? rawIconKey.slice(0, -4) : rawIconKey;
  const iconPath   = iconKey ? `/images/skills/${iconKey}.png` : '';
  const bufCarried = sk.BufCarried ?? sk.bufCarried ?? '';
  const buffIds = bufCarried ? bufCarried.split('/').filter(Boolean) : [];

  // 從既有資料取出管理員手動填入欄位（保護，不覆蓋）
  const prevSkill = prev?.mainSkill ?? {};
  const manualFields = {};
  if (prevSkill.dmg          != null) manualFields.dmg          = prevSkill.dmg;
  if (prevSkill.crit         != null) manualFields.crit         = prevSkill.crit;
  if (prevSkill.critDmg      != null) manualFields.critDmg      = prevSkill.critDmg;
  if (prevSkill.acc          != null) manualFields.acc          = prevSkill.acc;
  if (prevSkill.specialEffects != null) manualFields.specialEffects = prevSkill.specialEffects;

  return {
    id:          sk.ID ?? sk.id ?? '',
    name:        s2t(sk.name ?? sk.SkillName ?? ''),
    ...(iconPath ? { icon: iconPath } : {}),
    description: s2t(cleanRichText(sk.SpecificEffects ?? sk.specificEffects ?? sk.description ?? '')),
    buffIds,
    ...manualFields,
  };
}

// ════════════════════════════════════════════════════════════════════════════
// 主擷取流程
// ════════════════════════════════════════════════════════════════════════════
async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║  鋼嵐工具站 — 背包擷取腳本 v1 (PLAN-009 Schema)   ║');
  console.log('╚══════════════════════════════════════════════════╝');
  const modeLabel = PROBE ? 'PROBE（原始 API）' : DRY_RUN ? 'DRY-RUN（預覽）' : '寫入 Firestore';
  console.log(`  模式: ${modeLabel}  上限: ${isFinite(LIMIT) ? LIMIT : '全部'}`);
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

  // ── 取得背包清單 ──
  process.stdout.write('📋 取得背包清單...');
  let list;
  try {
    list = await fetchBackpackList();
  } catch (err) {
    console.log(`\n❌ 取得清單失敗: ${err.message}`);
    process.exit(1);
  }

  // 去重（API 可能有重複）
  const seen = new Set();
  list = list.filter(item => {
    const key = String(item.ID ?? item.id ?? '');
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  console.log(` ${list.length} 筆`);

  // ── 套用稀有度預篩（在 LIMIT 之前）──
  if (RARITY_FILTER) {
    const before = list.length;
    list = list.filter(item => {
      const r = RARITY_MAP[item.quality ?? item.Quality ?? ''] ?? '';
      return RARITY_FILTER.has(r);
    });
    console.log(`🔍 稀有度過濾 (${[...RARITY_FILTER].join('/')}): ${before} → ${list.length} 筆`);
  }

  // ── 套用上限 ──
  if (isFinite(LIMIT)) list = list.slice(0, LIMIT);

  // ── PROBE 模式：印出原始 API JSON 後結束 ──
  if (PROBE) {
    console.log('');
    console.log(`══════════════════ 原始背包清單（${list.length} 筆）══════════════════`);
    console.log(JSON.stringify(list, null, 2));
    console.log('');
    for (let i = 0; i < list.length; i++) {
      const apiId = String(list[i]?.ID ?? list[i]?.id ?? '');
      if (!apiId) continue;
      console.log(`══════════════════ Detail [${i + 1}/${list.length}] ID=${apiId} ══════════════════`);
      try {
        const detail = await fetchBackpackDetail(apiId);
        console.log(JSON.stringify(detail, null, 2));
      } catch (err) {
        console.log(`❌ 取得 detail 失敗: ${err.message}`);
      }
    }
    return;
  }

  // ── 載入既有 Firestore 資料 ──
  process.stdout.write('📦 載入 Firestore 背包資料...');
  const existingMap = await loadFirestoreBackpacks();
  console.log(` ${existingMap.size} 筆`);
  console.log('');

  // ── 初始化圖片目錄 ──
  if (DOWNLOAD_IMG) {
    ensureDir(BACKPACKS_DIR);
    ensureDir(SKILLS_DIR);
  }

  // ── 逐筆擷取 detail，組裝 JSON ──
  const results = [];
  let newIconCount   = 0;
  let skipIconCount  = 0;
  let skillIconCount = 0;

  for (let i = 0; i < list.length; i++) {
    const item  = list[i];
    const apiId = String(item.ID ?? item.id ?? '');

    // 從既有資料查找（保護管理員手動填入的欄位）
    const prev = existingMap.get(apiId) ?? null;

    // 取 detail（以背包 ID 查詢）
    let detail = null;
    try {
      detail = await fetchBackpackDetail(apiId);
      await new Promise(r => setTimeout(r, 150));
    } catch (err) {
      console.log(`  [${i+1}/${list.length}] ⚠ ID=${apiId} detail 失敗（略過 detail）: ${err.message}`);
    }

    const backpack = buildBackpackJson(item, detail, prev);

    const hasMainSkill   = !!backpack.mainSkill;
    const needsMainSkill = backpack.rarity === 'SS' && !hasMainSkill;

    if (DEBUG) {
      console.log(`  [${i+1}/${list.length}] ✓ ${backpack.name} (${backpack.type}, ${backpack.rarity}, ${backpack.assemblableArmorType})${needsMainSkill ? ' ⚠技能待補' : hasMainSkill ? ` [mainSkill:${backpack.mainSkill.name}]` : ''}`);
    } else {
      const skillNote = hasMainSkill ? ` [mainSkill:✓]` : needsMainSkill ? ` [⚠SS無技能]` : '';
      process.stdout.write(`  [${i+1}/${list.length}] ✓ ${backpack.name}${skillNote}\n`);
    }

    // ── 下載背包圖示 ──
    if (DOWNLOAD_IMG && backpack._iconUrl) {
      const dest = path.join(BACKPACKS_DIR, path.basename(backpack._iconUrl));
      try {
        const r = await downloadImage(backpack._iconUrl, dest);
        if (r === 'downloaded') newIconCount++;
        else skipIconCount++;
      } catch (err) {
        console.warn(`  ⚠ 背包圖示下載失敗 ${apiId}: ${err.message}`);
      }
    }

    // ── 下載技能圖示（SS 背包） ──
    if (DOWNLOAD_IMG && hasMainSkill && backpack.mainSkill.icon) {
      const rawIcon = backpack.mainSkill.icon;
      const isUrl   = rawIcon.startsWith('http');
      // icon 現在存為 /images/skills/xxx.png，取 basename 作為 iconKey
      const iconKey = path.basename(rawIcon, '.png');
      const iconUrl = isUrl ? rawIcon : `${IMG_BASE}/skill/${iconKey}.png`;
      const dest    = path.join(SKILLS_DIR, `${iconKey}.png`);
      try {
        await downloadImage(iconUrl, dest);
        skillIconCount++;
      } catch (err) {
        console.warn(`  ⚠ 技能圖示下載失敗 ${iconKey}: ${err.message}`);
      }
    }

    // 清除腳本內部工作欄位
    const { _iconUrl, ...cleanBackpack } = backpack;
    results.push(cleanBackpack);
  }

  console.log('');
  console.log('═══════════════════════════════════════════════════');
  console.log(`📊 解析結果`);
  console.log(`   共解析: ${results.length} 筆`);
  if (DOWNLOAD_IMG) {
    console.log(`   背包圖示: ${newIconCount} 新 / ${skipIconCount} 已有`);
    if (skillIconCount > 0) console.log(`   技能圖示: ${skillIconCount} 筆`);
  }

  // ── SS 背包技能檢查 ──
  const ssNoSkill  = results.filter(b => b.rarity === 'SS' && !b.mainSkill);
  const ssHasSkill = results.filter(b => b.rarity === 'SS' &&  b.mainSkill);
  if (ssHasSkill.length > 0) console.log(`   SS 背包（已有 mainSkill）: ${ssHasSkill.length} 筆`);
  if (ssNoSkill.length > 0) {
    console.log(`   ⚠ SS 背包（尚無 mainSkill，需確認）: ${ssNoSkill.length} 筆`);
    ssNoSkill.forEach(b => console.log(`     · ${b.name} (${b.id})`));
  }

  // ── DRY RUN：預覽資料後結束 ──
  if (DRY_RUN) {
    console.log('');
    console.log('═══════════════════ DRY RUN 預覽 ═══════════════════');
    results.forEach(b => {
      console.log(`\n── ${b.name} (${b.id})`);
      console.log(`   icon: ${b.icon}`);
      console.log(`   type: ${b.type}  rarity: ${b.rarity}  weight: ${b.weight}`);
      console.log(`   slot: ${b.slot}  assemblableArmorType: ${b.assemblableArmorType}  repairAmount: ${b.repairAmount}`);
      if (b.mainSkill) {
        console.log(`   mainSkill: ${b.mainSkill.name} (id:${b.mainSkill.id}${b.mainSkill.icon ? ` icon:${b.mainSkill.icon}` : ''})`);
        if (b.mainSkill.buffIds?.length) console.log(`     buffIds: ${b.mainSkill.buffIds.join(', ')}`);
        if (b.mainSkill.description) console.log(`     description: ${b.mainSkill.description.slice(0, 80)}…`);
      }
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
  const confirmed = await promptConfirm(`將 ${results.length} 筆背包寫入 Firestore backpacks 集合？ [y/N] `);
  if (!confirmed) { console.log('已取消。'); process.exit(0); }

  process.stdout.write('🔥 寫入 Firestore...');
  const written = await batchWrite('backpacks', results);
  console.log(` ${written} 筆完成`);
  console.log('');
  console.log('✅ 完成！');
  if (ssNoSkill.length > 0) {
    console.log(`⚠ ${ssNoSkill.length} 筆 SS 背包尚無 mainSkill，請確認 API 是否有 WithPassiveSkills 資料。`);
    ssNoSkill.forEach(b => console.log(`   · ${b.name} (${b.id})`));
  }
}

main().catch(err => {
  console.error('\n❌ 腳本執行失敗：', err.message);
  console.error(err.stack);
  process.exit(1);
});

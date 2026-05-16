/**
 * 鋼嵐工具站 — 機師資料擷取腳本 v3 (API 版)
 *
 * 直接透過官方 WIKI API 取得資料，無需瀏覽器（速度快、穩定）。
 *
 * 功能：
 *   1. 從官方 API 取得 S 級（SSR）機師列表
 *   2. 擷取完整資料：六維、天賦、神經驅動、算力(仿生電腦)
 *   3. 下載機師半身像到 public/images/pilots/{機師名}.png
 *   4. 下載大立繪到 public/images/pilots/{機師名}/full.png
 *   5. 下載技能圖示到 public/images/skills/
 *   6. 輸出 public/data/pilots.json（繁體中文）
 *
 * 使用方式：
 *   node scripts/scrape-pilots-v3.js                     ← 全量 S 級機師
 *   node scripts/scrape-pilots-v3.js --pilot=葉夫根尼     ← 指定單一機師（繁體輸入）
 *   node scripts/scrape-pilots-v3.js --no-images          ← 只取文字不下載圖片
 *   node scripts/scrape-pilots-v3.js --force              ← 強制重抓（忽略已有資料）
 *   node scripts/scrape-pilots-v3.js --limit=3            ← 只跑前 N 個
 *   node scripts/scrape-pilots-v3.js --all                ← 含 SR/R 級別
 *   node scripts/scrape-pilots-v3.js --debug              ← 輸出 debug 資訊
 *   node scripts/scrape-pilots-v3.js --fetch-portraits    ← 僅補下載大立繪（無需重打 API）
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
// const OUTPUT_JSON = path.join(__dirname, '../public/data/pilots.json');  // 已停用：資料改由 Firestore 管理
const PILOTS_DIR  = path.join(__dirname, '../public/images/pilots');
const SKILLS_DIR  = path.join(__dirname, '../public/images/skills');

// ── 命令列參數 ────────────────────────────────────────────────
const args             = process.argv.slice(2);
const DOWNLOAD_IMG     = !args.includes('--no-images');
const FORCE            = args.includes('--force');
const ALL_QUALITY      = args.includes('--all');
const DEBUG            = args.includes('--debug');
const AUTO             = args.includes('--auto');    // 略過確認，直接寫入 Firestore
// --fetch-portraits 模式依賴本地 JSON，已停用（改用 --force 重新擷取）
// const FETCH_PORTRAITS  = args.includes('--fetch-portraits');
const SINGLE_PILOT_RAW = (args.find(a => a.startsWith('--pilot=')) || '').split('=')[1] || '';
const LIMIT            = (() => {
  const l = args.find(a => a.startsWith('--limit='));
  return l ? parseInt(l.split('=')[1]) : Infinity;
})();

// ════════════════════════════════════════════════════════════
// Firebase Admin 初始化
// ════════════════════════════════════════════════════════════
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

async function loadFirestorePilots() {
  if (!db) return new Map();
  const snap = await db.collection('pilots').get();
  const map  = new Map();
  for (const doc of snap.docs) {
    const data = { id: doc.id, ...doc.data() };
    if (data.name) map.set(t2s(data.name), data);
  }
  return map;
}

async function batchWrite(collectionName, docs) {
  if (!db || docs.length === 0) return 0;
  let written = 0;
  for (let i = 0; i < docs.length; i += 500) {
    const batch = db.batch();
    docs.slice(i, i + 500).forEach(d => {
      batch.set(db.collection(collectionName).doc(d.id), d);
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

// ════════════════════════════════════════════════════════════
// 中文轉換（OpenCC）
// ════════════════════════════════════════════════════════════
const _s2t = OpenCC.Converter({ from: 'cn', to: 'tw' });
const _t2s = OpenCC.Converter({ from: 'tw', to: 'cn' });

function s2t(text) { return text ? _s2t(text) : text; }
function t2s(text) { return text ? _t2s(text) : text; }

// --pilot 繁體輸入 → 簡體比對
const SINGLE_PILOT_CN = SINGLE_PILOT_RAW ? t2s(SINGLE_PILOT_RAW) : '';

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
  if (query) url += `&query=${query}`;
  return url;
}

async function fetchPilotList() {
  const res = await fetchJson(apiUrl('pilot_data', 'list'));
  // API 有重複資料，依 ID 去重
  const seen = new Set();
  return res.data.data.filter(p => {
    if (seen.has(p.ID)) return false;
    seen.add(p.ID);
    return true;
  });
}

async function fetchPilotDetail(id) {
  const res = await fetchJson(apiUrl('pilot_data', 'detail', id));
  return res.data.data;
}

// ════════════════════════════════════════════════════════════
// 大立繪 URL 推導（characterHalf → character，_half → _Raw）
// ════════════════════════════════════════════════════════════
function deriveFullPortraitUrl(halfPortraitUrl) {
  if (!halfPortraitUrl) return '';
  return halfPortraitUrl
    .replace('/characterHalf/', '/character/')
    .replace(/_half\.png$/, '_Raw.png');
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
// 職業名稱映射
// ════════════════════════════════════════════════════════════
const PROFESSION_MAP = {
  'Defender': '守護者',
  'Assault': '突擊手',
  'Striker': '格鬥家',
  'Sniper': '狙擊手',
  'Tactician': '戰術家',
  'Engineer': '機械師',
};

const DRIVE_MAP = {
  'Heavy': '重型',
  'Medium': '中型',
  'Light': '輕型',
};

// ════════════════════════════════════════════════════════════
// 組裝機師 JSON
// ════════════════════════════════════════════════════════════
function buildPilotJson(detail, index) {
  const nameTW = s2t(detail.PilotName || detail.name);
  const safeName = nameTW.replace(/[^一-龥a-zA-Z0-9\u3000-\u303f\uff00-\uffef]/g, '');
  const id = `pilot_${String(index + 1).padStart(3, '0')}_${safeName}`;

  // 基本六維（初始）
  const statsBase = {
    melee:       parseInt(detail.Combat) || 0,
    assault:     parseInt(detail.Assault) || 0,
    shooting:    parseInt(detail.Shooting) || 0,
    tactics:     parseInt(detail.Tactics) || 0,
    defense:     parseInt(detail.Defense) || 0,
    engineering: parseInt(detail.Engineering) || 0,
  };

  // 滿級六維
  const manji = detail.manji || {};
  const stats = {
    melee:       parseInt(manji.Combat) || statsBase.melee,
    assault:     parseInt(manji.Assault) || statsBase.assault,
    shooting:    parseInt(manji.Shooting) || statsBase.shooting,
    tactics:     parseInt(manji.Tactics) || statsBase.tactics,
    defense:     parseInt(manji.Defense) || statsBase.defense,
    engineering: parseInt(manji.Engineering) || statsBase.engineering,
  };

  // AP
  const apBase = {
    init:     parseInt(detail.InitialPilotAPValue_PilotAPInitBase) || 0,
    max:      parseInt(detail.MaximumPilotAPValue_PilotAPMaxBase) || 0,
    recovery: parseInt(detail.PilotAPRecoveryperTurn_PilotAPRecoverBase) || 0,
  };
  const ap = {
    init:     parseInt(manji.InitialPilotAPValue_PilotAPInitBase) || apBase.init,
    max:      parseInt(manji.MaximumPilotAPValue_PilotAPMaxBase) || apBase.max,
    recovery: parseInt(manji.PilotAPRecoveryperTurn_PilotAPRecoverBase) || apBase.recovery,
  };

  // 天賦
  const talents = [];
  const talentBase = detail.Talent0_2Ability;
  const talentMax  = detail.Talent3_5Ability;
  if (talentBase) {
    talents.push({
      name:        s2t(talentBase.name),
      type:        '被動技能',
      description: s2t(cleanRichText(talentBase.SpecificEffects)),
      descriptionMax: talentMax ? s2t(cleanRichText(talentMax.SpecificEffects)) : '',
      icon:        talentBase.SkillIcon,
      iconLocal:   `/images/skills/${talentBase.SkillIcon}.png`,
      dmg: 0, crit: 0, critDmg: 0, acc: 0,
    });
  }

  // 神經驅動
  const neuralDrive = [];
  const ndTemplate = detail.NeuralDriveTemplate;
  if (ndTemplate?.ListChipPartition) {
    for (const zone of ndTemplate.ListChipPartition) {
      const chipTypes = (zone.ListAssembled || '').split('/').filter(Boolean);
      const slots = chipTypes.map((type, i) => s2t(`插槽${['一','二','三'][i] || i+1}：${type}芯片`));

      const levels = (zone.ListActivationEffects || []).map((eff, i) => ({
        level:      i + 1,
        minSum:     parseInt(eff.MinimumSum) || 0,
        effect:     s2t(cleanRichText(eff.PassiveSkill?.SpecificEffects || '')),
        skillName:  s2t(eff.PassiveSkill?.name || ''),
        skillIcon:  eff.PassiveSkill?.SkillIcon || '',
        iconLocal:  eff.PassiveSkill?.SkillIcon ? `/images/skills/${eff.PassiveSkill.SkillIcon}.png` : '',
      }));

      neuralDrive.push({
        name:  s2t(zone.name || ''),
        icon:  zone.IconPath || '',
        slots,
        levels,
        dmg: 0, crit: 0, critDmg: 0, acc: 0,
      });
    }
  }

  // 算力（仿生電腦）
  const biometicComputer = [];
  if (detail.biomimetic_computer_data) {
    for (const unit of detail.biomimetic_computer_data) {
      const entry = {
        id:        unit.ID,
        unitName:  s2t(unit.UnitName || ''),
        title:     s2t(unit.TitleUnitDetails || ''),
        unitType:  unit.UnitType,
        location:  unit.LocationOnMap,
        icon:      unit.icon || '',
      };

      if (unit.skill) {
        entry.skill = {
          id:          unit.skill.ID,
          name:        s2t(unit.skill.name || ''),
          type:        unit.skill.type || '',
          ap:          unit.skill.Ap || '',
          weapon:      s2t(unit.skill.matchingWeaponType || ''),
          description: s2t(cleanRichText(unit.skill.SpecificEffects || unit.skill.describe || '')),
          icon:        unit.skill.SkillIcon || '',
          iconLocal:   unit.skill.SkillIcon ? `/images/skills/${unit.skill.SkillIcon}.png` : '',
        };
      }

      if (unit.AttributeBonus) {
        entry.attributeBonus = unit.AttributeBonus;
      }

      biometicComputer.push(entry);
    }
  }

  // 從仿生電腦提取戰鬥技能
  const skills = biometicComputer
    .filter(u => u.skill)
    .map(u => ({
      name:        u.skill.name,
      type:        u.skill.type === 'EquipmentSkill' ? '主動技能' :
                   u.skill.type === 'Order' ? '指令技能' :
                   u.skill.type === 'SpecialAssault' ? '必殺技能' :
                   u.skill.type === 'PassiveSkill' ? '被動技能' :
                   (!u.skill.type || u.skill.type === '') ? '被動技能' :
                   s2t(u.skill.type || ''),
      ap:          u.skill.ap || '',
      weapon:      u.skill.weapon,
      description: u.skill.description,
      icon:        u.skill.icon,
      iconLocal:   u.skill.iconLocal,
      dmg: 0, crit: 0, critDmg: 0, acc: 0,
    }))
    .filter((s, i, arr) => arr.findIndex(x => x.name === s.name) === i); // 去重

  // 額外資訊
  const additionalInfo = {};
  if (detail.AdditionalInformation) {
    for (const item of detail.AdditionalInformation) {
      additionalInfo[s2t(item.AdditionalInformationTitle || '')] = s2t(item.AdditionalInformationContent || '');
    }
  }

  return {
    id,
    name:        nameTW,
    fullName:    s2t(detail.RealName || detail.PilotName),
    rarity:      detail.quality === 'SSR' ? 'S' : detail.quality,
    class:       PROFESSION_MAP[detail.Profession] || s2t(detail.Occupation || detail.Profession || ''),
    faction:     s2t(detail.Camp || ''),
    license:     DRIVE_MAP[detail.AllowedMechaDriveList_DriveAllowedList] || s2t(detail.AllowedMechaDriveList_DriveAllowedList || ''),
    masterLevel: s2t(manji.MechaDriveLevel || detail.MechaDriveLevel || ''),
    profile: {
      gender:    detail.Gender === 'Male' ? '男' : detail.Gender === 'Female' ? '女' : detail.Gender || '',
      bloodType: detail.BloodType || '',
      height:    detail.Height || '',
      additionalInfo,
    },
    stats,
    statsBase,
    ap,
    apBase,
    talents,
    skills,
    neuralDrive,
    biometicComputer,
    portrait:         `/images/pilots/${safeName}/half.png`,
    fullPortrait:     `/images/pilots/${safeName}/full.png`,
    portraitUrl:      `${IMG_BASE}/characterHalf/${detail.icon || detail.PortraitHeroIcon}.png`,
    fullPortraitUrl:  deriveFullPortraitUrl(`${IMG_BASE}/characterHalf/${detail.icon || detail.PortraitHeroIcon}.png`),
    lore:             s2t(detail.Introduction || ''),
    attack:  0,
    defense: 0,
  };
}

// ════════════════════════════════════════════════════════════
// 圖片下載
// ════════════════════════════════════════════════════════════
async function downloadPilotImages(pilot, detail) {
  if (!DOWNLOAD_IMG) return;

  const safeName = pilot.name.replace(/[^一-龥a-zA-Z0-9\u3000-\u303f\uff00-\uffef]/g, '');
  const pilotSubDir = path.join(PILOTS_DIR, safeName);
  fs.mkdirSync(pilotSubDir, { recursive: true });

  // 半身像（存入子資料夾 half.png）
  const halfDest = path.join(pilotSubDir, 'half.png');
  try {
    await downloadImage(pilot.portraitUrl, halfDest);
    if (DEBUG) process.stdout.write(` [半身✓]`);
  } catch (e) {
    if (DEBUG) process.stdout.write(` [半身✗: ${e.message}]`);
  }

  // 大立繪（full.png）
  if (pilot.fullPortraitUrl) {
    const fullDest = path.join(pilotSubDir, 'full.png');
    try {
      await downloadImage(pilot.fullPortraitUrl, fullDest);
      if (DEBUG) process.stdout.write(` [立繪✓]`);
    } catch (e) {
      if (DEBUG) process.stdout.write(` [立繪✗: ${e.message}]`);
    }
  }

  // 天賦技能圖示
  for (const talent of pilot.talents) {
    if (talent.icon) {
      const dest = path.join(SKILLS_DIR, `${talent.icon}.png`);
      const url  = `${IMG_BASE}/skill/${talent.icon}.png`;
      try { await downloadImage(url, dest); } catch {}
    }
  }

  // 戰鬥技能圖示
  for (const skill of pilot.skills) {
    if (skill.icon) {
      const dest = path.join(SKILLS_DIR, `${skill.icon}.png`);
      const url  = `${IMG_BASE}/skill/${skill.icon}.png`;
      try { await downloadImage(url, dest); } catch {}
    }
  }

  // 神經驅動技能圖示
  for (const zone of pilot.neuralDrive) {
    for (const level of zone.levels) {
      if (level.skillIcon) {
        const dest = path.join(SKILLS_DIR, `${level.skillIcon}.png`);
        const url  = `${IMG_BASE}/skill/${level.skillIcon}.png`;
        try { await downloadImage(url, dest); } catch {}
      }
    }
  }
}

// ════════════════════════════════════════════════════════════
// 主流程
// ════════════════════════════════════════════════════════════
async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║  鋼嵐工具站 — 機師擷取腳本 v4 (Firebase 版)  ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log(`  圖片: ${DOWNLOAD_IMG ? '✓' : '✗'}  強制: ${FORCE ? '✓' : '✗'}  全品質: ${ALL_QUALITY ? '✓' : '✗'}  Debug: ${DEBUG ? '✓' : '✗'}  自動: ${AUTO ? '✓' : '✗'}`);
  if (SINGLE_PILOT_RAW) console.log(`  指定機師: ${SINGLE_PILOT_RAW}（簡體: ${SINGLE_PILOT_CN}）`);
  if (isFinite(LIMIT))  console.log(`  數量限制: ${LIMIT}`);
  console.log('');

  // ── 初始化 Firebase ──
  const firebaseReady = initFirebase();
  if (!firebaseReady) {
    console.log('❌ Firebase 未連線，請確認 .env.migration 與服務帳號金鑰。');
    process.exit(1);
  }
  console.log('🔥 Firebase 連線成功');
  console.log('');

  // 建立輸出目錄
  if (DOWNLOAD_IMG) {
    fs.mkdirSync(PILOTS_DIR, { recursive: true });
    fs.mkdirSync(SKILLS_DIR, { recursive: true });
  }

  // ── 從 Firestore 載入已有機師資料 ──
  let existingPilots = new Map(); // key: 簡體名 → value: pilot data
  if (!FORCE) {
    process.stdout.write('📦 載入 Firestore 機師資料...');
    existingPilots = await loadFirestorePilots();
    console.log(` ${existingPilots.size} 個`);
  }

  // ── 取得機師列表 ──
  console.log('📋 正在取得機師列表...');
  const allPilots = await fetchPilotList();
  console.log(`  → 總共 ${allPilots.length} 個機師`);

  // ── 篩選目標 ──
  let targets;
  if (SINGLE_PILOT_CN) {
    // 優先精確匹配，找不到再用模糊匹配
    targets = allPilots.filter(p => p.PilotName === SINGLE_PILOT_CN || p.name === SINGLE_PILOT_CN);
    if (targets.length === 0) {
      targets = allPilots.filter(p => p.PilotName.includes(SINGLE_PILOT_CN) || p.name.includes(SINGLE_PILOT_CN));
    }
    if (targets.length === 0) {
      console.log(`  ⚠ 找不到「${SINGLE_PILOT_RAW}」(${SINGLE_PILOT_CN})，可用 S 級機師列表：`);
      const ssrPilots = allPilots.filter(p => p.quality === 'SSR');
      console.log('  ' + ssrPilots.map(p => s2t(p.PilotName)).join('、'));
      process.exit(1);
    }
  } else if (ALL_QUALITY) {
    targets = allPilots;
  } else {
    targets = allPilots.filter(p => p.quality === 'SSR');
    console.log(`  → SSR（S級）: ${targets.length} 個`);
  }

  // ── 比對已有，決定要跑哪些 ──
  const toDo = FORCE
    ? targets
    : targets.filter(p => !existingPilots.has(p.PilotName));
  const toSkip = targets.length - toDo.length;

  if (toSkip > 0) console.log(`  → 跳過已有: ${toSkip} 個`);

  const finalTargets = toDo.slice(0, LIMIT);
  console.log(`  → 本次擷取: ${finalTargets.length} 個`);
  console.log('');

  // ── 逐一擷取 ──
  const results = new Map(existingPilots);
  let newCount = 0;

  for (let i = 0; i < finalTargets.length; i++) {
    const pilot = finalTargets[i];
    const nameTW = s2t(pilot.PilotName);
    process.stdout.write(`  [${i + 1}/${finalTargets.length}] ⏳ ${nameTW}...`);

    try {
      const detail = await fetchPilotDetail(pilot.ID);
      // index = 已存在筆數（不含本次已新增的）
      const currentIndex = existingPilots.size + newCount;
      const pilotJson = buildPilotJson(detail, currentIndex);

      // 下載圖片
      await downloadPilotImages(pilotJson, detail);

      results.set(pilot.PilotName, pilotJson);
      newCount++;

      const skillCount = pilotJson.skills.length;
      const bcCount    = pilotJson.biometicComputer.length;
      process.stdout.write(` ✓ [${pilotJson.class}] 技能:${skillCount} 算力:${bcCount} 神驅:${pilotJson.neuralDrive.length}\n`);
    } catch (err) {
      process.stdout.write(` ✗ ${err.message}\n`);
    }

    // 禮貌延遲（避免被限速）
    if (i < finalTargets.length - 1) {
      await new Promise(r => setTimeout(r, 300));
    }
  }

  // ── 整理輸出（去除內部欄位 fullPortraitUrl）──
  const newPilots = Array.from(results.values())
    .filter(p => !existingPilots.has(t2s(p.name)))
    .map(({ fullPortraitUrl, ...rest }) => rest);

  console.log('');
  console.log('═══════════════════════════════════════════');
  console.log(`📊 差異報告`);
  console.log(`   🆕 新增: ${newPilots.length} 個機師`);
  if (newPilots.length > 0) {
    newPilots.slice(0, 10).forEach(p => console.log(`     + ${p.name}  [${p.class}]  ${p.rarity}級`));
    if (newPilots.length > 10) console.log(`     ... 及其他 ${newPilots.length - 10} 個`);
  }
  console.log('');

  if (newPilots.length === 0) {
    console.log('✅ Firestore 已是最新，無需寫入。');
    return;
  }

  // ── 寫入 Firestore（含確認）──
  const confirmed = await promptConfirm(`將 ${newPilots.length} 個新機師寫入 Firestore？ [y/N] `);
  if (!confirmed) { console.log('已取消。'); process.exit(0); }

  process.stdout.write('🔥 寫入 Firestore...');
  const written = await batchWrite('pilots', newPilots);
  console.log(` ${written} 筆完成`);
  console.log('');
  console.log(`✅ 完成！新增 ${written} 個機師`);
  if (DOWNLOAD_IMG) {
    console.log(`   📁 ${PILOTS_DIR}/{機師名}/half.png, full.png`);
    console.log(`   📁 ${SKILLS_DIR}`);
  }
}

main().catch(err => {
  console.error('\n❌ 腳本執行失敗：', err.message);
  console.error(err.stack);
  process.exit(1);
});

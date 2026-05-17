/**
 * 鋼嵐工具站 — PLAN-001 資料遷移腳本
 *
 * 執行 pilots collection 的欄位格式遷移：
 *   1. 移除 skills[] / talents[] 的平坦數值欄位 (dmg / crit / critDmg / acc)
 *   2. 移除 neuralDrive[] zone 層的平坦數值欄位
 *   3. 為 skills[] / talents[] 補上 effects: [] / buffIds: [] 初始值
 *   4. 為 neuralDrive[].levels[] 各層補上 effects: [] / buffIds: [] 初始值
 *   5. skills[] 補上 cd: '' 欄位（若缺少）、修正 weapon null→''
 *   6. skills[] 修正 type：必殺技能 → 主動技能（SpecialAssault 映射修正）
 *
 * 使用方式：
 *   node scripts/migrate-plan001-pilots.js             ← 執行遷移（含確認提示）
 *   node scripts/migrate-plan001-pilots.js --dry-run   ← 只預覽差異，不寫入 Firestore
 *   node scripts/migrate-plan001-pilots.js --auto      ← 略過確認直接寫入
 *   node scripts/migrate-plan001-pilots.js --pilot=葉夫根尼  ← 只遷移指定機師（繁體名）
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { resolve } from 'path';
import admin from 'firebase-admin';
import readline from 'readline';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = resolve(__dirname, '..');

// ── 命令列參數 ────────────────────────────────────────────────
const args         = process.argv.slice(2);
const DRY_RUN      = args.includes('--dry-run');
const AUTO         = args.includes('--auto');
const SINGLE_PILOT = (args.find(a => a.startsWith('--pilot=')) || '').split('=')[1] || '';

// ════════════════════════════════════════════════════════════
// Firebase Admin 初始化
// ════════════════════════════════════════════════════════════
function initFirebase() {
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
  return admin.firestore();
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
// 遷移邏輯
// ════════════════════════════════════════════════════════════
const OLD_FIELDS = ['dmg', 'crit', 'critDmg', 'acc'];

// SpecialAssault 在舊版腳本誤映射為「必殺技能」，修正為「主動技能」
const SKILL_TYPE_CORRECTIONS = { '必殺技能': '主動技能' };

function hasOldFields(obj) {
  return OLD_FIELDS.some(f => f in obj);
}

function stripOldFields(obj) {
  const result = { ...obj };
  OLD_FIELDS.forEach(f => delete result[f]);
  return result;
}

/** talents[] 遷移：移除平坦欄位，補上 effects / buffIds */
function migrateTalents(talents) {
  if (!Array.isArray(talents)) return { changed: false, data: talents };
  let changed = false;
  const data = talents.map(t => {
    let entry = { ...t };
    if (hasOldFields(entry)) { entry = stripOldFields(entry); changed = true; }
    if (!('effects' in entry))  { entry.effects  = []; changed = true; }
    if (!('buffIds' in entry))  { entry.buffIds   = []; changed = true; }
    return entry;
  });
  return { changed, data };
}

/** skills[] 遷移：
 *  - 移除平坦欄位（dmg/crit/critDmg/acc）
 *  - 補上 effects / buffIds 初始值
 *  - 補上 cd: '' 欄位（指令技能的實際 CD 值需後續 --patch 抓取）
 *  - 修正 weapon null/undefined → ''
 *  - 修正 type：必殺技能 → 主動技能
 */
function migrateSkills(skills) {
  if (!Array.isArray(skills)) return { changed: false, data: skills };
  let changed = false;
  const data = skills.map(s => {
    let entry = { ...s };
    if (hasOldFields(entry))                    { entry = stripOldFields(entry); changed = true; }
    if (!('effects' in entry))                  { entry.effects = []; changed = true; }
    if (!('buffIds' in entry))                  { entry.buffIds = []; changed = true; }
    if (!('cd' in entry))                       { entry.cd = ''; changed = true; }
    if (entry.weapon === null || entry.weapon === undefined) { entry.weapon = ''; changed = true; }
    if (entry.type && SKILL_TYPE_CORRECTIONS[entry.type]) {
      entry.type = SKILL_TYPE_CORRECTIONS[entry.type]; changed = true;
    }
    return entry;
  });
  return { changed, data };
}

/** neuralDrive[] 遷移：zone 層移除平坦欄位；levels[] 各層補上 effects / buffIds */
function migrateNeuralDrive(neuralDrive) {
  if (!Array.isArray(neuralDrive)) return { changed: false, data: neuralDrive };
  let changed = false;
  const data = neuralDrive.map(zone => {
    let entry = { ...zone };

    // zone 層移除平坦欄位
    if (hasOldFields(entry)) { entry = stripOldFields(entry); changed = true; }

    // levels[] 各層補欄位
    if (Array.isArray(entry.levels)) {
      entry.levels = entry.levels.map(level => {
        const lv = { ...level };
        if (!('effects' in lv)) { lv.effects = []; changed = true; }
        if (!('buffIds' in lv)) { lv.buffIds  = []; changed = true; }
        return lv;
      });
    }
    return entry;
  });
  return { changed, data };
}

// ════════════════════════════════════════════════════════════
// 主流程
// ════════════════════════════════════════════════════════════
async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║  鋼嵐工具站 — PLAN-001 pilots 欄位遷移腳本  ║');
  console.log('╚══════════════════════════════════════════════╝');
  if (DRY_RUN) console.log('  ⚠  DRY-RUN 模式 — 只預覽，不寫入 Firestore');
  if (AUTO)    console.log('  ⚠  AUTO 模式 — 略過確認直接寫入');
  if (SINGLE_PILOT) console.log(`  指定機師：${SINGLE_PILOT}`);
  console.log('');

  // ── 初始化 Firebase ──
  let db;
  try {
    db = initFirebase();
    console.log('🔥 Firebase 連線成功');
  } catch (err) {
    console.error(`❌ Firebase 初始化失敗：${err.message}`);
    process.exit(1);
  }

  // ── 讀取 pilots ──
  process.stdout.write('📦 讀取 pilots collection...');
  const snap = await db.collection('pilots').get();
  console.log(` ${snap.size} 個機師`);
  console.log('');

  // ── 分析差異 ──
  const toUpdate = [];

  for (const doc of snap.docs) {
    const data = doc.data();
    const name = data.name || doc.id;

    // 指定機師篩選
    if (SINGLE_PILOT && name !== SINGLE_PILOT) continue;

    const updates = {};

    const t = migrateTalents(data.talents);
    if (t.changed) updates.talents = t.data;

    const s = migrateSkills(data.skills);
    if (s.changed) updates.skills = s.data;

    const n = migrateNeuralDrive(data.neuralDrive);
    if (n.changed) updates.neuralDrive = n.data;

    if (Object.keys(updates).length > 0) {
      toUpdate.push({ id: doc.id, name, updates, changedFields: Object.keys(updates) });
    }
  }

  // ── 差異報告 ──
  console.log('═══════════════════════════════════════════');
  console.log(`📊 差異報告  —  需要遷移：${toUpdate.length} / ${snap.size} 個機師`);
  console.log('');

  if (toUpdate.length === 0) {
    console.log('✅ 所有機師資料已是最新格式，無需遷移。');
    return;
  }

  for (const { name, changedFields } of toUpdate) {
    const labels = changedFields.map(f => {
      if (f === 'talents')     return 'talents[]';
      if (f === 'skills')      return 'skills[]';
      if (f === 'neuralDrive') return 'neuralDrive[]';
      return f;
    });
    console.log(`  ✎  ${name.padEnd(12)}  →  ${labels.join('、')}`);
  }
  console.log('');

  if (DRY_RUN) {
    console.log('🔍 DRY-RUN 完成，以上為將執行的變更。實際執行請移除 --dry-run 參數。');
    return;
  }

  // ── 確認寫入 ──
  const confirmed = await promptConfirm(
    `將以上 ${toUpdate.length} 個機師的欄位寫入 Firestore？[y/N] `
  );
  if (!confirmed) { console.log('已取消。'); process.exit(0); }

  // ── 批次寫入 ──
  process.stdout.write('🔥 寫入 Firestore...');
  let written = 0;
  for (let i = 0; i < toUpdate.length; i += 500) {
    const batch = db.batch();
    toUpdate.slice(i, i + 500).forEach(({ id, updates }) => {
      batch.update(db.collection('pilots').doc(id), updates);
    });
    await batch.commit();
    written += Math.min(500, toUpdate.length - i);
  }
  console.log(` ${written} 筆完成`);

  console.log('');
  console.log(`✅ 遷移完成！${written} 個機師已更新。`);
  console.log('   - 已移除：dmg / crit / critDmg / acc 平坦欄位（skills/talents/neuralDrive zone）');
  console.log('   - 已補上：effects: [] / buffIds: [] 初始值（skills/talents/neuralDrive levels）');
  console.log('   - 已補上：cd: \'\' 欄位（指令技能實際 CD 值請用 --patch 模式補充）');
  console.log('   - 已修正：weapon null → \'\'、必殺技能 → 主動技能');
}

main().catch(err => {
  console.error('\n❌ 腳本執行失敗：', err.message);
  console.error(err.stack);
  process.exit(1);
});

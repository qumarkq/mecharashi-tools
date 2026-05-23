/**
 * 鋼嵐工具站 — 元件外框路徑 patch 腳本
 *
 * 依 componentType × componentsWType 寫入 outerFrameLocal 欄位：
 *   Condition + Normal → /images/components/OuterFrame/statetype_Condition.png
 *   Condition + W      → /images/components/OuterFrame/statetype_Condition_W.png
 *   Function  + Normal → /images/components/OuterFrame/statetype_Function.png
 *   Function  + W      → /images/components/OuterFrame/statetype_Function_W.png
 *
 * 使用方式：
 *   node scripts/patch-component-outerframe.mjs --dry-run   ← 預覽，不寫入
 *   node scripts/patch-component-outerframe.mjs             ← 實際寫入（互動確認）
 *   node scripts/patch-component-outerframe.mjs --auto      ← 略過確認直接寫入
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { resolve } from 'path';
import admin from 'firebase-admin';
import readline from 'readline';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = resolve(__dirname, '..');

const args = process.argv.slice(2);
const DRY  = args.includes('--dry-run');
const AUTO = args.includes('--auto');

const OUTER_FRAME_BASE = '/images/components/OuterFrame';

const FRAME_MAP = {
  'Condition:Normal': `${OUTER_FRAME_BASE}/statetype_Condition.png`,
  'Condition:W':      `${OUTER_FRAME_BASE}/statetype_Condition_W.png`,
  'Function:Normal':  `${OUTER_FRAME_BASE}/statetype_Function.png`,
  'Function:W':       `${OUTER_FRAME_BASE}/statetype_Function_W.png`,
};

// ── Firebase 初始化 ───────────────────────────────────────────────────────────
let db;
function loadEnv(filename) {
  const envPath = resolve(ROOT, filename);
  if (!fs.existsSync(envPath)) return;
  fs.readFileSync(envPath, 'utf-8').split('\n').forEach(line => {
    const eqIdx = line.indexOf('=');
    if (eqIdx > 0) {
      const k = line.slice(0, eqIdx).trim();
      const v = line.slice(eqIdx + 1).trim();
      if (k && v) process.env[k] = v;
    }
  });
}

function initFirebase() {
  loadEnv('.env');
  loadEnv('.env.migration');
  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!credPath) throw new Error('GOOGLE_APPLICATION_CREDENTIALS 未設定');
  const absCredPath = resolve(ROOT, credPath);
  if (!fs.existsSync(absCredPath)) throw new Error(`找不到服務帳號金鑰：${absCredPath}`);
  const serviceAccount = JSON.parse(fs.readFileSync(absCredPath, 'utf-8'));
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  db = admin.firestore();
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

// ── 主程式 ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🔧 元件外框路徑 patch 腳本');
  console.log(`   模式：${DRY ? 'DRY-RUN（只預覽，不寫入）' : '實際寫入'}`);
  console.log('');

  initFirebase();

  process.stdout.write('📦 載入 Firestore 元件資料...');
  const snap = await db.collection('components').get();
  console.log(` ${snap.size} 筆`);

  const toUpdate = [];
  const skipped  = [];
  const errors   = [];

  for (const doc of snap.docs) {
    const data = doc.data();
    const { componentType, componentsWType, name } = data;

    const key = `${componentType}:${componentsWType}`;
    const outerFrameLocal = FRAME_MAP[key];

    if (!outerFrameLocal) {
      errors.push({ id: doc.id, name, componentType, componentsWType });
      continue;
    }

    if (data.outerFrameLocal === outerFrameLocal) {
      skipped.push(name);
      continue;
    }

    toUpdate.push({ id: doc.id, name, outerFrameLocal });
  }

  // ── 摘要 ──
  console.log(`\n📋 統計：`);
  console.log(`   待寫入：${toUpdate.length} 筆`);
  console.log(`   已是最新（略過）：${skipped.length} 筆`);

  if (errors.length > 0) {
    console.log(`\n⚠️  無法對應外框（componentType / componentsWType 異常）：${errors.length} 筆`);
    errors.forEach(e =>
      console.log(`   · ${e.name} (${e.id}) — type=${e.componentType}, wType=${e.componentsWType}`)
    );
  }

  if (toUpdate.length === 0) {
    console.log('\n✅ 無需更新：所有元件的 outerFrameLocal 已是最新值。');
    return;
  }

  if (DRY) {
    console.log('\n[DRY-RUN] 預覽前 20 筆：');
    toUpdate.slice(0, 20).forEach(u =>
      console.log(`   · ${u.name} → ${u.outerFrameLocal}`)
    );
    if (toUpdate.length > 20) console.log(`   ... 以及另外 ${toUpdate.length - 20} 筆`);
    console.log('\n[DRY-RUN] 未寫入任何資料。');
    return;
  }

  console.log('');
  const confirmed = await promptConfirm(`將上述 ${toUpdate.length} 筆元件的 outerFrameLocal 寫入 Firestore？ [y/N] `);
  if (!confirmed) { console.log('已取消。'); process.exit(0); }

  // ── Batch 寫入 ──
  let written = 0;
  for (let i = 0; i < toUpdate.length; i += 500) {
    const batch = db.batch();
    toUpdate.slice(i, i + 500).forEach(({ id, outerFrameLocal }) => {
      batch.update(db.collection('components').doc(id), { outerFrameLocal });
    });
    await batch.commit();
    written += Math.min(500, toUpdate.length - i);
    process.stdout.write(`\r🔥 寫入中... ${written}/${toUpdate.length}`);
  }

  console.log(`\n✅ 完成！已更新 ${written} 筆元件的 outerFrameLocal。`);
}

main().catch(err => {
  console.error('\n❌ 腳本執行失敗：', err.message);
  console.error(err.stack);
  process.exit(1);
});

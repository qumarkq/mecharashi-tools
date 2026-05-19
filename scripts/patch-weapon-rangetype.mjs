/**
 * 鋼嵐工具站 — 武器射程型態 patch 腳本
 *
 * 將 Firestore weapons 集合中的 rangeType 欄位從舊值遷移到新值：
 *   'linear'  →  'manhattan'（所有武器，除電磁炮外）
 *   'linear'  →  'orthogonal'（kind === '電磁炮' 的武器）
 *   'ring'    →  不變
 *
 * 使用方式：
 *   node scripts/patch-weapon-rangetype.mjs --dry-run   ← 預覽，不寫入
 *   node scripts/patch-weapon-rangetype.mjs             ← 實際寫入（互動確認）
 *   node scripts/patch-weapon-rangetype.mjs --auto      ← 略過確認直接寫入
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { resolve } from 'path';
import admin from 'firebase-admin';
import readline from 'readline';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = resolve(__dirname, '..');

const args   = process.argv.slice(2);
const DRY    = args.includes('--dry-run');
const AUTO   = args.includes('--auto');

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
  console.log('🔧 武器射程型態 patch 腳本');
  console.log(`   模式：${DRY ? 'DRY-RUN（只預覽，不寫入）' : '實際寫入'}`);
  console.log('');

  initFirebase();

  process.stdout.write('📦 載入 Firestore 武器資料...');
  const snap = await db.collection('weapons').get();
  console.log(` ${snap.size} 筆`);

  const toManhattan  = [];
  const toOrthogonal = [];

  for (const doc of snap.docs) {
    const data = doc.data();
    if (data.rangeType !== 'linear') continue;

    if (data.kind === '電磁炮') {
      toOrthogonal.push({ id: doc.id, name: data.name, kind: data.kind });
    } else {
      toManhattan.push({ id: doc.id, name: data.name, kind: data.kind });
    }
  }

  if (toManhattan.length === 0 && toOrthogonal.length === 0) {
    console.log('✅ 無需更新：所有武器的 rangeType 已是最新值（manhattan / orthogonal / ring）。');
    return;
  }

  console.log(`\n📋 待更新：`);
  console.log(`   'linear' → 'manhattan'  : ${toManhattan.length} 筆`);
  console.log(`   'linear' → 'orthogonal' : ${toOrthogonal.length} 筆`);

  if (toOrthogonal.length > 0) {
    console.log('\n   電磁炮武器（→ orthogonal）：');
    toOrthogonal.forEach(w => console.log(`     · ${w.name} (${w.id})`));
  }

  if (DRY) {
    console.log('\n[DRY-RUN] 未寫入任何資料。');
    return;
  }

  console.log('');
  const confirmed = await promptConfirm(`將上述 ${toManhattan.length + toOrthogonal.length} 筆武器的 rangeType 寫入 Firestore？ [y/N] `);
  if (!confirmed) { console.log('已取消。'); process.exit(0); }

  // ── Batch 寫入 ──
  let written = 0;
  const allUpdates = [
    ...toManhattan.map(w  => ({ id: w.id, rangeType: 'manhattan' })),
    ...toOrthogonal.map(w => ({ id: w.id, rangeType: 'orthogonal' })),
  ];

  for (let i = 0; i < allUpdates.length; i += 500) {
    const batch = db.batch();
    allUpdates.slice(i, i + 500).forEach(({ id, rangeType }) => {
      batch.update(db.collection('weapons').doc(id), { rangeType });
    });
    await batch.commit();
    written += Math.min(500, allUpdates.length - i);
    process.stdout.write(`\r🔥 寫入中... ${written}/${allUpdates.length}`);
  }

  console.log(`\n✅ 完成！已更新 ${written} 筆武器的 rangeType。`);
}

main().catch(err => {
  console.error('\n❌ 腳本執行失敗：', err.message);
  console.error(err.stack);
  process.exit(1);
});

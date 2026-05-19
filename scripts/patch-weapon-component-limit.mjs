/**
 * 鋼嵐工具站 — 武器元件上限欄位批次更新
 *
 * 為 weapons collection 所有文件新增 componentLimit 欄位：
 *   SS / S+ → 4
 *   S       → 3
 *   其他    → 0
 *
 * 使用方式：
 *   node scripts/patch-weapon-component-limit.mjs             ← 實際寫入
 *   node scripts/patch-weapon-component-limit.mjs --dry-run   ← 只預覽，不寫入
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { resolve } from 'path';
import admin from 'firebase-admin';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = resolve(__dirname, '..');
const DRY_RUN   = process.argv.includes('--dry-run');

function componentLimitByRarity(rarity) {
  if (rarity === 'SS' || rarity === 'S+') return 4;
  if (rarity === 'S') return 3;
  return 0;
}

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
  if (!credPath) throw new Error('GOOGLE_APPLICATION_CREDENTIALS 未設定（請建立 .env.migration）');
  const absCredPath = resolve(ROOT, credPath);
  if (!fs.existsSync(absCredPath)) throw new Error(`找不到服務帳號金鑰：${absCredPath}`);
  const serviceAccount = JSON.parse(fs.readFileSync(absCredPath, 'utf-8'));
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  return admin.firestore();
}

async function main() {
  const db = initFirebase();
  const snapshot = await db.collection('weapons').get();

  if (snapshot.empty) {
    console.log('weapons collection 為空，無需更新。');
    return;
  }

  const summary = { 4: [], 3: [], 0: [] };
  const batch = db.batch();

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const limit = componentLimitByRarity(data.rarity);
    summary[limit].push(`${doc.id} (${data.name ?? '?'}, ${data.rarity ?? '?'})`);
    if (!DRY_RUN) {
      batch.update(doc.ref, { componentLimit: limit });
    }
  }

  console.log(`\n=== ${DRY_RUN ? 'DRY RUN — 不寫入 Firestore' : '寫入 Firestore'} ===`);
  console.log(`\n元件上限 4（SS / S+）共 ${summary[4].length} 筆：`);
  summary[4].forEach(s => console.log('  ', s));
  console.log(`\n元件上限 3（S）共 ${summary[3].length} 筆：`);
  summary[3].forEach(s => console.log('  ', s));
  console.log(`\n元件上限 0（其他）共 ${summary[0].length} 筆：`);
  summary[0].forEach(s => console.log('  ', s));
  console.log(`\n合計：${snapshot.size} 筆武器文件`);

  if (!DRY_RUN) {
    await batch.commit();
    console.log('\n✓ componentLimit 欄位已成功更新至所有武器文件。');
  } else {
    console.log('\n（Dry run 結束，未寫入任何資料）');
  }
}

main().catch(e => { console.error(e); process.exit(1); });

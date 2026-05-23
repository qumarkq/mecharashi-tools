/**
 * 鋼嵐工具站 — 用戶角色遷移腳本
 *
 * 將 Firestore users/{uid}/profile/main 中 role === 'ADMIN' 的文件更新為 'OWNER'。
 * 適用於 UserRole 新增 OWNER 角色後的一次性遷移。
 *
 * 使用方式：
 *   node scripts/migrate-admin-to-owner.mjs --dry-run   ← 預覽，不寫入
 *   node scripts/migrate-admin-to-owner.mjs             ← 實際寫入（互動確認）
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import admin from 'firebase-admin';
import readline from 'readline';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DRY_RUN = process.argv.includes('--dry-run');

// ── Firebase 初始化 ───────────────────────────────────────────────────────────

const keyPath = path.resolve(__dirname, '../serviceAccountKey.json');
if (!fs.existsSync(keyPath)) {
  console.error('找不到 serviceAccountKey.json，請從 Firebase Console > 專案設定 > 服務帳戶 下載後放到專案根目錄');
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(fs.readFileSync(keyPath, 'utf8'))),
});
const db = admin.firestore();

// ── 查詢 ─────────────────────────────────────────────────────────────────────

console.log('查詢 role === ADMIN 的用戶...\n');

const snapshot = await db.collectionGroup('profile').get();

const targets = snapshot.docs
  .filter((d) => d.data().role === 'ADMIN')
  .map((d) => ({ ref: d.ref, data: d.data() }));

if (targets.length === 0) {
  console.log('找不到任何 ADMIN 用戶，無需遷移。');
  process.exit(0);
}

console.log(`找到 ${targets.length} 位 ADMIN 用戶：`);
targets.forEach(({ data }) => {
  console.log(`  UID: ${data.uid}  Email: ${data.email}  displayName: ${data.displayName}`);
});
console.log('');

if (DRY_RUN) {
  console.log('[dry-run] 預覽完畢，未寫入任何資料。');
  process.exit(0);
}

// ── 互動確認 ─────────────────────────────────────────────────────────────────

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const answer = await new Promise((resolve) =>
  rl.question('確認將以上用戶的 role 由 ADMIN 改為 OWNER？(y/N) ', resolve)
);
rl.close();

if (answer.trim().toLowerCase() !== 'y') {
  console.log('已取消。');
  process.exit(0);
}

// ── 寫入 ─────────────────────────────────────────────────────────────────────

const now = new Date().toISOString();
for (const { ref, data } of targets) {
  await ref.update({ role: 'OWNER', updatedAt: now });
  console.log(`✓ ${data.email} → OWNER`);
}

console.log('\n遷移完成。');
process.exit(0);

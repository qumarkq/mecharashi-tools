/**
 * 建立測試用帳號（跳過 email 驗證）
 *
 * 使用方式：
 *   node scripts/create-test-user.mjs
 *   node scripts/create-test-user.mjs --email test@example.com --password yourpass
 *   node scripts/create-test-user.mjs --delete --email test@example.com
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import admin from 'firebase-admin';
import readline from 'readline';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
const auth = admin.auth();

// ── CLI 參數解析 ──────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const getArg = (flag) => {
  const i = args.indexOf(flag);
  return i !== -1 ? args[i + 1] : null;
};
const DELETE_MODE = args.includes('--delete');

// ── 互動輸入 ──────────────────────────────────────────────────────────────────

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((res) => rl.question(q, res));

async function getInput(flag, prompt) {
  const val = getArg(flag);
  if (val) return val;
  return ask(prompt);
}

// ── 刪除模式 ──────────────────────────────────────────────────────────────────

async function deleteTestUser(email) {
  try {
    const user = await auth.getUserByEmail(email);
    await auth.deleteUser(user.uid);
    await db.doc(`users/${user.uid}/profile/main`).delete();
    console.log(`\n已刪除測試帳號：${email} (uid: ${user.uid})`);
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      console.error(`找不到帳號：${email}`);
    } else {
      throw err;
    }
  }
}

// ── 建立模式 ──────────────────────────────────────────────────────────────────

async function createTestUser(email, password, displayName) {
  // 建立 Firebase Auth 帳號（Admin SDK 不需要 email 驗證）
  const userRecord = await auth.createUser({
    email,
    password,
    displayName,
    emailVerified: true, // 直接標記為已驗證
  });

  // 建立 Firestore profile
  const now = new Date().toISOString();
  const profile = {
    uid: userRecord.uid,
    email,
    displayName,
    photoURL: null,
    role: 'USER',
    researchLevels: { pilotByClass: {}, mechByType: {}, weaponByType: {} },
    createdAt: now,
    updatedAt: now,
    avatarType: null,
  };

  await db.doc(`users/${userRecord.uid}/profile/main`).set(profile);

  console.log('\n測試帳號建立成功！');
  console.log('─────────────────────────────');
  console.log(`Email    : ${email}`);
  console.log(`密碼     : ${password}`);
  console.log(`暱稱     : ${displayName}`);
  console.log(`UID      : ${userRecord.uid}`);
  console.log(`Role     : USER`);
  console.log('─────────────────────────────');
  console.log('可直接用此 email/密碼登入 App（email 已標記為已驗證）\n');
}

// ── 主程式 ────────────────────────────────────────────────────────────────────

async function main() {
  if (DELETE_MODE) {
    const email = await getInput('--email', '請輸入要刪除的帳號 email：');
    await deleteTestUser(email.trim());
  } else {
    console.log('=== 建立測試帳號 ===\n');
    const email = await getInput('--email', 'Email（例：test@example.com）：');
    const password = await getInput('--password', '密碼（至少 6 碼）：');
    const displayName = getArg('--name') || '測試帳號';

    await createTestUser(email.trim(), password.trim(), displayName);
  }
}

main().catch((err) => {
  console.error('錯誤：', err.message);
  process.exit(1);
}).finally(() => rl.close());

/**
 * 臨時修補腳本：更新 Firestore backpacks 集合中 mainSkill.icon 的路徑
 *
 * 問題：scrape-backpacks.js 存入的 mainSkill.icon 只有 iconKey 名稱
 *       （如 Icon_skill_xxx），前端直接當 src 使用時路徑不對。
 * 修補：將不含路徑的值更新為 /images/skills/${iconKey}.png
 *
 * 使用方式：
 *   node scripts/fix-backpack-skill-icons.js --dry-run   ← 預覽，不寫入
 *   node scripts/fix-backpack-skill-icons.js             ← 實際修補（互動確認）
 *   node scripts/fix-backpack-skill-icons.js --auto      ← 略過確認直接寫入
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
const DRY_RUN = args.includes('--dry-run');
const AUTO    = args.includes('--auto');

// ── Firebase 初始化 ──────────────────────────────────────────────────────────
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

// ── 判斷是否需要修補 ─────────────────────────────────────────────────────────
// 需修補條件：icon 有值、不是 /images/ 開頭、不是 http 開頭
function needsFix(iconValue) {
  if (!iconValue || typeof iconValue !== 'string') return false;
  if (iconValue.startsWith('/images/')) return false;
  if (iconValue.startsWith('http')) return false;
  return true;
}

function fixedPath(iconKey) {
  // 移除可能殘留的 .png 副檔名後重新組合
  const base = iconKey.endsWith('.png') ? iconKey.slice(0, -4) : iconKey;
  return `/images/skills/${base}.png`;
}

async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║  修補腳本：backpacks mainSkill.icon 路徑修正       ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log(`  模式: ${DRY_RUN ? 'DRY-RUN（預覽）' : '寫入 Firestore'}`);
  console.log('');

  let db;
  try {
    db = initFirebase();
    console.log('🔥 Firebase 連線成功\n');
  } catch (err) {
    console.error(`❌ Firebase 初始化失敗: ${err.message}`);
    process.exit(1);
  }

  // ── 讀取所有背包 ──
  process.stdout.write('📦 讀取 Firestore backpacks...');
  const snap = await db.collection('backpacks').get();
  console.log(` ${snap.size} 筆`);

  // ── 找出需要修補的文件 ──
  const toFix = [];
  for (const doc of snap.docs) {
    const data = doc.data();
    const icon = data?.mainSkill?.icon;
    if (needsFix(icon)) {
      toFix.push({
        id:     doc.id,
        name:   data.name ?? doc.id,
        oldIcon: icon,
        newIcon: fixedPath(icon),
      });
    }
  }

  if (toFix.length === 0) {
    console.log('\n✅ 所有 mainSkill.icon 路徑均正確，無需修補。');
    process.exit(0);
  }

  // ── 預覽變更 ──
  console.log(`\n🔍 發現 ${toFix.length} 筆需要修補：`);
  toFix.forEach(item => {
    console.log(`  · ${item.name} (${item.id})`);
    console.log(`    舊: ${item.oldIcon}`);
    console.log(`    新: ${item.newIcon}`);
  });

  if (DRY_RUN) {
    console.log('\n（DRY-RUN 完成，未寫入 Firestore）');
    return;
  }

  // ── 確認後批次寫入 ──
  console.log('');
  const confirmed = await promptConfirm(`將 ${toFix.length} 筆 mainSkill.icon 路徑寫入 Firestore？ [y/N] `);
  if (!confirmed) { console.log('已取消。'); process.exit(0); }

  process.stdout.write('\n🔥 寫入 Firestore...');
  for (let i = 0; i < toFix.length; i += 500) {
    const batch = db.batch();
    toFix.slice(i, i + 500).forEach(item => {
      batch.update(db.collection('backpacks').doc(item.id), {
        'mainSkill.icon': item.newIcon,
      });
    });
    await batch.commit();
  }
  console.log(` ${toFix.length} 筆完成`);
  console.log('\n✅ 修補完成！');
}

main().catch(err => {
  console.error('\n❌ 腳本執行失敗：', err.message);
  console.error(err.stack);
  process.exit(1);
});

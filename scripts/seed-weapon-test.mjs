/**
 * 鋼嵐工具站 — PLAN-003 武器測試資料種子腳本
 *
 * 在 Firestore weapons collection 建立一筆測試武器文件，驗證新 Schema。
 *
 * 使用方式：
 *   node scripts/seed-weapon-test.mjs             ← 寫入測試武器
 *   node scripts/seed-weapon-test.mjs --dry-run   ← 只預覽資料，不寫入
 *   node scripts/seed-weapon-test.mjs --delete    ← 刪除測試武器文件
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { resolve } from 'path';
import admin from 'firebase-admin';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = resolve(__dirname, '..');

const args    = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const DELETE  = args.includes('--delete');

const TEST_ID = 'test-weapon-plan003';

// ── 測試武器文件（符合 PLAN-003 新 Schema）────────────────────────────────────
const testWeapon = {
  id:              TEST_ID,
  name:            'EX-01 測試狙擊步槍',

  // 分類（PLAN-003 重命名：category→type, type→kind）
  type:            '射擊',           // WeaponType
  kind:            '狙擊步槍',       // 武器種類（原 type）
  kindCoefficient: 1.5,             // 武器種類係數（原 typeCoefficient）

  // 基礎屬性
  attack:          '1200~1500',
  accuracy:        180,
  critValue:       45,
  weight:          18,
  rarity:          'S',             // WeaponRarity: 'SS' | 'S+' | 'S'
  mechRestriction: 'none',          // MechRestriction: 'none' | 'light' | 'medium' | 'heavy'

  // 射程（PLAN-003 新結構：range: string → rangeType + minRange + maxRange）
  rangeType:       'linear',        // RangeType: 'linear' | 'ring'
  minRange:        2,               // 線性射程：最小值
  maxRange:        4,               // 最大射程

  // 專屬武器
  isExclusive:     false,

  // 元件插槽
  triggerSlots:    2,
  effectSlots:     2,

  // 固定改裝
  fixedMod: {
    planName: '精準射擊強化',
    maxLevel: 10,
    effects: [
      { stat: 'attack',   value: 120 },
      { stat: 'accuracy', value: 15  },
    ],
  },

  // 浮動改裝
  floatingMod: {
    planName: '狙擊系統',
    slots: 3,
    possibleEffects: [
      { stat: 'attack',    condition: null,        min: 60,  max: 150 },
      { stat: 'crit',      condition: null,        min: 5,   max: 12  },
      { stat: 'accuracy',  condition: '長射程條件', min: 10,  max: 25  },
    ],
  },

  // 武器技能
  skills: [
    {
      name:        '精準狙擊',
      type:        '被動技能',
      activation:  'equip',
      description: '射程最大距離攻擊時，傷害提升 20%',
      effects: [
        {
          stat:      'dmg',
          value:     20,
          scope:     'self',
          condition: {
            trigger:   'always',
          },
        },
      ],
      buffIds: [],
    },
  ],
};

// ── Firebase Admin 初始化 ─────────────────────────────────────────────────────
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

// ── 主程式 ────────────────────────────────────────────────────────────────────
async function main() {
  if (DRY_RUN) {
    console.log('\n=== DRY RUN — 不寫入 Firestore ===\n');
    console.log('文件 ID:', TEST_ID);
    console.log('集合:    weapons');
    console.log('\n資料內容:');
    console.log(JSON.stringify(testWeapon, null, 2));
    console.log('\n射程格式：');
    console.log(
      `  rangeType=${testWeapon.rangeType}, minRange=${testWeapon.minRange}, maxRange=${testWeapon.maxRange}`,
    );
    console.log(`  顯示為：${testWeapon.minRange}-${testWeapon.maxRange}`);
    return;
  }

  const db = initFirebase();
  const ref = db.collection('weapons').doc(TEST_ID);

  if (DELETE) {
    await ref.delete();
    console.log(`✓ 已刪除測試武器文件 (${TEST_ID})`);
    return;
  }

  await ref.set(testWeapon);
  console.log(`✓ 測試武器已寫入 Firestore`);
  console.log(`  集合：weapons`);
  console.log(`  文件 ID：${TEST_ID}`);
  console.log(`  名稱：${testWeapon.name}`);
  console.log(`  類型/種類：${testWeapon.type} / ${testWeapon.kind}`);
  console.log(`  射程：${testWeapon.rangeType} ${testWeapon.minRange}-${testWeapon.maxRange}`);
  console.log(`  稀有度：${testWeapon.rarity}`);
}

main().catch(e => { console.error(e); process.exit(1); });

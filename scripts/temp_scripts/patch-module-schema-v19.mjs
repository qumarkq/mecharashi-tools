/**
 * Firestore modules collection 欄位更新腳本（v1.9 schema 遷移）
 *
 * 執行內容：
 *   - 重命名：crit → crit_rate, acc → acc_rate, outputBonus → output_bonus
 *   - 新增欄位（預設 0）：firepower_rate, armor_rate, crit_resist_rate,
 *                         dodge_rate, durable_rate, dmg_resist_rate
 *   - levels[] 陣列內也同步重命名並補齊新欄位
 *   - 刪除舊欄位名稱
 *
 * 用法：
 *   node scripts/patch-module-schema-v19.mjs            （dry-run，僅列出變更）
 *   node scripts/patch-module-schema-v19.mjs --confirm  （實際寫入 Firestore）
 *
 * 前置條件：
 *   1. 建立 .env.migration：
 *        FIREBASE_PROJECT_ID=your-project-id
 *        GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json
 *   2. npm install firebase-admin
 */

import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

const CONFIRM = process.argv.includes('--confirm')
console.log(`\n🔥 modules schema patch v1.9 ${CONFIRM ? '[LIVE]' : '[DRY RUN]'}\n`)

// ── 載入環境變數 ──────────────────────────────────────────────────────────────

const envPath = resolve(ROOT, '.env.migration')
if (existsSync(envPath)) {
  readFileSync(envPath, 'utf-8').split('\n').forEach(line => {
    const [k, ...rest] = line.split('=')
    if (k && rest.length) process.env[k.trim()] = rest.join('=').trim()
  })
}

// ── 初始化 Firebase Admin ─────────────────────────────────────────────────────

let admin, db

try {
  const adminModule = await import('firebase-admin')
  admin = adminModule.default
} catch {
  console.error('❌ 請先安裝 firebase-admin：npm install firebase-admin')
  process.exit(1)
}

const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
  ? resolve(ROOT, process.env.GOOGLE_APPLICATION_CREDENTIALS)
  : resolve(ROOT, 'serviceAccountKey.json')

if (!existsSync(keyPath)) {
  console.error(`❌ 找不到服務帳號金鑰：${keyPath}`)
  process.exit(1)
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(readFileSync(keyPath, 'utf-8'))),
    projectId: process.env.FIREBASE_PROJECT_ID,
  })
}
db = admin.firestore()
const FieldValue = admin.firestore.FieldValue

// ── 欄位遷移設定 ──────────────────────────────────────────────────────────────

/** 頂層欄位重命名：{ 舊名: 新名 } */
const TOP_RENAMES = {
  crit:        'crit_rate',
  acc:         'acc_rate',
  outputBonus: 'output_bonus',
}

/** 頂層需新增的欄位（若不存在則補 0） */
const TOP_NEW_FIELDS = [
  'firepower_rate',
  'armor_rate',
  'crit_resist_rate',
  'output_bonus',
  'dodge_rate',
  'durable_rate',
  'dmg_resist_rate',
]

/** levels[] 內欄位重命名 */
const LEVEL_RENAMES = {
  crit: 'crit_rate',
  acc:  'acc_rate',
}

/** levels[] 內需新增的欄位 */
const LEVEL_NEW_FIELDS = [
  'firepower_rate',
  'armor_rate',
  'crit_resist_rate',
  'output_bonus',
  'dodge_rate',
  'durable_rate',
  'dmg_resist_rate',
]

// ── 主邏輯 ────────────────────────────────────────────────────────────────────

function patchDocument(data) {
  const updates = {}
  const deletes = {}

  // 1. 頂層重命名
  for (const [oldKey, newKey] of Object.entries(TOP_RENAMES)) {
    if (oldKey in data) {
      updates[newKey] = data[oldKey]
      deletes[oldKey] = FieldValue.delete()
    }
  }

  // 2. 頂層新增欄位（已存在則跳過；重命名後的新名也視為已存在）
  for (const field of TOP_NEW_FIELDS) {
    const isRenameTarget = Object.values(TOP_RENAMES).includes(field)
    if (!(field in data) && !(isRenameTarget && field in updates)) {
      updates[field] = 0
    }
  }

  // 3. levels[] 陣列處理
  if (Array.isArray(data.levels) && data.levels.length > 0) {
    const newLevels = data.levels.map(lv => {
      const updated = { ...lv }
      for (const [oldKey, newKey] of Object.entries(LEVEL_RENAMES)) {
        if (oldKey in updated) {
          updated[newKey] = updated[oldKey]
          delete updated[oldKey]
        }
      }
      for (const field of LEVEL_NEW_FIELDS) {
        if (!(field in updated)) updated[field] = 0
      }
      return updated
    })
    updates.levels = newLevels
  }

  return { updates, deletes }
}

async function run() {
  const snap = await db.collection('modules').get()
  console.log(`📦 讀取到 ${snap.docs.length} 筆 module 文件\n`)

  let batchCount = 0
  let patchCount = 0
  const BATCH_SIZE = 400

  let batch = db.batch()

  for (const docSnap of snap.docs) {
    const data = docSnap.data()
    const { updates, deletes } = patchDocument(data)

    const hasChanges = Object.keys(updates).length > 0 || Object.keys(deletes).length > 0
    if (!hasChanges) continue

    patchCount++

    if (!CONFIRM) {
      console.log(`[DRY] ${docSnap.id}`)
      if (Object.keys(updates).length) {
        const renamed = Object.entries(TOP_RENAMES)
          .filter(([old]) => old in data)
          .map(([old, n]) => `  ${old} → ${n}`)
        if (renamed.length) console.log(renamed.join('\n'))
        const newAdded = TOP_NEW_FIELDS.filter(f => !(f in data) && !(Object.values(TOP_RENAMES).includes(f) && f in updates))
        if (newAdded.length) console.log(`  新增欄位: ${newAdded.join(', ')}`)
      }
      continue
    }

    batch.update(docSnap.ref, { ...updates, ...deletes })
    batchCount++

    if (batchCount >= BATCH_SIZE) {
      await batch.commit()
      console.log(`  ✅ 提交 batch (${batchCount} 筆)`)
      batch = db.batch()
      batchCount = 0
    }
  }

  if (CONFIRM && batchCount > 0) {
    await batch.commit()
    console.log(`  ✅ 提交最後一批 (${batchCount} 筆)`)
  }

  console.log(`\n${CONFIRM ? '✅ 完成' : '📋 DRY RUN 完成'}：${patchCount} 筆文件需要更新`)
  if (!CONFIRM) console.log('加上 --confirm 參數以實際寫入 Firestore')
}

run().catch(err => {
  console.error('❌ 執行失敗：', err)
  process.exit(1)
})

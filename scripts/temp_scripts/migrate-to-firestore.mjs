/**
 * ⚠ 此腳本已廢棄（Deprecated）
 *
 * 原功能：從 public/data/*.json 批量遷移至 Firestore
 *
 * 現行方式：
 *   - 機師資料：node scripts/scrape-pilots-v3.js        （直接 API → Firestore）
 *   - 機甲資料：node scripts/scrape-mechs.js            （直接 API → Firestore）
 *   - 模組資料：node scripts/scrape-modules.js          （直接 API → Firestore）
 *   - 數值維護：後台管理頁面 /admin                       （手動逐筆編輯）
 *
 * public/data/ 已移至 E:\Github\back_up_data\data\ 作為歷史備份。
 */

import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

// ── 命令列參數 ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const ONLY    = args.find(a => a.startsWith('--only='))?.split('=')[1]

console.log(`\n🔥 Firestore 遷移腳本 ${DRY_RUN ? '[DRY RUN]' : '[LIVE]'}\n`)

// ── 載入環境變數 ──────────────────────────────────────────────────────────────

const envPath = resolve(ROOT, '.env.migration')
if (existsSync(envPath)) {
  readFileSync(envPath, 'utf-8').split('\n').forEach(line => {
    const [k, v] = line.split('=')
    if (k && v) process.env[k.trim()] = v.trim()
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

try {
  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
  if (!credPath) throw new Error('GOOGLE_APPLICATION_CREDENTIALS 未設定')
  const absCredPath = resolve(ROOT, credPath)
  if (!existsSync(absCredPath)) throw new Error(`找不到服務帳號金鑰：${absCredPath}`)

  admin.initializeApp({
    credential: admin.credential.cert(absCredPath),
    projectId:  process.env.FIREBASE_PROJECT_ID,
  })
  db = admin.firestore()
  console.log(`  project: ${process.env.FIREBASE_PROJECT_ID}`)
  console.log(`  credential: ${absCredPath}\n`)
} catch (e) {
  console.error('❌ Firebase Admin 初始化失敗：', e.message)
  console.error('   請確認 .env.migration 已填入正確值，serviceAccountKey.json 已下載')
  process.exit(1)
}

// ── 批量寫入輔助 ──────────────────────────────────────────────────────────────

async function batchWrite(collectionName, docs) {
  if (docs.length === 0) {
    console.log(`  ⚠️  ${collectionName}: 無資料，略過`)
    return
  }

  console.log(`  📦 ${collectionName}: ${docs.length} 筆`)

  if (DRY_RUN) {
    console.log(`     [DRY RUN] 略過寫入`)
    return
  }

  // Firestore 每批最多 500 筆
  const BATCH_SIZE = 500
  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const chunk = docs.slice(i, i + BATCH_SIZE)
    const batch = db.batch()
    chunk.forEach(doc => {
      const ref = db.collection(collectionName).doc(doc.id)
      batch.set(ref, doc)
    })
    await batch.commit()
    console.log(`     ✅ 批次 ${Math.floor(i / BATCH_SIZE) + 1} 完成（${chunk.length} 筆）`)
  }
}

// ── 讀取 JSON（已停用：public/data/ 已移至備份資料夾）─────────────────────────

// function loadJson(filename) {
//   const path = resolve(ROOT, 'public', 'data', filename)
//   if (!existsSync(path)) {
//     console.warn(`  ⚠️  找不到 ${filename}，略過`)
//     return []
//   }
//   return JSON.parse(readFileSync(path, 'utf-8'))
// }

// ── 遷移任務定義（已停用）────────────────────────────────────────────────────

// const migrations = {
//   async pilots()         { await batchWrite('pilots',         loadJson('pilots.json')) },
//   async mechs()          { await batchWrite('mechs',          loadJson('mechs.json')) },
//   async modules()        { await batchWrite('modules',        loadJson('modules.json')) },
//   async weapons()        { await batchWrite('weapons',        loadJson('weapons.json')) },
//   async backpacks()      { await batchWrite('backpacks',      loadJson('backpacks.json')) },
//   async components()     { await batchWrite('components',     loadJson('components.json')) },
//   async pilotResearch()  { await batchWrite('pilotResearch',  loadJson('pilotResearch.json')) },
//   async globalResearch() { await batchWrite('globalResearch', loadJson('globalResearch.json')) },
//   async enemies()        { await batchWrite('enemies',        loadJson('enemies.json')) },
// }

const migrations = {}  // 任務已停用，保留結構供參考

// ── 執行 ──────────────────────────────────────────────────────────────────────

const tasks = ONLY ? [ONLY] : Object.keys(migrations)

for (const task of tasks) {
  if (!migrations[task]) {
    console.warn(`⚠️  未知的 collection：${task}`)
    continue
  }
  console.log(`\n▶ 遷移 ${task}...`)
  try {
    await migrations[task]()
  } catch (e) {
    console.error(`  ❌ ${task} 失敗：`, e.message)
  }
}

console.log('\n✅ 遷移完成\n')
process.exit(0)

/**
 * 鋼嵐工具站 — patchVersions Firestore 初始化腳本
 *
 * 將靜態 PATCH_VERSIONS 陣列批次寫入 Firestore patchVersions Collection。
 * Document ID = "v{version}"（如 "v2.8"）。
 *
 * 使用方式：
 *   node scripts/init-patch-versions.mjs --dry-run   ← 預覽，不寫入
 *   node scripts/init-patch-versions.mjs             ← 實際寫入（互動確認）
 *   node scripts/init-patch-versions.mjs --auto      ← 略過確認直接寫入
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { resolve } from 'path'
import admin from 'firebase-admin'
import readline from 'readline'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT      = resolve(__dirname, '..')

const args = process.argv.slice(2)
const DRY  = args.includes('--dry-run')
const AUTO = args.includes('--auto')

// ── patchVersions 資料（與 src/data/patchVersions/ 同步）────────────────────

const PATCH_VERSIONS = [
  {
    version: '2.8',
    bannerImage: '/images/banners/v2.8.jpg',
    upper: {
      cnDate: '2025/11/06',
      twDate: '2026/04/23',
      pilots: ['鄭樂萱'],
      mechs: ['霸王（中甲）'],
      mechSelection: ['疾嘯', '芬里厄', '遊騎兵', '龍雀', '海拉', '赫拉克斯', '格萊楊'],
      armamentRaids: [
        { name: '帕洛瑪', weapons: ['焰刀'] },
        { name: '維護者', backpacks: ['修理型背包'] },
      ],
      battlePass: { pilots: ['阿黛勒', '懷亞特'], mechs: ['影武者', '芬里厄'] },
      cnActivities: [
        { name: '角雕刮刮樂', startDate: '2025/11/13', weeks: 2, type: 'skinGacha' },
        { name: '角雕特遣',   startDate: '2025/11/20', weeks: 1, type: 'pilotMission', pilots: ['白夜凍鋒', '十字線上的明光'] },
        { name: '環島物流節', startDate: '2025/11/20', weeks: 2, type: 'limitedEvent' },
      ],
      twActivities: [
        { name: '角雕刮刮樂', startDate: '2026/04/30', weeks: 2, type: 'skinGacha' },
        { name: '角雕特遣',   startDate: '2026/05/07', weeks: 1, type: 'pilotMission', pilots: ['白夜凍鋒', '十字線上的明光'] },
        { name: '環島物流節', startDate: '2026/05/07', weeks: 2, type: 'limitedEvent' },
      ],
    },
    lower: {
      cnDate: '2025/11/27',
      twDate: '2026/05/14',
      pilots: ['奧德莉'],
      mechs: ['君權（重甲）'],
      armamentRaids: [
        { name: '安德森', weapons: ['玲瓏'] },
        { name: '縱火者', backpacks: ['彈藥型背包'] },
        { name: '鐵幕法典' },
      ],
      rouletteEvent: true,
      cnActivities: [
        { name: '角雕輪盤', startDate: '2025/12/18', weeks: 1, type: 'roulette' },
      ],
      twActivities: [
        { name: '角雕輪盤', startDate: '2026/05/28', weeks: 1, type: 'roulette' },
      ],
    },
    crisisShop: ['亞瑟', '梅利莎'],
    isTwCurrent: true,
  },
  {
    version: '3.0',
    bannerImage: '/images/banners/v3.0.jpg',
    upper: {
      cnDate: '2026/01/01',
      twDate: '2026/06/04',
      pilots: ['海莉絲'],
      mechs: ['彌造者（輕甲）'],
      armamentRaids: [
        { name: '羅斯瑪麗', weapons: ['否決'] },
        { name: '絕殺者', backpacks: ['隱形首包'] },
      ],
      battlePass: { pilots: ['艾達', '薩普里姬'], mechs: ['疾嘯', '雪鴿'] },
    },
    lower: {
      cnDate: '2026/01/22',
      twDate: '約 2026/06/25',
      twIsPredicted: true,
      pilots: ['瑪阿特'],
      mechs: ['殉道士（中甲）'],
      pilotSelection: ['艾達', '薩普里姬'],
      armamentRaids: [
        { name: '薩普里里姬', weapons: ['函'] },
        { name: '斷火者', backpacks: ['誘導傷背包'] },
      ],
    },
    borderShop: '雷克斯(6/15)',
    arenaShop: '銀閃(6/18)',
    grayOpsUpdates: [
      { company: '武裝工坊', newMechs: ['霸王'] },
      { company: '創新動力', newMechs: ['幻惑'] },
      { company: 'GeekX',    newMechs: ['夜天光'] },
    ],
  },
  {
    version: '3.1',
    upper: {
      cnDate: '2026/02/12',
      twDate: '約 2026/07/16',
      twIsPredicted: true,
      pilots: ['唐小葵'],
      mechs: ['奔賈（輕甲）'],
      armamentRaids: [
        { name: '魔彈射手', weapons: ['維'] },
        { name: '詭武者',   backpacks: ['隱形再生背包'] },
      ],
      battlePass: { pilots: ['維羅妮卡', '盜賊'], mechs: ['維娜', '巨像'] },
    },
    lower: {
      cnDate: '2026/03/05',
      twDate: '約 2026/08/06',
      twIsPredicted: true,
      pilots: ['哈達威'],
      mechs: ['螢石（中甲）'],
      armamentRaids: [
        { name: '千軍',   weapons: ['科林'] },
        { name: '守望者', backpacks: ['誘導攻背包'] },
      ],
    },
    crisisShop: ['羅娜', '迪拉卡'],
  },
  {
    version: '3.2',
    upper: {
      cnDate: '2026/03/26',
      twDate: '約 2026/08/27',
      twIsPredicted: true,
      pilots: ['貝爾莎'],
      mechs: ['惡兆（重甲）'],
      armamentRaids: [
        { name: '碎狼牙',  weapons: ['懷亞特'] },
        { name: '鎮壓者', backpacks: ['飛行再生背包'] },
      ],
      battlePass: { pilots: ['科林', '夜天光'], mechs: ['佐伊', '赫克托'] },
    },
    lower: {
      cnDate: '2026/04/16',
      twDate: '約 2026/09/17',
      twIsPredicted: true,
      pilots: ['吉賽爾'],
      mechs: ['獵鬥士（中甲）'],
      armamentRaids: [
        { name: '導引者', weapons: ['雷達攻擊型'] },
      ],
    },
    borderShop: '赫拉克勒斯(9/3)',
    grayOpsUpdates: [
      { company: '武裝工坊', newMechs: ['君權'] },
    ],
  },
  {
    version: '3.3',
    name: '黃昏紀元',
    upper: {
      cnDate: '2026/04/30',
      twDate: '約 2026/10/08',
      twIsPredicted: true,
      pilots: ['淬鋒凱登'],
      mechs: ['莫X（輕甲）'],
      specialEvents: ['限時活動「寶匿奇遇記」', '限時活動「猜口令」', '限時活動「環島物流節」'],
      skinGacha: '瑪汀妮外觀【喀耳刻之舞】',
      battlePass: { pilots: ['馬汀妮', '鄔樂萱'], mechs: ['幻惑', '霸王'] },
    },
    lower: {
      cnDate: '2026/05/14',
      twDate: '約 2026/10/29',
      twIsPredicted: true,
      pilots: ['安'],
      mechs: ['奈芙蒂斯（中甲）'],
      revivedBanners: ['業火搖光（機師: 瑪阿特）', '莉棘信仰（機兵: 殉道士）'],
      specialEvents: ['限時活動「回盤戰線」', '限時簽到活動', '角雕輪盤（末週）'],
      rouletteEvent: true,
    },
    crisisShop: ['繪梨沙', '弗雷'],
    arenaShop: '塔納托斯(10/22)',
    grayOpsUpdates: [
      { company: '武裝工坊', newMechs: ['彌造者'] },
      { company: '創新動力', newMechs: ['殉道士'] },
    ],
  },
]

// ── Firebase 初始化 ───────────────────────────────────────────────────────────

let db

function loadEnv(filename) {
  const envPath = resolve(ROOT, filename)
  if (!fs.existsSync(envPath)) return
  fs.readFileSync(envPath, 'utf-8').split('\n').forEach(line => {
    const eqIdx = line.indexOf('=')
    if (eqIdx > 0) {
      const k = line.slice(0, eqIdx).trim()
      const v = line.slice(eqIdx + 1).trim()
      if (k && v) process.env[k] = v
    }
  })
}

function initFirebase() {
  loadEnv('.env')
  loadEnv('.env.migration')
  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
  if (!credPath) throw new Error('GOOGLE_APPLICATION_CREDENTIALS 未設定')
  const absCredPath = resolve(ROOT, credPath)
  if (!fs.existsSync(absCredPath)) throw new Error(`找不到服務帳號金鑰：${absCredPath}`)
  const serviceAccount = JSON.parse(fs.readFileSync(absCredPath, 'utf-8'))
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) })
  db = admin.firestore()
}

async function promptConfirm(question) {
  if (AUTO) return true
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise(res => {
    rl.question(question, answer => {
      rl.close()
      res(answer.trim().toLowerCase() === 'y')
    })
  })
}

// ── 主程式 ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🔧 patchVersions Firestore 初始化腳本')
  console.log(`   模式：${DRY ? 'DRY-RUN（只預覽，不寫入）' : '實際寫入'}`)
  console.log('')

  initFirebase()

  const COLLECTION = 'patchVersions'
  console.log(`📋 準備寫入 ${PATCH_VERSIONS.length} 筆版本資料至 ${COLLECTION} Collection：`)
  for (const v of PATCH_VERSIONS) {
    console.log(`   v${v.version} → Document ID: v${v.version}`)
  }
  console.log('')

  if (DRY) {
    console.log('（DRY-RUN：以下為預覽，不會實際寫入）')
    for (const v of PATCH_VERSIONS) {
      console.log(`  [SKIP] ${COLLECTION}/v${v.version}`)
    }
    console.log('\n✅ DRY-RUN 完成')
    return
  }

  const confirmed = await promptConfirm(`確認寫入 ${PATCH_VERSIONS.length} 筆至 Firestore？（y/N）: `)
  if (!confirmed) {
    console.log('已取消。')
    return
  }

  // 檢查現有資料
  process.stdout.write('🔍 檢查現有 patchVersions 資料...')
  const existingSnap = await db.collection(COLLECTION).get()
  console.log(` 現有 ${existingSnap.size} 筆`)

  if (existingSnap.size > 0 && !AUTO) {
    const overwrite = await promptConfirm('Collection 已有資料，確認覆蓋？（y/N）: ')
    if (!overwrite) {
      console.log('已取消。')
      return
    }
  }

  // 批次寫入
  const batch = db.batch()
  for (const v of PATCH_VERSIONS) {
    const docId  = `v${v.version}`
    const docRef = db.collection(COLLECTION).doc(docId)
    batch.set(docRef, v)
    console.log(`  ✎ ${COLLECTION}/${docId}`)
  }

  await batch.commit()
  console.log(`\n✅ 完成：${PATCH_VERSIONS.length} 筆版本資料已寫入 Firestore`)
}

main().catch(err => {
  console.error('❌ 錯誤：', err.message)
  process.exit(1)
})

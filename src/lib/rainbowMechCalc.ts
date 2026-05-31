import type {
  PlannerInput,
  PlannerResult,
  SlotPlan,
  Gold3Node,
  Gold2Node,
  FertPair,
  Gold1Node,
  SlotInventory,
} from '../types/mechUpgrade'
import type { MechPartPosition } from '../types/enums'

// ─── 內部狀態 ─────────────────────────────────────────────────────────────────

/** 跨部位共用的可消耗資源池（mutable） */
interface ResourcePool {
  sfS:      number
  sfSp:     number
  sfSpp:    number
  universal: number
  coreGold3: number
  fertPool:  number   // 跨部位散件金二，僅供肥料
  // 使用量紀錄
  sfSUsed:       number
  sfSpUsed:      number
  sfSppUsed:     number
  universalUsed: number
  coreGold3Used: number
}

/** 單部位消耗追蹤（mutable） */
interface SlotState {
  g1: number
  g2: number
}

// ─── 節點規劃函式 ─────────────────────────────────────────────────────────────

function planGold1(state: SlotState, pool: ResourcePool): Gold1Node {
  if (state.g1 > 0)    { state.g1--;    return { source: 'owned' } }
  if (pool.sfS > 0)    { pool.sfS--;    pool.sfSUsed++;    return { source: 'sf_s' } }
  if (pool.universal > 0) { pool.universal--; pool.universalUsed++; return { source: 'universal' } }
  return { source: 'shortage' }
}

function planTargetGold2(state: SlotState, pool: ResourcePool): Gold2Node {
  if (state.g2 > 0) { state.g2--; return { source: 'owned' } }
  // 需從金一合成
  const gold1a = planGold1(state, pool)
  const gold1b = planGold1(state, pool)
  return { source: 'synth', gold1a, gold1b }
}

function planFerts(state: SlotState, pool: ResourcePool): FertPair {
  // S+ 優先（1個 S+ 涵蓋兩個肥料）
  if (pool.sfSp > 0) {
    pool.sfSp--; pool.sfSpUsed++
    return { usedSp: true, fert1: 'owned', fert2: 'owned' }
  }
  const getFert = (): 'owned' | 'shortage' => {
    if (state.g2 > 0)       { state.g2--;       return 'owned' }
    if (pool.fertPool > 0)  { pool.fertPool--;   return 'owned' }
    return 'shortage'
  }
  return { usedSp: false, fert1: getFert(), fert2: getFert() }
}

/**
 * 規劃部位的第 gold3Idx 個金三（0 或 1）。
 * 消耗順序：已擁有 → S++ → 核心金三 → 合成（目標金二 + 肥料）。
 */
function planGold3(
  gold3Idx:   number,
  gold3Owned: number,
  state:      SlotState,
  pool:       ResourcePool,
): Gold3Node {
  if (gold3Owned > gold3Idx) return { source: 'owned' }
  if (pool.sfSpp > 0)        { pool.sfSpp--;    pool.sfSppUsed++;    return { source: 'sf_spp' } }
  if (pool.coreGold3 > 0)    { pool.coreGold3--; pool.coreGold3Used++; return { source: 'coreGold3' } }

  const targetGold2 = planTargetGold2(state, pool)
  const ferts       = planFerts(state, pool)
  return { source: 'synth', targetGold2, ferts }
}

// ─── 缺口分析 ─────────────────────────────────────────────────────────────────

function gold3HasShortage(node: Gold3Node): boolean {
  if (node.source !== 'synth') return false
  const g2 = node.targetGold2!
  if (g2.source === 'synth') {
    if (g2.gold1a?.source === 'shortage' || g2.gold1b?.source === 'shortage') return true
  }
  const f = node.ferts!
  return !f.usedSp && (f.fert1 === 'shortage' || f.fert2 === 'shortage')
}

function countShortages(a: Gold3Node, b: Gold3Node): { gold1: number; fert: number } {
  let gold1 = 0
  let fert  = 0
  for (const node of [a, b]) {
    if (node.source !== 'synth') continue
    const g2 = node.targetGold2!
    if (g2.source === 'synth') {
      if (g2.gold1a?.source === 'shortage') gold1++
      if (g2.gold1b?.source === 'shortage') gold1++
    }
    const f = node.ferts!
    if (!f.usedSp) {
      if (f.fert1 === 'shortage') fert++
      if (f.fert2 === 'shortage') fert++
    }
  }
  return { gold1, fert }
}

function buildShortageMessages(a: Gold3Node, b: Gold3Node): string[] {
  const { gold1, fert } = countShortages(a, b)
  const msgs: string[] = []
  if (gold1 > 0) msgs.push(`缺少金一 ×${gold1}`)
  if (fert  > 0) msgs.push(`缺少金二肥料 ×${fert}`)
  return msgs
}

// ─── 主計算函式 ───────────────────────────────────────────────────────────────

function processSlot(inv: SlotInventory, pool: ResourcePool): SlotPlan {
  const state: SlotState = { g1: inv.gold1, g2: inv.gold2 }

  const gold3a = planGold3(0, inv.gold3, state, pool)
  const gold3b = planGold3(1, inv.gold3, state, pool)

  // 剩餘的同部位金二可作為其他部位的肥料
  pool.fertPool += state.g2

  const canRainbow = !gold3HasShortage(gold3a) && !gold3HasShortage(gold3b)
  const shortages  = canRainbow ? [] : buildShortageMessages(gold3a, gold3b)

  return { slot: inv.slot, gold3a, gold3b, canRainbow, shortages }
}

/**
 * 彩甲升級最優路線計算。
 *
 * 策略優先序：
 * 1. S++ / 核心金三 優先分給「已有 1 個金三」的部位（一步達成彩甲）
 * 2. S+ 優先用於肥料需求（S+ 用完才用散件金二）
 * 3. S / 通用模組 補充金一缺口
 * 4. 同部位剩餘金二自動流入肥料池供其他部位使用
 */
export function calculateRainbowPlan(input: PlannerInput): PlannerResult {
  const sf = input.superFactory
  const pool: ResourcePool = {
    sfS:      sf.enabled ? sf.sCount   : 0,
    sfSp:     sf.enabled ? sf.spCount  : 0,
    sfSpp:    sf.enabled ? sf.sppCount : 0,
    universal:  input.modules.universal,
    coreGold3:  input.modules.coreGold3,
    fertPool:   input.gold2FertPool,
    sfSUsed:       0,
    sfSpUsed:      0,
    sfSppUsed:     0,
    universalUsed: 0,
    coreGold3Used: 0,
  }

  // 排序：gold3===1 的部位優先（S++/核心金三 效益最高）
  const sortPriority = (inv: SlotInventory): number =>
    inv.gold3 === 1 ? 0 : inv.gold3 === 0 ? 1 : 2

  const sorted = [...input.parts].sort((a, b) => sortPriority(a) - sortPriority(b))

  // 記錄原始順序，結果按原順序輸出
  const originalOrder = input.parts.map(p => p.slot)
  const slotMap = new Map<MechPartPosition, SlotPlan>()

  for (const inv of sorted) {
    slotMap.set(inv.slot, processSlot(inv, pool))
  }

  const slots = originalOrder
    .filter(slot => slotMap.has(slot))
    .map(slot => slotMap.get(slot)!)

  return {
    slots,
    rainbowCount: slots.filter(p => p.canRainbow).length,
    sfUsed:      { s: pool.sfSUsed, sp: pool.sfSpUsed, spp: pool.sfSppUsed },
    modulesUsed: { universal: pool.universalUsed, coreGold3: pool.coreGold3Used },
  }
}

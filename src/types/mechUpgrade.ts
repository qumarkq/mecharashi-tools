import type { ArmorType, MechPartPosition } from './enums'

export type PartLevel = 'none' | 'gold1' | 'gold2' | 'gold3' | 'rainbow'

// ─── 輸入型別 ─────────────────────────────────────────────────────────────────

export interface SlotInventory {
  slot:  MechPartPosition
  gold1: number
  gold2: number
  gold3: number
}

export interface ModuleInventory {
  universal:  number  // 通用改進模組（須對應機甲 ArmorType 重量）
  coreRaw:    number  // 核心改進模組（原始）
  coreGold2:  number  // 核心改進（金二）
  coreGold3:  number  // 核心改進（金三）= 萬能金三，須對應機甲重量
}

export interface SuperFactoryResources {
  enabled:  boolean
  sCount:   number   // S 零件  = 萬能金一（無重量限制）
  spCount:  number   // S+ 零件 = 替代兩個金二肥料（無重量限制）
  sppCount: number   // S++ 零件 = 萬能金三（無重量限制）
}

export interface PlannerInput {
  targetMechId:  string
  armorType:     ArmorType
  parts:         SlotInventory[]   // 僅含玩家持有部件的部位
  gold2FertPool: number            // 散件金二（任意來源），僅供肥料使用
  modules:       ModuleInventory
  superFactory:  SuperFactoryResources
}

// ─── 計算結果型別 ─────────────────────────────────────────────────────────────

export interface Gold1Node {
  source: 'owned' | 'sf_s' | 'universal' | 'shortage'
}

export interface Gold2Node {
  source: 'owned' | 'synth'
  gold1a?: Gold1Node   // defined when source === 'synth'
  gold1b?: Gold1Node   // defined when source === 'synth'
}

/** 一次金二→金三合成所需的兩個肥料 */
export interface FertPair {
  usedSp: boolean              // true 時 S+ 涵蓋兩個肥料，fert1/fert2 均視為滿足
  fert1:  'owned' | 'shortage' // usedSp=false 時有效
  fert2:  'owned' | 'shortage' // usedSp=false 時有效
}

export interface Gold3Node {
  source:       'owned' | 'sf_spp' | 'coreGold3' | 'synth'
  targetGold2?: Gold2Node  // source === 'synth' 時存在
  ferts?:       FertPair   // source === 'synth' 時存在
}

export interface SlotPlan {
  slot:       MechPartPosition
  gold3a:     Gold3Node   // 彩甲所需第一個金三
  gold3b:     Gold3Node   // 彩甲所需第二個金三
  canRainbow: boolean
  shortages:  string[]    // 缺乏材料清單（顯示用）
}

export interface PlannerResult {
  slots:        SlotPlan[]
  rainbowCount: number
  sfUsed:       { s: number; sp: number; spp: number }
  modulesUsed:  { universal: number; coreGold3: number }
}

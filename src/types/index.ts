// ─── 機師 ──────────────────────────────────────────────────────────────────

export interface PilotStats {
  melee: number
  assault: number
  shooting: number
  tactics: number
  defense: number
  engineering: number
}

export interface PilotSkill {
  name: string
  type: string
  ap?: string
  weapon?: string
  description: string
  icon: string
  iconLocal: string
  dmg: number
  crit: number
  critDmg: number
  acc: number
}

export interface PilotTalent {
  name: string
  type: string
  description: string
  descriptionMax: string
  icon: string
  iconLocal: string
  dmg: number
  crit: number
  critDmg: number
  acc: number
}

export interface NeuralDriveLevel {
  level: number
  minSum: number
  effect: string
  skillName: string
  skillIcon: string
  iconLocal: string
}

export interface NeuralDrive {
  name: string
  icon: string
  slots: string[]
  levels: NeuralDriveLevel[]
  dmg: number
  crit: number
  critDmg: number
  acc: number
}

export interface Pilot {
  id: string
  name: string
  fullName: string
  rarity: string
  class: string
  faction: string
  license: string
  masterLevel: string
  profile: {
    gender: string
    bloodType: string
    height: string
    additionalInfo: Record<string, string>
  }
  stats: PilotStats
  statsBase: Record<string, number>
  ap: { init: number; max: number; recovery: number }
  apBase: { init: number; max: number; recovery: number }
  talents: PilotTalent[]
  skills: PilotSkill[]
  neuralDrive: NeuralDrive[]
  portrait: string
  portraitUrl?: string
  lore?: string
  attack?: number
  defense?: number
}

// ─── 模組（v1.4 更新：新增綁定部位與來源標記）────────────────────────────────

export interface Module {
  id: string
  name: string
  /** 模組槽位："4mod" 四模 / "8mod" 八模 / "fixed" 固定模（單個）/ "fixed_N" 固定模（多個，N 從 1 起） */
  slot: '4mod' | '8mod' | 'fixed' | `fixed_${number}`
  /** 綁定機甲 ID；null = 通用模組（可自由裝配） */
  boundMechId: string | null
  /** 綁定部位；null = 不限部位 */
  boundPart: 'torso' | 'leftArm' | 'rightArm' | 'legs' | null
  dmg: number
  crit: number
  critDmg: number
  acc: number
  description: string
  rarity: string
  /** 本地圖示路徑 /images/modules/{iconKey}.png */
  icon?: string
  /** 來源標記："auto" 腳本自動擷取 / "manual" 管理者手動新增 */
  source?: 'auto' | 'manual'
}

// ─── 機甲部件（v1.4 新增：獨立部件資料）──────────────────────────────────────

export interface MechPart {
  position: 'torso' | 'leftArm' | 'rightArm' | 'legs'
  durable: number
  armor: number
  firepower: number
  /** 命中（僅左右臂有） */
  hit?: number
  /** 閃避（僅腿部有） */
  dodge?: number
  /** 移動力（僅腿部有） */
  move?: number
  /** 抗暴（僅軀幹有） */
  antiRiot?: number
  /** 出力（僅軀幹有） */
  output?: number
  weight: number
  interface: string
  /** 部件圖示路徑 /images/mechs/{機甲名}/{position}.png */
  icon?: string
  /** 遊戲內部資產名（用於 CDN waparts/ 路徑） */
  mechaIcon?: string
}

// ─── 機甲（v1.4 更新：部件詳細資料 + 模組映射）──────────────────────────────

export interface Mech {
  id: string
  name: string
  armorType: string
  firepower: number
  armor: number
  evasion: number
  mobility: number
  weight: number
  output: number
  /** 各部件詳細資料 */
  parts: {
    torso: MechPart
    leftArm: MechPart
    rightArm: MechPart
    legs: MechPart
  }
  /** → modules.json 四格模組 ID */
  module4Id: string
  /** → modules.json 八格模組 ID */
  module8Id: string
  /** → modules.json 固定模組 ID 列表（多數機甲1個，特殊機甲可有多個） */
  moduleFixedIds: string[]
  portrait?: string
  /** 立繪半身像路徑 */
  halfPortrait?: string
  quality?: string
  lore?: string
}

/** 舊版部件耐久（向後相容） */
export interface MechPartsLegacy {
  torso: number
  leftArm: number
  rightArm: number
  legs: number
}

// ─── 武器 ──────────────────────────────────────────────────────────────────

export interface WeaponSkill {
  name: string
  type: string
  /** 生效方式："carry" 攜帶即生效 / "equip" 裝備中生效 / "use" 僅使用時生效 */
  activation: 'carry' | 'equip' | 'use'
  description: string
  dmg?: number
  crit?: number
  critDmg?: number
  acc?: number
  enhancesTalent?: string
}

export interface WeaponFixedModEffect {
  stat: 'attack' | 'crit' | 'accuracy' | string
  value: number
}

export interface WeaponFloatingModEffect {
  stat: 'attack' | 'crit' | 'accuracy' | 'firepower' | string
  condition: string | null
  min: number
  max: number
}

export interface Weapon {
  id: string
  name: string
  category: string
  type: string
  typeCoefficient: number
  attack: string
  accuracy: number
  critValue: number
  range: string
  weight: number
  rarity: string
  isExclusive: boolean
  exclusiveFor?: string
  triggerSlots: number
  effectSlots: number
  fixedMod: {
    planName: string
    maxLevel: number
    effects: WeaponFixedModEffect[]
  }
  floatingMod: {
    planName: string
    slots: number
    possibleEffects: WeaponFloatingModEffect[]
  }
  skills: WeaponSkill[]
}

// ─── 背包 ──────────────────────────────────────────────────────────────────

export interface Backpack {
  id: string
  name: string
  type: string
  weight: number
  slot: string
  /** 機甲限制：null = 無限制，"light" = 僅輕甲，"medium" = 僅中甲，"heavy" = 僅重甲 */
  mechRestriction: string | null
  skill: {
    name: string
    type: string
    description: string
    dmg?: number
    crit?: number
    critDmg?: number
    acc?: number
    specialEffects?: string[]
  }
}

// ─── 元件（v1.2 更新）────────────────────────────────────────────────────────

export interface TriggerComponent {
  id: string
  name: string
  slot: 'trigger'
  level: number
  probability: '概率' | '必定'
  condition: string
  conditionType:
    | 'dualWield'
    | 'singleWield'
    | 'firstAttack'
    | 'apCost'
    | 'targetTorso'
    | 'always'
  conditionValue: number | null
  rarity: string
}

export interface EffectComponent {
  id: string
  name: string
  slot: 'effect'
  level: number
  probability: '概率' | '必定'
  /** 效果類型（僅收錄傷害模擬器需要的 6 類）*/
  effectType:
    | 'dmgBoost'
    | 'bulletAdd'
    | 'multiplierBoost'
    | 'armorBreak'
    | 'apDmgBoost'
    | 'torsoDmgBoost'
  value: number
  description: string
  rarity: string
}

export type Component = TriggerComponent | EffectComponent

// ─── 機師個別科研（v1.1 新增）────────────────────────────────────────────────

export interface ResearchTraitOption {
  name: string
  description: string
  dmg: number
  crit: number
  critDmg: number
  acc: number
}

export interface ResearchTraitSlot {
  slot: number
  options: ResearchTraitOption[]
}

export interface ExclusionRule {
  slotA: number
  optionA: string
  slotB: number
  optionB: string
}

export interface PilotResearch {
  pilotId: string
  /** 機師特質 (I/II/III 欄位各有多個選項，選其一安裝) */
  pilotTraits: ResearchTraitSlot[]
  /** 機甲特質 (I/II/III) */
  mechTraits: ResearchTraitSlot[]
  /** 武裝特質 (I/II/III) */
  weaponTraits: ResearchTraitSlot[]
  exclusionRules: ExclusionRule[]
}

// ─── 全域科研（v1.1 新增）────────────────────────────────────────────────────

export interface ClassResearchBonus {
  flatBonus: Record<string, number>
  percentBonus: Record<string, number>
}

export interface MechTypeResearchBonus {
  flatBonus: Record<string, number>
  percentBonus: Record<string, number>
}

export interface WeaponTypeResearchBonus {
  bonus: Record<string, number>
}

export interface GlobalResearch {
  /** 機師科研：依職業分類 */
  pilotResearchByClass: Record<string, ClassResearchBonus>
  /** 機甲科研：依裝甲類型分類 */
  mechResearchByType: Record<string, MechTypeResearchBonus>
  /** 武器科研：依武器種類分類 */
  weaponResearchByType: Record<string, WeaponTypeResearchBonus>
}

// ─── 配裝（Firestore userBuilds / 本地快取）───────────────────────────────────

export interface FloatingModSelection {
  stat: string
  condition: string | null
  value: number
}

export interface Build {
  buildName: string
  pilotId: string
  mechId: string
  weaponId: string
  backpackId: string
  modules: {
    slot4: string | null
    slot8: string | null
    fixed: string[]
  }
  weaponFixedMod: Record<string, number>
  weaponFloatingMod: FloatingModSelection[]
  triggerComponents: string[]
  effectComponents: string[]
  pilotResearch: Record<string, number>
  result?: Record<string, number>
  createdAt?: string | number
}

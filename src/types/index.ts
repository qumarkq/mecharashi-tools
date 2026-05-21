// ─── 技能 / Buff 共用型別（PLAN-001）────────────────────────────────────────

/**
 * 武器技能的武器需求。
 * logic='or'  → categories 中任一種武器即可觸發
 * logic='and' → 必須同時持有 categories 中所有武器（通常為雙持同種）
 * logic='dual'→ 雙持：leftHand / rightHand 各自指定武器種類（null = 任意）
 */
export interface WeaponRequirement {
  logic: 'or' | 'and' | 'dual'
  /** logic='or'/'and' 時：武器種類列表 */
  categories?: string[]
  /** logic='dual' 時：左手武器種類；null 表示任意 */
  leftHand?: string | null
  /** logic='dual' 時：右手武器種類；null 表示任意 */
  rightHand?: string | null
}

/** 將 WeaponRequirement 格式化為顯示用字串（向後相容 string 型別） */
export function formatWeaponReq(weapon: WeaponRequirement | string | undefined): string {
  if (!weapon) return ''
  if (typeof weapon === 'string') return weapon
  if (weapon.logic === 'dual') {
    const l = weapon.leftHand ?? '任意'
    const r = weapon.rightHand ?? '任意'
    return `雙持 左:${l} 右:${r}`
  }
  const sep = weapon.logic === 'and' ? ' + ' : ' / '
  return (weapon.categories ?? []).join(sep)
}

/** 觸發條件（顯示給玩家的說明標籤，計算器不自動判斷） */
export interface SkillCondition {
  trigger:      string
  weaponType?:  string
  weaponKind?:  string
  hpThreshold?: number
  minApCost?:   number
  targetClass?: string
  /** trigger='hasBuff' 時：需持有的 buff / 狀態名稱（如 '強化射擊'、'瞄準'） */
  hasBuff?:     string
}

/** 單一可計算效果條目 */
export interface SkillEffect {
  /** 影響屬性，與 Module 平坦欄位名稱對齊：
   *  'dmg' | 'crit' | 'critDmg' | 'acc'
   *  'dmg_assault' | 'dmg_melee' | 'dmg_shooting' | 'dmg_tactical'
   *  'dmg_blade' | 'dmg_machinegun' | ... (武器種類，同 Module)
   *  'range' | 'armor_rate' | 'firepower_rate' | ... (其他屬性) */
  stat:        string
  value:       number
  /** 數值計算方式：'add'（預設，加算）/ 'override'（覆蓋原始值，如係數 0.15→0.2） */
  valueType?:  'add' | 'override'
  scope:       string
  condition:   SkillCondition | null
}

/** buffs Collection 文件 */
export interface GameBuff {
  id:          string
  name:        string
  description: string
  icon?:       string
  buffType:    string
  maxStack?:   number
  duration?:   number
  effects:     SkillEffect[]
}

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
  /** SkillType enum：被動技能 / 主動技能 / 指令技能 / 必殺技能 / 武器技能 */
  type: string
  /** biometicComputer 單元類型："0"=核心單元 "6"=職業單元 */
  unitType?: string
  ap?: string
  /** 冷卻回合數；指令技能（type=指令技能）才有 */
  cd?: string
  /** 限定武器需求；武器技能（type=武器技能）才有 */
  weapon?: WeaponRequirement | string
  description: string
  icon: string
  iconLocal: string
  effects:  SkillEffect[]
  buffIds:  string[]
}

export interface PilotTalent {
  name: string
  type: string
  description: string
  descriptionMax: string
  icon: string
  iconLocal: string
  effects:          SkillEffect[]
  enhancedEffects?: SkillEffect[]
  buffIds:          string[]
}

export interface NeuralDriveLevel {
  level: number
  minSum: number
  effect: string
  skillName: string
  skillIcon: string
  iconLocal: string
  effects: SkillEffect[]
  buffIds: string[]
}

export interface NeuralDrive {
  name: string
  icon: string
  slots: string[]
  levels: NeuralDriveLevel[]
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

// ─── 模組（v1.9 更新：欄位重命名 + 新增防禦/機體屬性欄位）─────────────────────

export interface ConditionalEffect {
  /** ConditionalTrigger enum value */
  trigger: string
  /** 觸發門檻值（apSkill 時為最低 AP 數） */
  minCount?: number
  /** 受影響的屬性欄位名稱，對應 Module 頂層欄位 */
  stats: string[]
  base?: number
  scale?: number
  max?: number
  maxStacks?: number
  /** null / 未設定 = 永久 */
  duration?: number
  resetOn?: 'attack' | 'turn' | null
}

export interface ModuleLevel {
  level: number
  description: string
  dmg: number
  crit_rate: number
  critDmg: number
  acc_rate: number
  firepower_rate: number
  armor_rate: number
  crit_resist_rate: number
  output_bonus: number
  dodge_rate: number
  durable_rate: number
  dmg_resist_rate: number
  // 武器類別增傷
  dmg_assault?: number
  dmg_melee?: number
  dmg_shooting?: number
  dmg_tactical?: number
  // 武器種類增傷
  dmg_blade?: number
  dmg_polearm?: number
  dmg_missile?: number
  dmg_rocket?: number
  dmg_shotgun?: number
  dmg_machinegun?: number
  dmg_heavy_machinegun?: number
  dmg_railgun?: number
  dmg_funnel?: number
  dmg_sniper_light?: number
  dmg_sniper?: number
  dmg_fist?: number
  dmg_pile?: number
  dmg_chainsaw?: number
  dmg_flamethrower?: number
  // 特殊情境增傷
  dmg_counter?: number
  dmg_enemy_phase?: number
}

export interface Module {
  id: string
  name: string
  /** 模組槽位：使用 ModuleSlot enum 值（'機甲特性模組'/'機甲8級模組'/'通用模組'/'機甲副模組'/'機甲專屬模組'） */
  slot: string
  /** 綁定機甲 ID；null = 通用模組（可自由裝配） */
  boundMechId: string | null
  /** 綁定部位（陣列，v2.2 改為複數）；MechPartPosition enum 值組成的陣列；null 或 [] = 不限部位 */
  boundPart: string[] | null
  /** 可獨立取得：特性/8級/通用 = true；副模組 = false */
  available?: boolean
  dmg: number
  crit_rate: number
  critDmg: number
  acc_rate: number
  firepower_rate: number
  armor_rate: number
  crit_resist_rate: number
  output_bonus: number
  dodge_rate: number
  durable_rate: number
  dmg_resist_rate: number
  // 武器類別增傷
  dmg_assault?: number
  dmg_melee?: number
  dmg_shooting?: number
  dmg_tactical?: number
  // 武器種類增傷
  dmg_blade?: number
  dmg_polearm?: number
  dmg_missile?: number
  dmg_rocket?: number
  dmg_shotgun?: number
  dmg_machinegun?: number
  dmg_heavy_machinegun?: number
  dmg_railgun?: number
  dmg_funnel?: number
  dmg_sniper_light?: number
  dmg_sniper?: number
  dmg_fist?: number
  dmg_pile?: number
  dmg_chainsaw?: number
  dmg_flamethrower?: number
  // 特殊情境增傷
  dmg_counter?: number
  dmg_enemy_phase?: number
  description: string
  /** ModuleRarity enum：'S' / 'A' */
  rarity: string
  /** 本地圖示路徑 /images/modules/{iconKey}.png */
  icon?: string
  /** 遊戲取得途徑（可複數）：ModuleSource enum 陣列（'商店'/'拆機甲'/'未知'） */
  source?: string[]
  /** 拆解可得此模組的機甲 ID 列表（對應 mechs collection）；僅 source 含 '拆機甲' 時有意義 */
  dismantleMechIds?: string[]
  /** 後台資料維護標記：ModuleDataSource enum（'auto'='腳本自動擷取' / 'manual'='管理者手動新增'） */
  managedBy?: string
  /** 各等級資料（特性/8級/通用模組有；副模組為空陣列） */
  levels?: ModuleLevel[]
  /** 條件效果（傷害模擬器用；無條件效果或副模組為空陣列） */
  conditionalEffects?: ConditionalEffect[]
  /** 模組增加等級（配裝時在插槽中增加的模組等級，預設 1；配裝模擬器累加所有嵌入模組的此值） */
  moduleAddLevel?: number
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
  /** → modules.json 四格模組 ID；無特性模組的機甲可省略 */
  module4Id?: string
  /** → modules.json 八格模組 ID；無8級模組的機甲可省略 */
  module8Id?: string
  /** → modules.json 固定模組 ID 列表（多數機甲1個，特殊機甲可有多個） */
  moduleFixedIds: string[]
  /**
   * 肩膀武器欄位（有肩膀武器槽的機甲才有此欄位）
   * null = 空槽（可自由裝備肩膀武器）
   * string = 固定武器 ID（部件綁死，不可更換）
   */
  leftShoulderSlot?: string | null
  rightShoulderSlot?: string | null
  /**
   * 背後武器欄位（有背後武器槽的機甲才有此欄位）
   * null = 空槽，string = 固定武器 ID
   */
  backSlot?: string | null
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
  /** 技能圖示遠端 URL（API 原始路徑） */
  icon?: string
  /** 技能圖示本地路徑（如 /images/weapons/skills/Icon_skill_xxxxx.png）；前端縮圖顯示用 */
  iconLocal?: string
  type: string
  /** 生效方式："carry" 攜帶即生效 / "equip" 裝備中生效 / "use" 僅使用時生效 */
  activation: 'carry' | 'equip' | 'use'
  description: string
  effects:                     SkillEffect[]
  buffIds:                     string[]
  enhancesTalentName?:         string
  /** 天賦被此專武強化後的完整描述文字（遊戲原文）；用於與天賦原文做 DiffHighlight 差異對比 */
  enhancedTalentDescription?:  string
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
  /** 武器背景故事文字（API: describe） */
  description?: string
  /** 武器圖示本地路徑，如 /images/weapons/Icon_weapon_10001.png */
  icon?: string
  type:            string  // WeaponType：射擊 / 格鬥 / 突擊 / 戰術
  kind:            string  // 武器種類：機槍 / 狙擊步槍 / 刀劍…
  kindCoefficient: number
  attack: number           // API: WeaponBasicAttackingPower
  accuracy: number         // API: WeaponHitPoint（命中）
  critValue: number        // API: WeaponUnderstanding（暴擊值）
  rangeType:  string  // RangeType：'manhattan' | 'orthogonal' | 'ring'
  minRange:   number
  maxRange:   number
  weight: number      // API: WeaponWeight（重量）
  ammoCount: number
  hitCount: number
  rarity: string  // WeaponRarity：'SS' | 'S+' | 'S' | 'A' | 'B'
  mechRestriction: string  // MechRestriction：'none' | 'light' | 'medium' | 'heavy' · API: LimitedModelOfWeapon
  equipSlot: string        // WeaponEquipSlot：singleHand / dualHand / shoulder / back · API: RestrictionsPositionOfWeapon
  isExclusive: boolean
  exclusiveFor?: string
  triggerSlots: number
  effectSlots: number
  /** 元件上限：觸元件＋應元件總數不可超過此值（SS/S+=4, S=3, 其他=0） */
  componentLimit: number
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
  skills: WeaponSkill[]    // API: PassiveSkill[]
}

// ─── 背包 ──────────────────────────────────────────────────────────────────

export interface Backpack {
  id: string
  name: string
  /** 背包圖示 URL · https://media.zlongame.com/media/pictures/cn/community/img/gl/gameInfo/pack/Icon_backpack_{ID}.png */
  icon?: string
  type: string            // BackpackType：'Heal' | 'Ammo' | 'Interference' | 'Invisible' | 'BackupEquipment' | 'MovePointAdd' | 'Flow'
  rarity: string          // WeaponRarity（與武器共用）：'SS' | 'S+' | 'S' | 'A' | 'B' · API quality: SSSR→SS / UR→S+ / SSR→S / SR→A / R→B
  weight: number          // 重量（佔機甲出力）· API: weight
  slot: string                // WeaponEquipSlot：固定為 'back'（WeaponEquipSlot.BACK）；與武器共用 enum 供裝備計算器統一判斷部位
  assemblableArmorType: string[]  // AssemblableArmorType 陣列（正向邏輯）：[] = 無限制；['Light'] / ['Medium'] / ['Heavy'] / 複數 = 指定機甲類型 · API: AssemblableAirmenType
  repairAmount: number    // 修理量；非修理類背包填 0 · API: AmountOfRepair
  /** 背包附帶技能（API: WithPassiveSkills[0]）；僅 SS 稀有度（API quality: SSSR）有此欄位 */
  mainSkill?: {
    id: string            // API: WithPassiveSkills[0].ID
    name: string          // API: WithPassiveSkills[0].name
    icon?: string         // API: WithPassiveSkills[0].SkillIcon / .icon（鍵名格式）
    description: string   // API: WithPassiveSkills[0].SpecificEffects（清洗 rich text 標籤後）
    buffIds: string[]     // API: WithPassiveSkills[0].BufCarried（'/' 分隔 → split）
    // 以下為管理員手動填入的結構化效果數值
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

// ─── 用戶系統（Phase 5）────────────────────────────────────────────────────────

export interface UserResearchLevels {
  /** 機師科研完成度：{ 職業名: 0-100 (%) } */
  pilotByClass: Record<string, number>
  /** 機甲科研完成度：{ 裝甲類型: 0-100 (%) } */
  mechByType: Record<string, number>
  /** 武器科研完成度：{ 武器種類: 0-100 (%) } */
  weaponByType: Record<string, number>
}

export interface UserProfile {
  uid: string
  displayName: string
  email: string
  photoURL?: string
  role: 'USER' | 'ADMIN'
  researchLevels: UserResearchLevels
  createdAt: string
  updatedAt: string
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

export interface UserBuild extends Build {
  id: string
  updatedAt: string
}

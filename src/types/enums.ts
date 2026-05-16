// ─── 機師 ────────────────────────────────────────────────────────────────────

export const PilotClass = {
  ASSAULT:   '突擊手',
  SNIPER:    '狙擊手',
  TACTICIAN: '戰術家',
  FIGHTER:   '格鬥家',
  GUARDIAN:  '守護者',
  ENGINEER:  '機械師',
  CONSTRUCTOR: '調構師',
} as const;
export type PilotClass = typeof PilotClass[keyof typeof PilotClass];

export const MechLicense = {
  LIGHT:  '輕型',
  MEDIUM: '中型',
  HEAVY:  '重型',
} as const;
export type MechLicense = typeof MechLicense[keyof typeof MechLicense];

// ─── 通用稀有度 ────────────────────────────────────────────────────────────────

export const ItemRarity = {
  EX: 'EX',
  S:  'S',
  A:  'A',
  B:  'B',
} as const;
export type ItemRarity = typeof ItemRarity[keyof typeof ItemRarity];

// ─── 機甲 ────────────────────────────────────────────────────────────────────

export const ArmorType = {
  LIGHT:  '輕型',
  MEDIUM: '中甲',
  HEAVY:  '重型',
} as const;
export type ArmorType = typeof ArmorType[keyof typeof ArmorType];

export const MechPartPosition = {
  TORSO:     'torso',
  LEFT_ARM:  'leftArm',
  RIGHT_ARM: 'rightArm',
  LEGS:      'legs',
} as const;
export type MechPartPosition = typeof MechPartPosition[keyof typeof MechPartPosition];

// ─── 模組 ────────────────────────────────────────────────────────────────────

export const ModuleRarity = {
  S: 'S',
  A: 'A',
} as const;
export type ModuleRarity = typeof ModuleRarity[keyof typeof ModuleRarity];

export const ModuleSlot = {
  SLOT_4:    '機甲特性模組',
  SLOT_8:    '機甲8級模組',
  UNIVERSAL: '通用模組',
  BUILT_IN:  '機甲副模組',
  EXCLUSIVE: '機甲專屬模組',
} as const;
export type ModuleSlot = typeof ModuleSlot[keyof typeof ModuleSlot];

export const ModuleSource = {
  SHOP:              '商店',
  DISMANTLE:         '拆機甲',
  MECH_NO_DISMANTLE: '機甲不可拆',
  UNKNOWN:           '未知',
} as const;
export type ModuleSource = typeof ModuleSource[keyof typeof ModuleSource];

// 後台資料維護標記（非遊戲取得途徑）
export const ModuleDataSource = {
  AUTO:   'auto',
  MANUAL: 'manual',
} as const;
export type ModuleDataSource = typeof ModuleDataSource[keyof typeof ModuleDataSource];

// 模組條件效果觸發類型（傷害模擬器用）
export const ConditionalTrigger = {
  PER_BUFF_HELD:     'perBuffHeld',     // 每持有N個增益效果
  PER_COMBO:         'perCombo',        // 每N連擊
  AP_SKILL:          'apSkill',         // 使用N AP以上技能
  PER_AMMO_CONSUMED: 'perAmmoConsumed', // 每消耗N枚彈藥
  TACTICAL_WEAPON:   'tacticalWeapon',  // 使用戰術武器時（基礎觸發）
} as const;
export type ConditionalTrigger = typeof ConditionalTrigger[keyof typeof ConditionalTrigger];

// ─── 武器 ────────────────────────────────────────────────────────────────────

export const WeaponCategory = {
  SHOOTING: '射擊',
  MELEE:    '格鬥',
  ASSAULT:  '突擊',
  TACTICAL: '戰術',
} as const;
export type WeaponCategory = typeof WeaponCategory[keyof typeof WeaponCategory];

export const SkillActivation = {
  CARRY: 'carry',
  EQUIP: 'equip',
  USE:   'use',
} as const;
export type SkillActivation = typeof SkillActivation[keyof typeof SkillActivation];

export const MechRestriction = {
  NONE:       'none',
  LIGHT_ONLY: 'light',
  HEAVY_ONLY: 'heavy',
} as const;
export type MechRestriction = typeof MechRestriction[keyof typeof MechRestriction];

// ─── 技能 / BUFF ──────────────────────────────────────────────────────────────

export const SkillType = {
  PASSIVE: '被動技能',
  ACTIVE:  '主動技能',
} as const;
export type SkillType = typeof SkillType[keyof typeof SkillType];

// ─── 元件 ────────────────────────────────────────────────────────────────────

export const ComponentSlot = {
  TRIGGER: 'trigger',
  EFFECT:  'effect',
} as const;
export type ComponentSlot = typeof ComponentSlot[keyof typeof ComponentSlot];

export const ConditionType = {
  DUAL_WIELD:   'dualWield',
  SINGLE_WIELD: 'singleWield',
  FIRST_ATTACK: 'firstAttack',
  AP_COST:      'apCost',
  TARGET_TORSO: 'targetTorso',
  ALWAYS:       'always',
} as const;
export type ConditionType = typeof ConditionType[keyof typeof ConditionType];

export const EffectType = {
  DMG_BOOST:    'dmgBoost',
  BULLET_ADD:   'bulletAdd',
  MULTIPLIER:   'multiplierBoost',
  ARMOR_BREAK:  'armorBreak',
  AP_DMG_BOOST: 'apDmgBoost',
  TORSO_DMG:    'torsoDmgBoost',
} as const;
export type EffectType = typeof EffectType[keyof typeof EffectType];

// ─── 資料維護 / 用戶權限 ──────────────────────────────────────────────────────

export const DataManaged = {
  SCRIPT: 'SCRIPT',
  MANUAL: 'MANUAL',
} as const;
export type DataManaged = typeof DataManaged[keyof typeof DataManaged];

export const UserRole = {
  USER:  'USER',
  ADMIN: 'ADMIN',
} as const;
export type UserRole = typeof UserRole[keyof typeof UserRole];

// ─── 科研分類常數（與 Firestore globalResearch 結構同步） ──────────────────────

/** 可於科研頁設定的機師職業列表 */
export const RESEARCH_PILOT_CLASSES = ['格鬥家', '突擊手', '狙擊手', '戰術家', '守護者', '機械師'] as const

/** 可於科研頁設定的機甲類型列表 */
export const RESEARCH_MECH_TYPES = ['輕型', '中型', '重型'] as const

/** 可於科研頁設定的武器種類列表 */
export const RESEARCH_WEAPON_TYPES = ['狙擊步槍', '機槍', '重機槍', '刀劍', '拳套'] as const

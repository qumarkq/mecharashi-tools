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

// 類型
export const WeaponType = {
  Sniper: '射擊',
  Melee:    '格鬥',
  Assault:  '突擊',
  Heavy: '戰術',
} as const;
export type WeaponType = typeof WeaponType[keyof typeof WeaponType];

// 種類
export const WeaponKind = {
  // 格鬥類
  Shield:     '大盾',
  Buckler:      '手盾',
  Blade:            '刀劍',
  Knuckle:          '拳套',
  PileBunker:             '打樁機',
  Saw:         '電鋸',
  Rod:          '長柄',
  // 戰術類
  RailGun:          '電磁炮',
  Funnel:           '浮游炮',
  Missile:          '導彈',
  Rocket:           '火箭',
  // 突擊類
  ShotGun:          '霰彈槍',
  MachineGun:       '機槍',
  HeavyMachineGun: '重機槍',
  Flamethrower:     '噴火器',
  // 射擊類
  LightSniper:     '輕型狙擊步槍',
  HeavySniper:           '狙擊步槍',
} as const;
export type WeaponKind = typeof WeaponKind[keyof typeof WeaponKind];

export const WeaponEquipSlot = {
  SINGLE_HAND: 'singleHand', // 單手：左臂或右臂其中一個
  DUAL_HAND:   'dualHand',   // 雙手：同時佔據左右臂
  SHOULDER:    'shoulder',   // 肩膀：左臂或右臂其中一個肩膀
  BACK:        'back',       // 背後
} as const;
export type WeaponEquipSlot = typeof WeaponEquipSlot[keyof typeof WeaponEquipSlot];

export const RangeType = {
  MANHATTAN:  'manhattan',  // 菱形射程：Manhattan 距離，可打斜格。攻擊格：|dx|+|dy| ∈ [minRange, maxRange]
  ORTHOGONAL: 'orthogonal', // 十字直線：只能上下左右，不可打斜格（電磁炮）。攻擊格：(dx=0 XOR dy=0) AND |dx|+|dy| ∈ [minRange, maxRange]
  RING:       'ring',       // 環形 N 圈：Chebyshev 距離，方形覆蓋。攻擊格：max(|dx|,|dy|) ≤ maxRange，minRange 固定為 0
} as const;
export type RangeType = typeof RangeType[keyof typeof RangeType];

export const WeaponRarity = {
  SS:     'SS',
  S_PLUS: 'S+',
  S:      'S',
  A:      'A',
  B:      'B',
} as const;
export type WeaponRarity = typeof WeaponRarity[keyof typeof WeaponRarity];

export const SkillActivation = {
  CARRY: 'carry',
  EQUIP: 'equip',
  USE:   'use',
} as const;
export type SkillActivation = typeof SkillActivation[keyof typeof SkillActivation];

export const MechRestriction = {
  NONE:       'none',
  LIGHT_ONLY: 'light',
  MEDIUM_ONLY:'medium',
  HEAVY_ONLY: 'heavy',
} as const;
export type MechRestriction = typeof MechRestriction[keyof typeof MechRestriction];

// ─── 技能 / BUFF ──────────────────────────────────────────────────────────────

export const SkillType = {
  PASSIVE: '被動技能',
  ACTIVE:  '主動技能',
  COMMAND: '指令技能',  // Order — 有 CD，消耗 AP
} as const;
export type SkillType = typeof SkillType[keyof typeof SkillType];

// 技能觸發條件類型（顯示標籤用，非計算觸發）
export const PilotSkillTrigger = {
  ALWAYS:          'always',
  ON_ATTACK:       'onAttack',
  ON_COUNTER:      'onCounter',
  ON_AP_SKILL:     'onApSkill',
  WEAPON_TYPE: 'weaponType',
  DUAL_WIELD:      'dualWield',
  HP_BELOW:        'hpBelow',
  FIRST_ATTACK:    'firstAttack',
  ENEMY_PHASE:     'enemyPhase',
  ALLY_HAS_BUFF:   'allyHasBuff',
} as const;
export type PilotSkillTrigger = typeof PilotSkillTrigger[keyof typeof PilotSkillTrigger];

// 技能效果受益對象（隊伍計算器用）
export const SkillScope = {
  SELF: 'self',
  ALLY: 'ally',
  TEAM: 'team',
} as const;
export type SkillScope = typeof SkillScope[keyof typeof SkillScope];

// Buff 類型
export const BuffType = {
  STAT_BOOST: 'statBoost',
  RESOURCE:   'resource',
  STATE:      'state',
  DEBUFF:     'debuff',
  CONTROL:    'control',
} as const;
export type BuffType = typeof BuffType[keyof typeof BuffType];

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

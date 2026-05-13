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

export interface MechModule {
  name: string
  dmg: number
  crit: number
  critDmg: number
  acc: number
  description: string
}

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
  parts: {
    torso: number
    leftArm: number
    rightArm: number
    legs: number
  }
  module4: MechModule
  module8: MechModule
  moduleFixed: MechModule
}

export interface WeaponSkill {
  name: string
  type: string
  activation: string
  description: string
  dmg?: number
  crit?: number
  critDmg?: number
  acc?: number
  enhancesTalent?: string
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
    effects: Array<{ stat: string; value: number }>
  }
  floatingMod: {
    planName: string
    slots: number
    possibleEffects: Array<{ stat: string; condition?: string | null; min: number; max: number }>
  }
  skills: WeaponSkill[]
}

export interface Backpack {
  id: string
  name: string
  type: string
  weight: number
  slot: string
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

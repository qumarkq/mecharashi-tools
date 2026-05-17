import React from 'react'
import type { ModuleLevel } from '../types'

export type StatKey = Exclude<keyof ModuleLevel, 'level' | 'description'>

export interface StatLabel {
  key: StatKey
  label: string
  color: string
  suffix: string
  prefix?: string
}

export const STAT_LABELS: StatLabel[] = [
  { key: 'dmg',              label: '傷害',     color: 'text-accent-orange', suffix: '%' },
  { key: 'crit_rate',        label: '暴擊',     color: 'text-accent-yellow', suffix: '%' },
  { key: 'critDmg',          label: '爆傷',     color: 'text-accent-red',    suffix: '%' },
  { key: 'acc_rate',         label: '命中',     color: 'text-accent-blue',   suffix: '%' },
  { key: 'firepower_rate',   label: '火力',     color: 'text-accent-green',  suffix: '%' },
  { key: 'armor_rate',       label: '護甲',     color: 'text-accent-cyan',   suffix: '%' },
  { key: 'output_bonus',     label: '出力',     color: 'text-accent-purple', suffix: '' },
  { key: 'dodge_rate',       label: '回避',     color: 'text-accent-blue',   suffix: '%' },
  { key: 'durable_rate',     label: '耐久',     color: 'text-accent-green',  suffix: '%' },
  { key: 'dmg_resist_rate',  label: '減傷',     color: 'text-accent-cyan',   suffix: '%', prefix: '-' },
  { key: 'crit_resist_rate', label: '抗暴',     color: 'text-accent-yellow', suffix: '%', prefix: '-' },
  { key: 'dmg_assault',      label: '突擊傷害', color: 'text-accent-orange', suffix: '%' },
  { key: 'dmg_melee',        label: '格鬥傷害', color: 'text-accent-orange', suffix: '%' },
  { key: 'dmg_shooting',     label: '射擊傷害', color: 'text-accent-orange', suffix: '%' },
  { key: 'dmg_tactical',     label: '戰術傷害', color: 'text-accent-orange', suffix: '%' },
  { key: 'dmg_blade',        label: '刀傷害',   color: 'text-accent-orange', suffix: '%' },
  { key: 'dmg_polearm',      label: '槍傷害',   color: 'text-accent-orange', suffix: '%' },
  { key: 'dmg_missile',      label: '飛彈傷害', color: 'text-accent-orange', suffix: '%' },
  { key: 'dmg_rocket',       label: '火箭傷害', color: 'text-accent-orange', suffix: '%' },
  { key: 'dmg_shotgun',      label: '散彈傷害', color: 'text-accent-orange', suffix: '%' },
  { key: 'dmg_machinegun',   label: '機槍傷害', color: 'text-accent-orange', suffix: '%' },
  { key: 'dmg_railgun',      label: '軌道傷害', color: 'text-accent-orange', suffix: '%' },
  { key: 'dmg_sniper',       label: '狙擊傷害', color: 'text-accent-orange', suffix: '%' },
  { key: 'dmg_counter',      label: '反擊傷害', color: 'text-accent-red',    suffix: '%' },
  { key: 'dmg_enemy_phase',  label: '敵回傷害', color: 'text-accent-red',    suffix: '%' },
]

export function highlightNumbers(text: string): React.ReactNode[] {
  return text.split(/(\d+(?:\.\d+)?%?|%)/).map((part, i) =>
    i % 2 === 1
      ? <span key={i} className="text-accent-red font-bold">{part}</span>
      : part
  )
}

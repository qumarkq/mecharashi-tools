import { assetUrl } from '../../utils/assets'
import type { MechPartPosition } from '../../types/enums'
import type { SlotInventory } from '../../types/mechUpgrade'
import { Stepper } from './Stepper'

const SLOT_LABELS: Record<string, string> = {
  torso:    '軀幹',
  leftArm:  '左臂',
  rightArm: '右臂',
  legs:     '腿部',
}

type Level = 'gold1' | 'gold2' | 'gold3'

// 金二不需填寫（金二吃肥料即可升金三），只保留金一 / 金三
const LEVELS: Level[] = ['gold1', 'gold3']

const LEVEL_CONFIG: Record<Level, { label: string; badge: string; color: string; border: string; bg: string }> = {
  gold1: {
    label:  '金一',
    badge:  'images/mechs/mech_badges/badge_1chevron.png',
    color:  'text-accent-yellow',
    border: 'border-accent-yellow/40',
    bg:     'bg-accent-yellow/5',
  },
  gold2: {
    label:  '金二',
    badge:  'images/mechs/mech_badges/badge_2chevron.png',
    color:  'text-accent-orange',
    border: 'border-accent-orange/40',
    bg:     'bg-accent-orange/5',
  },
  gold3: {
    label:  '金三',
    badge:  'images/mechs/mech_badges/badge_3chevron.png',
    color:  'text-accent-red',
    border: 'border-accent-red/40',
    bg:     'bg-accent-red/5',
  },
}

interface PartSlotCardProps {
  slot:      MechPartPosition
  partIcon?: string            // mech.parts[slot].icon
  value:     SlotInventory
  onChange:  (v: SlotInventory) => void
}

export function PartSlotCard({ slot, partIcon, value, onChange }: PartSlotCardProps) {
  const label = SLOT_LABELS[slot] ?? slot
  const total = value.gold1 + value.gold3
  // 彩甲需 2 個金三。每個金三 = 2 個金一（或自有金三 1 件直接抵 1 個）。
  //   金三上限 = 2；金一上限 = 剩餘所需金三 × 2 = max(0, 4 − 2×金三)
  const needGold3 = Math.max(0, 2 - Math.min(value.gold3, 2))
  const levelMax: Record<Level, number> = { gold1: needGold3 * 2, gold2: 0, gold3: 2 }
  const enough = value.gold3 >= 2 || value.gold1 >= needGold3 * 2  // 零件已足夠（只差肥料）

  // 顯示最高持有等級的徽章作為部件卡頭部裝飾
  const highestLevel: Level | null =
    value.gold3 > 0 ? 'gold3' :
    value.gold2 > 0 ? 'gold2' :
    value.gold1 > 0 ? 'gold1' : null

  return (
    <div className={`bg-bg-card border border-border rounded-xl p-4 flex flex-col gap-3 transition-opacity ${total === 0 ? 'opacity-55' : ''}`}>
      {/* 部位標頭：圖示 + 徽章疊加 + 標籤 */}
      <div className="flex items-center gap-3">
        <div className="relative w-12 h-12 flex-shrink-0">
          {partIcon ? (
            <img src={assetUrl(partIcon)} alt={label} className="w-12 h-12 object-contain rounded" />
          ) : (
            <div className="w-12 h-12 rounded-lg border border-border bg-bg-dark" />
          )}
          {highestLevel && (
            <img
              src={assetUrl(LEVEL_CONFIG[highestLevel].badge)}
              alt={LEVEL_CONFIG[highestLevel].label}
              className="absolute top-0 left-0 w-5 h-5 drop-shadow-sm"
            />
          )}
        </div>
        <div>
          <div className="text-[15px] font-bold text-text-primary">{label}</div>
          <div className="text-[11px] text-text-dim mt-0.5">
            {value.gold3 >= 2 ? '雙金三齊備'
              : enough          ? '零件已足夠'
              : total === 0     ? '未持有部件'
              : `持有 ${total} 件`}
          </div>
        </div>
      </div>

      {/* 各等級數量輸入 */}
      <div className="flex flex-col gap-2">
        {LEVELS.map((level) => {
          const { label: lvLabel, badge, color, border, bg } = LEVEL_CONFIG[level]
          return (
            <div key={level} className={`flex items-center gap-2.5 rounded-lg px-3 py-2 border ${bg} ${border}`}>
              <img src={assetUrl(badge)} alt={lvLabel} className="w-5 h-5 object-contain flex-shrink-0" />
              <span className={`text-[13px] font-semibold ${color} flex-1`}>{lvLabel}</span>
              <Stepper
                value={value[level]}
                onChange={(v) => onChange({ ...value, [level]: v })}
                max={levelMax[level]}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

import { assetUrl } from '../../utils/assets'
import type { ModuleInventory } from '../../types/mechUpgrade'
import { Stepper } from './Stepper'

const ARMOR_PREFIX: Record<string, string> = {
  '輕型': 'light',
  '中甲': 'medium',
  '重型': 'heavy',
}

const ARMOR_WEIGHT_LABEL: Record<string, string> = {
  '輕型': '輕型',
  '中甲': '中型',
  '重型': '重型',
}

const CORE_ROWS: { key: keyof ModuleInventory; label: string; color: string }[] = [
  { key: 'coreRaw',   label: '原始',       color: 'text-text-secondary' },
  { key: 'coreGold2', label: '金二',        color: 'text-accent-orange'  },
  { key: 'coreGold3', label: '金三（萬能）', color: 'text-accent-purple'  },
]

interface ModuleInputProps {
  armorType:        string
  value:            ModuleInventory
  onChange:         (v: ModuleInventory) => void
  gold2FertPool:    number
  onFertPoolChange: (n: number) => void
}

export function ModuleInput({ armorType, value, onChange, gold2FertPool, onFertPoolChange }: ModuleInputProps) {
  const prefix      = ARMOR_PREFIX[armorType]      ?? 'medium'
  const weightLabel = ARMOR_WEIGHT_LABEL[armorType] ?? '中型'

  const universalImg = `images/mechs/mech_models/${prefix}_universal_model.png`
  const coreImg      = `images/mechs/mech_models/${prefix}_core_model.png`

  const update = (key: keyof ModuleInventory, v: number) =>
    onChange({ ...value, [key]: v })

  return (
    <div className="bg-bg-card border border-border rounded-xl p-4 flex flex-col gap-5">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-bold tracking-[3px] text-accent-cyan uppercase font-[Orbitron,sans-serif]">
          Modules
        </span>
        <div className="h-px flex-1 bg-border" />
        <span className="text-[12px] text-text-dim">{weightLabel}型限制</span>
      </div>

      {/* 通用改進模組 */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2.5">
          <img
            src={assetUrl(universalImg)}
            alt="通用改進模組"
            className="w-10 h-10 object-contain rounded flex-shrink-0"
          />
          <div>
            <div className="text-[13px] font-semibold text-accent-cyan">{weightLabel}型通用改進模組</div>
            <div className="text-[11px] text-text-dim">萬能金一（須對應機甲重量）</div>
          </div>
        </div>
        <div className="flex items-center gap-2.5 rounded-lg px-3 py-2 bg-accent-cyan/5 border border-accent-cyan/30">
          <span className="text-[13px] text-text-secondary flex-1">持有數量</span>
          <Stepper value={value.universal} onChange={(v) => update('universal', v)} />
        </div>
      </div>

      {/* 核心改進模組 */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2.5">
          <img
            src={assetUrl(coreImg)}
            alt="核心改進模組"
            className="w-10 h-10 object-contain rounded flex-shrink-0"
          />
          <div>
            <div className="text-[13px] font-semibold text-accent-purple">{weightLabel}型核心改進模組</div>
            <div className="text-[11px] text-text-dim">核心金三 = 萬能金三（須對應機甲重量）</div>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          {CORE_ROWS.map(({ key, label, color }) => (
            <div key={key} className="flex items-center gap-2.5 rounded-lg px-3 py-2 bg-accent-purple/5 border border-accent-purple/20">
              <span className={`text-[13px] font-semibold ${color} flex-1`}>{label}</span>
              <Stepper value={value[key] as number} onChange={(v) => update(key, v)} />
            </div>
          ))}
        </div>
        <div className="text-[11px] text-text-dim leading-relaxed px-1">
          原始 + 通用 ×1 → 核心金二　→　核心金二 + 金二 ×2 → 核心金三
        </div>
      </div>

      {/* 散件金二（肥料池） */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold tracking-[3px] text-accent-orange uppercase font-[Orbitron,sans-serif]">
            Fertilizer
          </span>
          <div className="h-px flex-1 bg-border" />
        </div>
        <div className="flex items-center gap-2.5 rounded-lg px-3 py-2 bg-accent-orange/5 border border-accent-orange/30">
          <div className="flex-1">
            <div className="text-[13px] text-text-secondary">散件金二（任意部位）</div>
            <div className="text-[11px] text-text-dim mt-0.5">可跨部位/跨機甲，僅作肥料使用</div>
          </div>
          <Stepper value={gold2FertPool} onChange={onFertPoolChange} />
        </div>
      </div>
    </div>
  )
}

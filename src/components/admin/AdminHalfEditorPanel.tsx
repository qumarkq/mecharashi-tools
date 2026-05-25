import type { PatchHalf, ArmamentRaid } from '../../data/patchVersions/types'
import AdminTimedActivityEditor, { weekdayInfo, toInputDate, fromInputDate } from './AdminTimedActivityEditor'

// ── 共用小元件 ─────────────────────────────────────────────────────────────────

/** 動態字串列表編輯器（機師 / 機甲 / 選配等） */
function StringListEditor({
  values,
  onChange,
  placeholder,
  addLabel = '+ 新增',
}: {
  values: string[]
  onChange: (v: string[]) => void
  placeholder?: string
  addLabel?: string
}) {
  function update(idx: number, val: string) {
    onChange(values.map((v, i) => (i === idx ? val : v)))
  }

  return (
    <div className="space-y-1.5">
      {values.map((v, idx) => (
        <div key={idx} className="flex gap-1.5">
          <input
            type="text"
            value={v}
            onChange={e => update(idx, e.target.value)}
            placeholder={placeholder}
            className="flex-1 bg-bg-card border border-border rounded px-2 py-1 text-xs text-text-primary placeholder-text-dim outline-none focus:border-accent-purple/50 min-w-0"
          />
          <button
            type="button"
            onClick={() => onChange(values.filter((_, i) => i !== idx))}
            className="px-2 text-text-dim hover:text-accent-red transition-colors text-sm"
            title="刪除"
          >
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...values, ''])}
        className="text-[11px] text-accent-purple hover:text-accent-purple/80 transition-colors"
      >
        {addLabel}
      </button>
    </div>
  )
}

/** 武裝討伐子表單 */
function ArmamentRaidEditor({
  raids,
  onChange,
}: {
  raids: ArmamentRaid[]
  onChange: (raids: ArmamentRaid[]) => void
}) {
  function updateRaid(idx: number, patch: Partial<ArmamentRaid>) {
    onChange(raids.map((r, i) => (i === idx ? { ...r, ...patch } : r)))
  }

  function removeRaid(idx: number) {
    onChange(raids.filter((_, i) => i !== idx))
  }

  function addSubItem(idx: number, field: 'weapons' | 'backpacks') {
    const raid = raids[idx]
    updateRaid(idx, { [field]: [...(raid[field] ?? []), ''] })
  }

  function updateSubItem(raidIdx: number, field: 'weapons' | 'backpacks', itemIdx: number, val: string) {
    const raid = raids[raidIdx]
    const arr = (raid[field] ?? []).map((v, i) => (i === itemIdx ? val : v))
    updateRaid(raidIdx, { [field]: arr })
  }

  function removeSubItem(raidIdx: number, field: 'weapons' | 'backpacks', itemIdx: number) {
    const raid = raids[raidIdx]
    updateRaid(raidIdx, { [field]: (raid[field] ?? []).filter((_, i) => i !== itemIdx) })
  }

  return (
    <div className="space-y-2">
      {raids.map((raid, idx) => (
        <div key={idx} className="bg-bg-dark border border-border rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <input
              type="text"
              value={raid.name}
              onChange={e => updateRaid(idx, { name: e.target.value })}
              placeholder="關卡名稱（如：帕洛瑪）"
              className="flex-1 bg-bg-card border border-border rounded px-2 py-1 text-xs text-text-primary placeholder-text-dim outline-none focus:border-accent-purple/50"
            />
            <button
              type="button"
              onClick={() => removeRaid(idx)}
              className="text-text-dim hover:text-accent-red transition-colors text-sm w-6 text-center"
              title="刪除此關卡"
            >
              ✕
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 ml-1">
            {/* 武器 */}
            <div>
              <div className="text-[10px] text-text-dim mb-1 tracking-wider uppercase">武器掉落</div>
              <div className="space-y-1">
                {(raid.weapons ?? []).map((w, wi) => (
                  <div key={wi} className="flex gap-1">
                    <input
                      type="text"
                      value={w}
                      onChange={e => updateSubItem(idx, 'weapons', wi, e.target.value)}
                      placeholder="武器名稱"
                      className="flex-1 bg-bg-card border border-border rounded px-2 py-0.5 text-[11px] text-text-primary placeholder-text-dim outline-none focus:border-accent-purple/50"
                    />
                    <button
                      type="button"
                      onClick={() => removeSubItem(idx, 'weapons', wi)}
                      className="text-text-dim hover:text-accent-red text-xs w-5"
                    >✕</button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => addSubItem(idx, 'weapons')}
                  className="text-[10px] text-accent-cyan hover:text-accent-cyan/80 transition-colors"
                >+ 加武器</button>
              </div>
            </div>

            {/* 背包 */}
            <div>
              <div className="text-[10px] text-text-dim mb-1 tracking-wider uppercase">背包掉落</div>
              <div className="space-y-1">
                {(raid.backpacks ?? []).map((b, bi) => (
                  <div key={bi} className="flex gap-1">
                    <input
                      type="text"
                      value={b}
                      onChange={e => updateSubItem(idx, 'backpacks', bi, e.target.value)}
                      placeholder="背包名稱"
                      className="flex-1 bg-bg-card border border-border rounded px-2 py-0.5 text-[11px] text-text-primary placeholder-text-dim outline-none focus:border-accent-purple/50"
                    />
                    <button
                      type="button"
                      onClick={() => removeSubItem(idx, 'backpacks', bi)}
                      className="text-text-dim hover:text-accent-red text-xs w-5"
                    >✕</button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => addSubItem(idx, 'backpacks')}
                  className="text-[10px] text-accent-cyan hover:text-accent-cyan/80 transition-colors"
                >+ 加背包</button>
              </div>
            </div>
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...raids, { name: '' }])}
        className="text-[11px] text-accent-purple hover:text-accent-purple/80 transition-colors"
      >
        + 新增武裝討伐關卡
      </button>
    </div>
  )
}

// ── 區塊標頭 ──────────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-bold text-text-dim tracking-[3px] uppercase mb-2 mt-5 pt-4 border-t border-border first:mt-0 first:pt-0 first:border-t-0">
      {children}
    </div>
  )
}

// ── 日期輸入（含星期顯示 + 週四警告） ─────────────────────────────────────────

function DateField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  const wd = weekdayInfo(value)
  return (
    <div>
      <label className="text-xs text-text-dim block mb-1">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="date"
          value={value ? toInputDate(value) : ''}
          onChange={e => onChange(e.target.value ? fromInputDate(e.target.value) : '')}
          className="bg-bg-card border border-border rounded px-2 py-1.5 text-sm text-text-primary outline-none focus:border-accent-purple/50"
        />
        {wd && (
          <span className={`text-xs font-bold ${wd.isThur ? 'text-accent-green' : 'text-accent-red'}`}>
            {wd.label}{!wd.isThur && ' ⚠ 非週四'}
          </span>
        )}
      </div>
    </div>
  )
}

// ── 主元件 ────────────────────────────────────────────────────────────────────

interface Props {
  value: PatchHalf
  onChange: (value: PatchHalf) => void
}

export default function AdminHalfEditorPanel({ value, onChange }: Props) {
  function update(patch: Partial<PatchHalf>) {
    onChange({ ...value, ...patch })
  }

  const pilots        = value.pilots        ?? []
  const mechs         = value.mechs         ?? []
  const pilotSel      = value.pilotSelection ?? []
  const mechSel       = value.mechSelection  ?? []
  const armament      = value.armamentRaids  ?? []
  const bpPilots      = value.battlePass?.pilots ?? []
  const bpMechs       = value.battlePass?.mechs  ?? []
  const cnActivities  = value.cnActivities   ?? []
  const twActivities  = value.twActivities   ?? []

  return (
    <div>
      {/* 起始日 */}
      <SectionLabel>起始日</SectionLabel>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <DateField
          label="陸服起始日（cnDate）"
          value={value.cnDate}
          onChange={v => update({ cnDate: v })}
        />
        <div>
          <DateField
            label="台服起始日（twDate）"
            value={value.twDate ?? ''}
            onChange={v => update({ twDate: v || undefined })}
          />
          <label className="flex items-center gap-2 mt-2 cursor-pointer">
            <input
              type="checkbox"
              checked={value.twIsPredicted ?? false}
              onChange={e => update({ twIsPredicted: e.target.checked || undefined })}
              className="accent-accent-yellow"
            />
            <span className="text-xs text-text-dim">預測值（台服日期未確認）</span>
          </label>
        </div>
      </div>

      {/* 機師 / 機甲 */}
      <SectionLabel>新卡池</SectionLabel>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div>
          <div className="text-xs text-text-secondary mb-2">機師（新角色池）</div>
          <StringListEditor
            values={pilots}
            onChange={v => update({ pilots: v.length ? v : undefined })}
            placeholder="機師名稱"
            addLabel="+ 新增機師"
          />
        </div>
        <div>
          <div className="text-xs text-text-secondary mb-2">機甲（新機甲池）</div>
          <StringListEditor
            values={mechs}
            onChange={v => update({ mechs: v.length ? v : undefined })}
            placeholder="機甲名稱"
            addLabel="+ 新增機甲"
          />
        </div>
      </div>

      {/* 角雕特遣 / 跨域海運（選配池） */}
      <SectionLabel>選配池</SectionLabel>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div>
          <div className="text-xs text-text-secondary mb-2">角雕特遣（pilotSelection）</div>
          <StringListEditor
            values={pilotSel}
            onChange={v => update({ pilotSelection: v.length ? v : undefined })}
            placeholder="機師名稱"
            addLabel="+ 新增機師"
          />
        </div>
        <div>
          <div className="text-xs text-text-secondary mb-2">跨域海運（mechSelection）</div>
          <StringListEditor
            values={mechSel}
            onChange={v => update({ mechSelection: v.length ? v : undefined })}
            placeholder="機甲名稱"
            addLabel="+ 新增機甲"
          />
        </div>
      </div>

      {/* 武裝討伐 */}
      <SectionLabel>武裝討伐</SectionLabel>
      <ArmamentRaidEditor
        raids={armament}
        onChange={v => update({ armamentRaids: v.length ? v : undefined })}
      />

      {/* 戰令 */}
      <SectionLabel>戰令</SectionLabel>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div>
          <div className="text-xs text-text-secondary mb-2">角色選項</div>
          <StringListEditor
            values={bpPilots}
            onChange={v => update({ battlePass: { ...value.battlePass, pilots: v.length ? v : undefined } })}
            placeholder="機師名稱"
            addLabel="+ 新增"
          />
        </div>
        <div>
          <div className="text-xs text-text-secondary mb-2">機甲選項</div>
          <StringListEditor
            values={bpMechs}
            onChange={v => update({ battlePass: { ...value.battlePass, mechs: v.length ? v : undefined } })}
            placeholder="機甲名稱"
            addLabel="+ 新增"
          />
        </div>
      </div>

      {/* 甘特圖活動 */}
      <SectionLabel>甘特圖活動</SectionLabel>
      <div className="space-y-5">
        <AdminTimedActivityEditor
          label="陸服活動（cnActivities）"
          activities={cnActivities}
          onChange={v => update({ cnActivities: v.length ? v : undefined })}
        />
        <AdminTimedActivityEditor
          label="台服活動（twActivities）"
          activities={twActivities}
          onChange={v => update({ twActivities: v.length ? v : undefined })}
        />
      </div>
    </div>
  )
}

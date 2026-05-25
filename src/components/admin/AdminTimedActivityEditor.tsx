import type { TimedActivity, ActivityType } from '../../data/patchVersions/types'

const TYPE_LABELS: Record<ActivityType, string> = {
  skinGacha:           '角雕刮刮樂',
  roulette:            '角雕輪盤',
  pilotMission:        '角雕特遣',
  crossShipping:       '跨域海運',
  specificPilotBanner: '特定角色池',
  specificMechBanner:  '特定機甲池',
  limitedEvent:        '限時活動',
  loginEvent:          '簽到活動',
  battlePass:          '版本戰令',
}

const WEEKDAY_ZH = ['日', '一', '二', '三', '四', '五', '六']

export function toInputDate(d: string) { return d.replace(/\//g, '-') }
export function fromInputDate(d: string) { return d.replace(/-/g, '/') }

export function weekdayInfo(dateStr: string): { label: string; isThur: boolean } | null {
  if (!dateStr || dateStr.length < 10) return null
  const d = new Date(toInputDate(dateStr))
  if (isNaN(d.getTime())) return null
  return { label: `週${WEEKDAY_ZH[d.getDay()]}`, isThur: d.getDay() === 4 }
}

export function computeEndDate(startDate: string, weeks: number): string {
  if (!startDate || startDate.length < 10 || weeks < 1) return ''
  const d = new Date(toInputDate(startDate))
  if (isNaN(d.getTime())) return ''
  d.setDate(d.getDate() + weeks * 7 - 1)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}/${m}/${dd}（週${WEEKDAY_ZH[d.getDay()]}）`
}

function emptyActivity(): TimedActivity {
  return { name: '', startDate: '', weeks: 1, type: 'skinGacha' }
}

interface Props {
  label: string
  activities: TimedActivity[]
  onChange: (activities: TimedActivity[]) => void
}

export default function AdminTimedActivityEditor({ label, activities, onChange }: Props) {
  function update(idx: number, patch: Partial<TimedActivity>) {
    onChange(activities.map((a, i) => (i === idx ? { ...a, ...patch } : a)))
  }

  function remove(idx: number) {
    onChange(activities.filter((_, i) => i !== idx))
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-bold text-text-secondary tracking-[2px] uppercase">
          {label}
        </span>
        <button
          type="button"
          onClick={() => onChange([...activities, emptyActivity()])}
          className="px-2 py-0.5 text-[11px] bg-accent-purple/15 text-accent-purple border border-accent-purple/30 rounded hover:bg-accent-purple/25 transition-colors"
        >
          + 新增
        </button>
      </div>

      {activities.length === 0 && (
        <div className="text-[11px] text-text-dim text-center py-3 border border-dashed border-border rounded-lg">
          尚無活動資料
        </div>
      )}

      <div className="space-y-2">
        {activities.map((act, idx) => {
          const wd = weekdayInfo(act.startDate)
          const end = computeEndDate(act.startDate, act.weeks)

          return (
            <div key={idx} className="bg-bg-dark border border-border rounded-lg p-3">
              {/* 行1：序號 + 名稱 + 刪除 */}
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] text-text-dim w-4 text-center flex-shrink-0">{idx + 1}</span>
                <input
                  type="text"
                  value={act.name}
                  onChange={e => update(idx, { name: e.target.value })}
                  placeholder="活動名稱（如：白夜凍鋒（復刻））"
                  className="flex-1 bg-bg-card border border-border rounded px-2 py-1 text-xs text-text-primary placeholder-text-dim outline-none focus:border-accent-purple/50 min-w-0"
                />
                <button
                  type="button"
                  onClick={() => remove(idx)}
                  title="刪除此活動"
                  className="flex-shrink-0 text-text-dim hover:text-accent-red transition-colors text-sm w-6 text-center"
                >
                  ✕
                </button>
              </div>

              {/* 行2：類型 + 起始日 + 週數 */}
              <div className="flex flex-wrap items-center gap-2 ml-6">
                <select
                  value={act.type}
                  onChange={e => {
                    const t = e.target.value as ActivityType
                    const patch: Partial<TimedActivity> = { type: t }
                    if (t !== 'pilotMission') patch.pilots = undefined
                    if (t !== 'crossShipping') patch.mechs = undefined
                    update(idx, patch)
                  }}
                  className="bg-bg-card border border-border rounded px-2 py-1 text-[11px] text-text-primary outline-none focus:border-accent-purple/50"
                >
                  {(Object.entries(TYPE_LABELS) as [ActivityType, string][]).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>

                <div className="flex items-center gap-1.5">
                  <input
                    type="date"
                    value={act.startDate ? toInputDate(act.startDate) : ''}
                    onChange={e =>
                      update(idx, { startDate: e.target.value ? fromInputDate(e.target.value) : '' })
                    }
                    className="bg-bg-card border border-border rounded px-2 py-1 text-[11px] text-text-primary outline-none focus:border-accent-purple/50"
                  />
                  {wd && (
                    <span className={`text-[11px] font-bold ${wd.isThur ? 'text-accent-green' : 'text-accent-red'}`}>
                      {wd.label}{!wd.isThur && ' ⚠'}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={act.weeks}
                    onChange={e => update(idx, { weeks: Math.max(1, parseInt(e.target.value) || 1) })}
                    className="bg-bg-card border border-border rounded px-2 py-1 text-[11px] text-text-primary w-12 outline-none focus:border-accent-purple/50"
                  />
                  <span className="text-[11px] text-text-dim">週</span>
                  {end && (
                    <span className="text-[11px] text-text-dim">→ 結束：{end}</span>
                  )}
                </div>
              </div>

              {/* 行3（條件）：機師列表（pilotMission） */}
              {act.type === 'pilotMission' && (
                <div className="mt-2 ml-6">
                  <input
                    type="text"
                    value={(act.pilots ?? []).join('、')}
                    onChange={e =>
                      update(idx, {
                        pilots: e.target.value.split(/[、,，]+/).map(s => s.trim()).filter(Boolean),
                      })
                    }
                    placeholder="機師名稱，以「、」分隔（如：白夜凍鋒、十字線上的明光）"
                    className="w-full bg-bg-card border border-border rounded px-2 py-1 text-[11px] text-text-primary placeholder-text-dim outline-none focus:border-accent-purple/50"
                  />
                </div>
              )}

              {/* 行3（條件）：機甲列表（crossShipping） */}
              {act.type === 'crossShipping' && (
                <div className="mt-2 ml-6">
                  <input
                    type="text"
                    value={(act.mechs ?? []).join('、')}
                    onChange={e =>
                      update(idx, {
                        mechs: e.target.value.split(/[、,，]+/).map(s => s.trim()).filter(Boolean),
                      })
                    }
                    placeholder="機甲名稱，以「、」分隔"
                    className="w-full bg-bg-card border border-border rounded px-2 py-1 text-[11px] text-text-primary placeholder-text-dim outline-none focus:border-accent-purple/50"
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

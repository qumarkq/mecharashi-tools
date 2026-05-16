import { useState } from 'react'
import { useBackpacks } from '../hooks/useFirestore'

const RESTRICTION_LABELS: Record<string, string> = {
  light: '輕甲限定',
  medium: '中甲限定',
  heavy: '重甲限定',
}

const RESTRICTION_STYLES: Record<string, string> = {
  light: 'text-accent-cyan bg-accent-cyan/10 border-accent-cyan/40',
  medium: 'text-accent-green bg-accent-green/10 border-accent-green/40',
  heavy: 'text-accent-red bg-accent-red/10 border-accent-red/40',
}

const TYPE_STYLES: Record<string, string> = {
  增傷: 'text-accent-orange bg-accent-orange/10 border-accent-orange/30',
  首攻: 'text-accent-yellow bg-accent-yellow/10 border-accent-yellow/30',
  護甲: 'text-accent-blue bg-accent-blue/10 border-accent-blue/30',
  再攻擊: 'text-accent-purple bg-accent-purple/10 border-accent-purple/30',
}

export default function BackpacksPage() {
  const { data: backpacks, loading } = useBackpacks()
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [restrictionFilter, setRestrictionFilter] = useState('')

  const types = [...new Set(backpacks.map((b) => b.type))]
  const restrictions = [...new Set(backpacks.map((b) => b.mechRestriction).filter(Boolean))] as string[]

  const filtered = backpacks.filter((b) => {
    if (typeFilter && b.type !== typeFilter) return false
    if (restrictionFilter === 'none' && b.mechRestriction !== null) return false
    if (restrictionFilter && restrictionFilter !== 'none' && b.mechRestriction !== restrictionFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return b.name.toLowerCase().includes(q) || b.skill.description.toLowerCase().includes(q)
    }
    return true
  })

  const filterBtn = (active: boolean) =>
    `px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
      active
        ? 'bg-accent-orange/15 text-accent-orange border-accent-orange/40'
        : 'bg-bg-card text-text-secondary border-border hover:border-border-accent hover:text-text-primary'
    }`

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <div className="mb-8">
        <span className="text-xs text-accent-orange tracking-[3px] uppercase font-[Orbitron,sans-serif]">
          Database
        </span>
        <h1 className="text-3xl font-bold mt-2">背包圖鑑</h1>
        <p className="text-text-secondary mt-2">
          所有背包裝備的技能效果、重量與裝配限制。共 {backpacks.length} 件背包。
        </p>
      </div>

      {/* Filters */}
      <div className="bg-bg-card border border-border rounded-xl p-4 mb-6 flex flex-col gap-3">
        <input
          type="text"
          placeholder="搜尋背包名稱或效果描述..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-bg-dark border border-border rounded-lg px-4 py-2 text-sm text-text-primary placeholder-text-dim outline-none focus:border-border-accent"
        />
        {types.length > 1 && (
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs text-text-dim mr-1">效果</span>
            <button className={filterBtn(!typeFilter)} onClick={() => setTypeFilter('')}>全部</button>
            {types.map((t) => {
              const s = TYPE_STYLES[t]
              const active = typeFilter === t
              return (
                <button
                  key={t}
                  onClick={() => setTypeFilter(active ? '' : t)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                    active && s
                      ? s
                      : 'bg-bg-card text-text-secondary border-border hover:border-border-accent hover:text-text-primary'
                  }`}
                >
                  {t}
                </button>
              )
            })}
          </div>
        )}
        {restrictions.length > 0 && (
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs text-text-dim mr-1">裝備限制</span>
            <button className={filterBtn(!restrictionFilter)} onClick={() => setRestrictionFilter('')}>全部</button>
            <button className={filterBtn(restrictionFilter === 'none')} onClick={() => setRestrictionFilter(restrictionFilter === 'none' ? '' : 'none')}>
              無限制
            </button>
            {restrictions.map((r) => {
              const s = RESTRICTION_STYLES[r]
              const active = restrictionFilter === r
              return (
                <button
                  key={r}
                  onClick={() => setRestrictionFilter(active ? '' : r)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                    active && s
                      ? s
                      : 'bg-bg-card text-text-secondary border-border hover:border-border-accent hover:text-text-primary'
                  }`}
                >
                  {RESTRICTION_LABELS[r] ?? r}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {!loading && (
        <p className="text-xs text-text-dim mb-4">
          顯示 {filtered.length} / {backpacks.length} 件背包
        </p>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-bg-card border border-border rounded-xl h-36 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((bp) => {
            const resCls = bp.mechRestriction ? RESTRICTION_STYLES[bp.mechRestriction] : null
            const typeCls = TYPE_STYLES[bp.type] ?? 'text-text-secondary bg-bg-card border-border'
            return (
              <div
                key={bp.id}
                className="bg-bg-card border border-border rounded-xl p-5 hover:bg-bg-card-hover hover:border-border-accent transition-all"
              >
                {/* Header */}
                <div className="flex flex-wrap items-start gap-2 mb-3">
                  <h3 className="font-bold text-base text-text-primary flex-1">{bp.name}</h3>
                  <div className="flex gap-2 flex-wrap">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${typeCls}`}>
                      {bp.type}
                    </span>
                    {bp.mechRestriction && resCls && (
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${resCls}`}>
                        {RESTRICTION_LABELS[bp.mechRestriction]}
                      </span>
                    )}
                  </div>
                </div>

                {/* Meta */}
                <div className="flex gap-4 text-xs mb-3">
                  <span>
                    <span className="text-text-dim">重量 </span>
                    <span className="text-text-secondary font-bold">{bp.weight}</span>
                  </span>
                  <span>
                    <span className="text-text-dim">位置 </span>
                    <span className="text-text-secondary">{bp.slot}</span>
                  </span>
                </div>

                {/* Skill */}
                <div className="bg-bg-dark border border-border rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-xs font-bold text-text-primary">{bp.skill.name}</span>
                    <span className="text-[10px] text-text-dim border border-border bg-bg-card rounded px-1.5 py-0.5">
                      {bp.skill.type}
                    </span>
                  </div>
                  <p className="text-xs text-text-secondary leading-relaxed">{bp.skill.description}</p>
                  {/* Stat bonuses */}
                  {(bp.skill.dmg || bp.skill.crit || bp.skill.critDmg || bp.skill.acc) ? (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {bp.skill.dmg ? (
                        <span className="text-[11px] text-accent-orange">增傷 +{bp.skill.dmg}%</span>
                      ) : null}
                      {bp.skill.crit ? (
                        <span className="text-[11px] text-accent-yellow">爆率 +{bp.skill.crit}</span>
                      ) : null}
                      {bp.skill.critDmg ? (
                        <span className="text-[11px] text-accent-yellow">爆傷 +{bp.skill.critDmg}%</span>
                      ) : null}
                      {bp.skill.acc ? (
                        <span className="text-[11px] text-accent-blue">命中 +{bp.skill.acc}</span>
                      ) : null}
                    </div>
                  ) : null}
                  {bp.skill.specialEffects && bp.skill.specialEffects.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {bp.skill.specialEffects.map((ef, i) => (
                        <span
                          key={i}
                          className="text-[10px] text-accent-cyan bg-accent-cyan/5 border border-accent-cyan/20 rounded px-2 py-0.5"
                        >
                          {ef}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="bg-bg-card border border-border rounded-xl p-12 text-center text-text-dim">
          沒有符合條件的背包
        </div>
      )}
    </div>
  )
}

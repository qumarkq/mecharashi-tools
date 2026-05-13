import { useState, useEffect } from 'react'
import type { Weapon } from '../types'
import { fetchData } from '../utils/assets'

const RARITY_STYLES: Record<string, string> = {
  金: 'text-accent-yellow bg-accent-yellow/10 border-accent-yellow/40',
  紫: 'text-accent-purple bg-accent-purple/10 border-accent-purple/40',
  藍: 'text-accent-blue bg-accent-blue/10 border-accent-blue/40',
}

const ACTIVATION_LABELS: Record<string, string> = {
  carry: '攜帶生效',
  equip: '裝備中生效',
  use: '使用時生效',
}

const ACTIVATION_STYLES: Record<string, string> = {
  carry: 'text-accent-green bg-accent-green/10 border-accent-green/30',
  equip: 'text-accent-orange bg-accent-orange/10 border-accent-orange/30',
  use: 'text-accent-blue bg-accent-blue/10 border-accent-blue/30',
}

export default function WeaponsPage() {
  const [weapons, setWeapons] = useState<Weapon[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [exclusiveOnly, setExclusiveOnly] = useState(false)

  useEffect(() => {
    fetchData<Weapon[]>('weapons.json')
      .then(setWeapons)
      .finally(() => setLoading(false))
  }, [])

  const categories = [...new Set(weapons.map((w) => w.category))]
  const types = [...new Set(weapons.filter((w) => !categoryFilter || w.category === categoryFilter).map((w) => w.type))]

  const filtered = weapons.filter((w) => {
    if (categoryFilter && w.category !== categoryFilter) return false
    if (typeFilter && w.type !== typeFilter) return false
    if (exclusiveOnly && !w.isExclusive) return false
    if (search) {
      const q = search.toLowerCase()
      return w.name.toLowerCase().includes(q) || w.type.toLowerCase().includes(q)
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
        <h1 className="text-3xl font-bold mt-2">武器圖鑑</h1>
        <p className="text-text-secondary mt-2">
          所有武器種類、專屬武器、技能效果與元件插槽配置。共 {weapons.length} 把武器。
        </p>
      </div>

      {/* Filters */}
      <div className="bg-bg-card border border-border rounded-xl p-4 mb-6 flex flex-col gap-3">
        <input
          type="text"
          placeholder="搜尋武器名稱..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-bg-dark border border-border rounded-lg px-4 py-2 text-sm text-text-primary placeholder-text-dim outline-none focus:border-border-accent"
        />
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs text-text-dim mr-1">分類</span>
          <button className={filterBtn(!categoryFilter)} onClick={() => { setCategoryFilter(''); setTypeFilter('') }}>全部</button>
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => { setCategoryFilter(categoryFilter === c ? '' : c); setTypeFilter('') }}
              className={filterBtn(categoryFilter === c)}
            >
              {c}
            </button>
          ))}
        </div>
        {types.length > 0 && (
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs text-text-dim mr-1">種類</span>
            <button className={filterBtn(!typeFilter)} onClick={() => setTypeFilter('')}>全部</button>
            {types.map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(typeFilter === t ? '' : t)}
                className={filterBtn(typeFilter === t)}
              >
                {t}
              </button>
            ))}
          </div>
        )}
        <label className="flex items-center gap-2 cursor-pointer w-fit">
          <input
            type="checkbox"
            checked={exclusiveOnly}
            onChange={(e) => setExclusiveOnly(e.target.checked)}
            className="accent-accent-orange"
          />
          <span className="text-xs text-text-secondary">僅顯示專屬武器</span>
        </label>
      </div>

      {!loading && (
        <p className="text-xs text-text-dim mb-4">
          顯示 {filtered.length} / {weapons.length} 把武器
        </p>
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-bg-card border border-border rounded-xl h-28 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((w) => {
            const rarityCls = RARITY_STYLES[w.rarity] ?? 'text-text-secondary bg-bg-card border-border'
            return (
              <div
                key={w.id}
                className="bg-bg-card border border-border rounded-xl p-4 hover:bg-bg-card-hover hover:border-border-accent transition-all"
              >
                {/* Top row */}
                <div className="flex flex-wrap items-start gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h3 className="font-bold text-base text-text-primary">{w.name}</h3>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${rarityCls}`}>
                        {w.rarity}
                      </span>
                      {w.isExclusive && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold border text-accent-pink bg-accent-pink/10 border-accent-pink/40">
                          專武
                        </span>
                      )}
                      <span className="text-[10px] text-text-dim bg-bg-dark border border-border px-2 py-0.5 rounded">
                        {w.category} · {w.type}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Stats row */}
                <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs mb-3">
                  <StatItem label="攻擊力" value={w.attack} color="text-accent-orange" />
                  <StatItem label="命中" value={w.accuracy.toLocaleString()} color="text-accent-blue" />
                  <StatItem label="暴擊" value={w.critValue.toLocaleString()} color="text-accent-yellow" />
                  <StatItem label="射程" value={w.range} color="text-text-secondary" />
                  <StatItem label="重量" value={w.weight.toString()} color="text-text-dim" />
                  <StatItem
                    label="插槽"
                    value={`觸×${w.triggerSlots} 應×${w.effectSlots}`}
                    color="text-accent-cyan"
                  />
                </div>

                {/* Skills */}
                {w.skills.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {w.skills.map((sk, i) => {
                      const actCls =
                        ACTIVATION_STYLES[sk.activation] ??
                        'text-text-dim bg-bg-dark border-border'
                      return (
                        <div
                          key={i}
                          className="bg-bg-dark border border-border rounded-lg px-3 py-2 max-w-sm"
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-bold text-text-primary">{sk.name}</span>
                            <span className={`text-[10px] border rounded px-1.5 py-0.5 ${actCls}`}>
                              {ACTIVATION_LABELS[sk.activation] ?? sk.activation}
                            </span>
                          </div>
                          <p className="text-[11px] text-text-dim leading-relaxed">{sk.description}</p>
                          {sk.enhancesTalent && (
                            <p className="text-[10px] text-accent-pink mt-1">
                              天賦加強：{sk.enhancesTalent}
                            </p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="bg-bg-card border border-border rounded-xl p-12 text-center text-text-dim">
          沒有符合條件的武器
        </div>
      )}
    </div>
  )
}

function StatItem({
  label,
  value,
  color,
}: {
  label: string
  value: string
  color: string
}) {
  return (
    <span>
      <span className="text-text-dim">{label} </span>
      <span className={`font-bold font-[JetBrains_Mono,monospace] ${color}`}>{value}</span>
    </span>
  )
}

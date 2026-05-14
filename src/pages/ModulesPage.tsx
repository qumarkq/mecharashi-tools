import { useState, useEffect } from 'react'
import type { Module, Mech } from '../types'
import { fetchData, assetUrl } from '../utils/assets'

const SLOT_LABELS: Record<string, string> = {
  '4mod': '四格模組',
  '8mod': '八格模組',
  fixed: '固定模組',
}

const SLOT_STYLES: Record<string, string> = {
  '4mod': 'text-accent-orange bg-accent-orange/10 border-accent-orange/30',
  '8mod': 'text-accent-blue bg-accent-blue/10 border-accent-blue/30',
  fixed: 'text-accent-green bg-accent-green/10 border-accent-green/30',
}

const PART_LABELS: Record<string, string> = {
  torso: '軀幹',
  leftArm: '左臂',
  rightArm: '右臂',
  legs: '腿部',
}

const RARITY_STYLES: Record<string, string> = {
  SSR: 'text-accent-yellow bg-accent-yellow/10 border-accent-yellow/40',
  SR: 'text-accent-purple bg-accent-purple/10 border-accent-purple/40',
  R: 'text-accent-blue bg-accent-blue/10 border-accent-blue/40',
}

export default function ModulesPage() {
  const [modules, setModules] = useState<Module[]>([])
  const [mechs, setMechs] = useState<Mech[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [slotFilter, setSlotFilter] = useState('')
  const [mechFilter, setMechFilter] = useState('')
  const [rarityFilter, setRarityFilter] = useState('')

  useEffect(() => {
    Promise.all([
      fetchData<Module[]>('modules.json'),
      fetchData<Mech[]>('mechs.json'),
    ])
      .then(([mods, ms]) => {
        setModules(mods)
        setMechs(ms)
      })
      .finally(() => setLoading(false))
  }, [])

  const mechMap = Object.fromEntries(mechs.map((m) => [m.id, m.name]))
  const boundMechIds = [...new Set(modules.map((m) => m.boundMechId).filter(Boolean))] as string[]
  const rarities = [...new Set(modules.map((m) => m.rarity))]

  const getSlotKey = (slot: string) => {
    if (slot === '4mod' || slot === '8mod' || slot === 'fixed') return slot
    if (slot.startsWith('fixed_')) return 'fixed'
    return slot
  }

  const filtered = modules.filter((m) => {
    if (slotFilter && getSlotKey(m.slot) !== slotFilter) return false
    if (mechFilter && m.boundMechId !== mechFilter) return false
    if (rarityFilter && m.rarity !== rarityFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        m.name.toLowerCase().includes(q) ||
        m.description.toLowerCase().includes(q) ||
        (m.boundMechId && mechMap[m.boundMechId]?.toLowerCase().includes(q))
      )
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
        <h1 className="text-3xl font-bold mt-2">模組圖鑑</h1>
        <p className="text-text-secondary mt-2">
          四格模組、八格模組、固定模組完整列表，含綁定機甲與技能效果。共 {modules.length} 個模組。
        </p>
      </div>

      {/* Filters */}
      <div className="bg-bg-card border border-border rounded-xl p-4 mb-6 flex flex-col gap-3">
        <input
          type="text"
          placeholder="搜尋模組名稱、效果或綁定機甲..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-bg-dark border border-border rounded-lg px-4 py-2 text-sm text-text-primary placeholder-text-dim outline-none focus:border-border-accent"
        />
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs text-text-dim mr-1">槽位</span>
          <button className={filterBtn(!slotFilter)} onClick={() => setSlotFilter('')}>全部</button>
          <button className={filterBtn(slotFilter === '4mod')} onClick={() => setSlotFilter(slotFilter === '4mod' ? '' : '4mod')}>四格模組</button>
          <button className={filterBtn(slotFilter === '8mod')} onClick={() => setSlotFilter(slotFilter === '8mod' ? '' : '8mod')}>八格模組</button>
          <button className={filterBtn(slotFilter === 'fixed')} onClick={() => setSlotFilter(slotFilter === 'fixed' ? '' : 'fixed')}>固定模組</button>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs text-text-dim mr-1">稀有度</span>
          <button className={filterBtn(!rarityFilter)} onClick={() => setRarityFilter('')}>全部</button>
          {rarities.map((r) => (
            <button key={r} className={filterBtn(rarityFilter === r)} onClick={() => setRarityFilter(rarityFilter === r ? '' : r)}>{r}</button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs text-text-dim mr-1">綁定機甲</span>
          <button className={filterBtn(!mechFilter)} onClick={() => setMechFilter('')}>全部</button>
          <select
            value={mechFilter}
            onChange={(e) => setMechFilter(e.target.value)}
            className="bg-bg-dark border border-border rounded-lg px-3 py-1.5 text-xs text-text-secondary outline-none focus:border-border-accent"
          >
            <option value="">選擇機甲...</option>
            {boundMechIds.map((id) => (
              <option key={id} value={id}>{mechMap[id] || id}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Results */}
      {loading ? (
        <div className="text-center py-20 text-text-dim">載入中...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-text-dim">找不到符合條件的模組</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((mod) => {
            const slotKey = getSlotKey(mod.slot)
            const slotStyle = SLOT_STYLES[slotKey] || SLOT_STYLES['fixed']
            const rarityStyle = RARITY_STYLES[mod.rarity] || ''
            return (
              <div
                key={mod.id}
                className="bg-bg-card border border-border rounded-xl p-4 hover:border-border-accent transition-colors"
              >
                <div className="flex items-start gap-3">
                  {mod.icon && (
                    <img
                      src={assetUrl(mod.icon)}
                      alt={mod.name}
                      className="w-12 h-12 rounded-lg object-cover bg-bg-dark border border-border flex-shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="font-bold text-sm">{mod.name}</h3>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border ${rarityStyle}`}>
                        {mod.rarity}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border ${slotStyle}`}>
                        {SLOT_LABELS[slotKey] || '固定模組'}
                      </span>
                    </div>
                    {mod.boundMechId && (
                      <div className="text-[11px] text-text-dim mb-1">
                        綁定：<span className="text-accent-cyan">{mechMap[mod.boundMechId] || mod.boundMechId}</span>
                        {mod.boundPart && (
                          <span className="ml-2 text-accent-purple">({PART_LABELS[mod.boundPart] || mod.boundPart})</span>
                        )}
                      </div>
                    )}
                    <p className="text-xs text-text-secondary leading-relaxed whitespace-pre-line">
                      {mod.description}
                    </p>
                    {(mod.dmg > 0 || mod.crit > 0 || mod.critDmg > 0 || mod.acc > 0) && (
                      <div className="flex gap-3 mt-2 text-[11px]">
                        {mod.dmg > 0 && <span className="text-accent-orange">傷害+{mod.dmg}%</span>}
                        {mod.crit > 0 && <span className="text-accent-yellow">暴擊+{mod.crit}%</span>}
                        {mod.critDmg > 0 && <span className="text-accent-red">爆傷+{mod.critDmg}%</span>}
                        {mod.acc > 0 && <span className="text-accent-blue">命中+{mod.acc}%</span>}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

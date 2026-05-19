import { useState, useLayoutEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { useWeapons, usePilotNameMap } from '../hooks/useFirestore'
import { highlightNumbers } from '../utils/moduleStats'
import { assetUrl } from '../utils/assets'
import type { Weapon } from '../types'

const RARITY_STYLES: Record<string, string> = {
  SS:  'text-accent-yellow bg-accent-yellow/10 border-accent-yellow/40',
  'S+':'text-accent-purple bg-accent-purple/10 border-accent-purple/40',
  S:   'text-accent-blue   bg-accent-blue/10   border-accent-blue/40',
  A:   'text-accent-green  bg-accent-green/10  border-accent-green/40',
  B:   'text-text-secondary bg-bg-dark border-border',
}

const EQUIP_SLOT_LABELS: Record<string, string> = {
  singleHand: '單手',
  dualHand:   '雙手',
  shoulder:   '肩膀',
  back:       '背後',
}

const MECH_RESTRICTION_LABELS: Record<string, string> = {
  none:   '無限制',
  light:  '輕型專用',
  medium: '中型專用',
  heavy:  '重型專用',
}

const ACTIVATION_LABELS: Record<string, string> = {
  carry: '攜帶生效',
  equip: '裝備中生效',
  use:   '使用時生效',
}

const ACTIVATION_STYLES: Record<string, string> = {
  carry: 'text-accent-green  bg-accent-green/10  border-accent-green/30',
  equip: 'text-accent-orange bg-accent-orange/10 border-accent-orange/30',
  use:   'text-accent-blue   bg-accent-blue/10   border-accent-blue/30',
}

const RARITY_ORDER: Record<string, number> = { SS: 0, 'S+': 1, S: 2, A: 3, B: 4 }

const ALL_RARITIES   = ['SS', 'S+', 'S', 'A', 'B']
const ALL_TYPES      = ['射擊', '格鬥', '突擊', '戰術']
const ALL_KINDS      = ['大盾','手盾','刀劍','拳套','打樁機','電鋸','長柄','電磁炮','浮游炮','導彈','火箭','霰彈槍','機槍','重機槍','噴火器','輕型狙擊步槍','狙擊步槍']
const ALL_EQUIP_SLOTS = ['singleHand', 'dualHand', 'shoulder', 'back']

function WeaponIcon({ icon, name, size = 'md' }: { icon?: string; name: string; size?: 'sm' | 'md' | 'lg' }) {
  const [failed, setFailed] = useState(false)
  const dim = size === 'lg' ? 'w-16 h-16' : size === 'md' ? 'w-10 h-10' : 'w-8 h-8'

  if (!icon || failed) {
    return (
      <div className={`${dim} rounded-lg bg-bg-dark border border-border flex items-center justify-center flex-shrink-0`}>
        <span className="text-text-dim text-[10px]">武</span>
      </div>
    )
  }
  return (
    <img
      src={assetUrl(icon)}
      alt={name}
      className={`${dim} rounded-lg object-contain bg-bg-dark border border-border flex-shrink-0`}
      onError={() => setFailed(true)}
    />
  )
}

function Num({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`text-accent-red font-bold font-[JetBrains_Mono,monospace] ${className}`}>
      {children}
    </span>
  )
}

function formatRange(w: Weapon): string {
  return w.rangeType === 'ring' ? `${w.maxRange}+` : `${w.minRange}-${w.maxRange}`
}

function WeaponTooltip({ weapon, pilotNameMap, pinned }: {
  weapon: Weapon
  pilotNameMap: Record<string, string>
  pinned: boolean
}) {
  const rarityCls = RARITY_STYLES[weapon.rarity] ?? 'text-text-secondary border-border'
  const pilotName = weapon.exclusiveFor ? pilotNameMap[weapon.exclusiveFor] : null

  const stats: Array<{ label: string; value: string; noRed?: boolean }> = [
    { label: '攻擊力',  value: weapon.attack },
    { label: '命中',    value: weapon.accuracy.toLocaleString() },
    { label: '暴擊',    value: weapon.critValue.toLocaleString() },
    { label: '重量',    value: weapon.weight.toString() },
    { label: '射程',    value: formatRange(weapon) },
    { label: '型態',    value: weapon.rangeType === 'ring' ? '環形' : '線性', noRed: true },
    { label: '連擊數',  value: weapon.hitCount.toString() },
    { label: '彈藥量',  value: weapon.ammoCount === 0 ? '∞' : weapon.ammoCount.toString() },
    { label: '種係數',  value: weapon.kindCoefficient.toString() },
    { label: '裝備部位',value: EQUIP_SLOT_LABELS[weapon.equipSlot] ?? weapon.equipSlot, noRed: true },
    ...(weapon.mechRestriction !== 'none'
      ? [{ label: '機甲限制', value: MECH_RESTRICTION_LABELS[weapon.mechRestriction] ?? weapon.mechRestriction, noRed: true }]
      : []),
  ]

  return (
    <div className="w-80 max-h-[min(90vh,_640px)] flex flex-col bg-bg-card border border-border-accent rounded-xl p-4 shadow-2xl">
      {/* Header */}
      <div className="flex items-start gap-3 mb-3 flex-shrink-0">
        <WeaponIcon icon={weapon.icon} name={weapon.name} size="lg" />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-1">
            <div className="font-bold text-sm text-text-primary leading-tight">{weapon.name}</div>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border flex-shrink-0 ${rarityCls}`}>
              {weapon.rarity}
            </span>
          </div>
          <div className="text-[10px] text-text-dim mt-0.5">{weapon.type} · {weapon.kind}</div>
          {pilotName && weapon.exclusiveFor && (
            <Link
              to={`/pilots/${weapon.exclusiveFor}`}
              className="text-[10px] text-accent-pink hover:underline mt-0.5 block"
            >
              専武：{pilotName}
            </Link>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-2">
        {/* Stats grid */}
        <div className="bg-bg-dark rounded-lg p-2.5 grid grid-cols-2 gap-x-3 gap-y-1">
          {stats.map(({ label, value, noRed }) => (
            <div key={label} className="flex items-center gap-1.5">
              <span className="text-[10px] text-text-dim whitespace-nowrap">{label}</span>
              {noRed
                ? <span className="text-[11px] text-text-secondary">{value}</span>
                : <Num className="text-[11px]">{value}</Num>
              }
            </div>
          ))}
        </div>

        {/* Slots */}
        <div className="bg-bg-dark rounded-lg px-2.5 py-2 flex items-center gap-4 text-[11px]">
          <span className="text-text-dim">觸元件</span>
          <Num>{weapon.triggerSlots}</Num>
          <span className="text-text-dim">應元件</span>
          <Num>{weapon.effectSlots}</Num>
          {weapon.componentLimit > 0 && (
            <>
              <span className="text-text-dim border-l border-border pl-4">上限</span>
              <Num>{weapon.componentLimit}</Num>
            </>
          )}
        </div>

        {/* Skills */}
        {weapon.skills.length > 0 && (
          <div className="space-y-1.5">
            {weapon.skills.map((sk, i) => {
              const actCls = ACTIVATION_STYLES[sk.activation] ?? 'text-text-dim bg-bg-dark border-border'
              return (
                <div key={i} className="bg-bg-dark rounded-lg p-2.5">
                  <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                    <span className="text-xs font-bold text-text-primary">{sk.name}</span>
                    <span className={`text-[10px] border rounded px-1.5 py-0.5 ${actCls}`}>
                      {ACTIVATION_LABELS[sk.activation] ?? sk.activation}
                    </span>
                  </div>
                  <p className="text-[11px] text-text-dim leading-relaxed">
                    {highlightNumbers(sk.description)}
                  </p>
                  {sk.enhancesTalentName && (
                    <p className="text-[10px] text-accent-pink mt-1">天賦加強：{sk.enhancesTalentName}</p>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Fixed mod */}
        {weapon.fixedMod?.planName && (
          <div className="bg-bg-dark rounded-lg p-2.5">
            <div className="text-[10px] text-accent-orange font-bold mb-1">
              固定改裝 · {weapon.fixedMod.planName}
            </div>
            <div className="text-[11px] text-text-dim mb-1">
              上限等級 <Num>{weapon.fixedMod.maxLevel}</Num>
            </div>
            {weapon.fixedMod.effects.length > 0 && (
              <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                {weapon.fixedMod.effects.map((e, i) => (
                  <span key={i} className="text-[11px] text-text-secondary">
                    {e.stat} <Num>+{e.value}</Num>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Floating mod */}
        {weapon.floatingMod?.planName && (
          <div className="bg-bg-dark rounded-lg p-2.5">
            <div className="text-[10px] text-accent-cyan font-bold mb-1">
              浮動改裝 · {weapon.floatingMod.planName}
            </div>
            <div className="text-[11px] text-text-dim mb-1">
              插槽 <Num>{weapon.floatingMod.slots}</Num> 格
            </div>
            {weapon.floatingMod.possibleEffects.length > 0 && (
              <div className="space-y-0.5">
                {weapon.floatingMod.possibleEffects.map((e, i) => (
                  <div key={i} className="text-[11px] text-text-dim">
                    {e.stat}
                    {e.condition ? <span className="text-text-dim/70"> ({e.condition})</span> : ''}
                    {' '}<Num>{e.min}–{e.max}</Num>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {!pinned && (
        <p className="text-[10px] text-text-dim mt-2 text-center flex-shrink-0">點擊卡片固定此視窗</p>
      )}
    </div>
  )
}

interface TooltipState {
  weaponId: string
  x: number
  anchorTop: number
}

function TooltipPortal({ weapon, pilotNameMap, pinned, x, anchorTop }: {
  weapon: Weapon
  pilotNameMap: Record<string, string>
  pinned: boolean
  x: number
  anchorTop: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [top, setTop] = useState(anchorTop)

  useLayoutEffect(() => {
    if (!ref.current) return
    const h = ref.current.offsetHeight
    setTop(Math.max(8, Math.min(anchorTop, window.innerHeight - h - 8)))
  }, [anchorTop, weapon.id])

  return createPortal(
    <div
      ref={ref}
      className={`fixed z-50 ${pinned ? 'pointer-events-auto' : 'pointer-events-none'}`}
      style={{ left: x, top }}
      onClick={(e) => e.stopPropagation()}
    >
      <WeaponTooltip weapon={weapon} pilotNameMap={pilotNameMap} pinned={pinned} />
    </div>,
    document.body
  )
}

export default function WeaponsPage() {
  const { data: weapons, loading } = useWeapons()
  const { data: pilotNameMap } = usePilotNameMap()

  const [search, setSearch] = useState('')
  const [rarityFilters, setRarityFilters]     = useState<Set<string>>(new Set())
  const [typeFilters, setTypeFilters]         = useState<Set<string>>(new Set())
  const [kindFilters, setKindFilters]         = useState<Set<string>>(new Set())
  const [equipSlotFilter, setEquipSlotFilter] = useState<string | null>(null)

  const [hoverTooltip, setHoverTooltip]   = useState<TooltipState | null>(null)
  const [pinnedTooltip, setPinnedTooltip] = useState<TooltipState | null>(null)

  const toggleSet = (setter: React.Dispatch<React.SetStateAction<Set<string>>>, value: string) => {
    setter((prev) => {
      const next = new Set(prev)
      if (next.has(value)) next.delete(value)
      else next.add(value)
      return next
    })
  }

  const filtered = weapons
    .filter((w) => {
      if (rarityFilters.size > 0 && !rarityFilters.has(w.rarity))   return false
      if (typeFilters.size > 0   && !typeFilters.has(w.type))       return false
      if (kindFilters.size > 0   && !kindFilters.has(w.kind))       return false
      if (equipSlotFilter && w.equipSlot !== equipSlotFilter)        return false
      if (search) {
        const q = search.toLowerCase()
        return w.name.toLowerCase().includes(q) || w.kind.toLowerCase().includes(q)
      }
      return true
    })
    .sort((a, b) => (RARITY_ORDER[a.rarity] ?? 9) - (RARITY_ORDER[b.rarity] ?? 9))

  const computePos = (cardEl: HTMLDivElement): { x: number; anchorTop: number } => {
    const rect = cardEl.getBoundingClientRect()
    const tooltipW = 328
    const x = rect.right + 8 + tooltipW > window.innerWidth
      ? rect.left - tooltipW - 8
      : rect.right + 8
    return { x, anchorTop: rect.top }
  }

  const handleMouseEnter = (weaponId: string, cardEl: HTMLDivElement) => {
    if (pinnedTooltip) return
    setHoverTooltip({ weaponId, ...computePos(cardEl) })
  }

  const handleMouseLeave = () => {
    if (!pinnedTooltip) setHoverTooltip(null)
  }

  const handleCardClick = (weaponId: string, cardEl: HTMLDivElement, e: React.MouseEvent) => {
    e.stopPropagation()
    if (pinnedTooltip?.weaponId === weaponId) {
      setPinnedTooltip(null)
    } else {
      setPinnedTooltip({ weaponId, ...computePos(cardEl) })
      setHoverTooltip(null)
    }
  }

  const activeTooltip = pinnedTooltip ?? hoverTooltip
  const activeWeapon  = activeTooltip
    ? weapons.find((w) => w.id === activeTooltip.weaponId) ?? null
    : null

  const filterBtn = (active: boolean) =>
    `px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
      active
        ? 'bg-accent-orange/15 text-accent-orange border-accent-orange/40'
        : 'bg-bg-card text-text-secondary border-border hover:border-border-accent hover:text-text-primary'
    }`

  return (
    <div className="max-w-7xl mx-auto px-4 py-12" onClick={() => setPinnedTooltip(null)}>

      {activeWeapon && activeTooltip && (
        <TooltipPortal
          key={activeTooltip.weaponId}
          weapon={activeWeapon}
          pilotNameMap={pilotNameMap}
          pinned={!!pinnedTooltip}
          x={activeTooltip.x}
          anchorTop={activeTooltip.anchorTop}
        />
      )}

      {/* Header */}
      <div className="mb-8">
        <span className="text-xs text-accent-orange tracking-[3px] uppercase font-[Orbitron,sans-serif]">
          Database
        </span>
        <h1 className="text-3xl font-bold mt-2">武器圖鑑</h1>
        <p className="text-text-secondary mt-2">
          所有武器種類、射程、技能效果與元件插槽配置。共 {weapons.length} 把武器。
        </p>
      </div>

      {/* Filters */}
      <div
        className="bg-bg-card border border-border rounded-xl p-4 mb-6 flex flex-col gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search */}
        <input
          type="text"
          placeholder="搜尋武器名稱或種類..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-bg-dark border border-border rounded-lg px-4 py-2 text-sm text-text-primary placeholder-text-dim outline-none focus:border-border-accent"
        />

        {/* Rarity – multi-select OR */}
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="text-xs text-text-dim mr-1 w-10 flex-shrink-0">稀有度</span>
          <button className={filterBtn(rarityFilters.size === 0)} onClick={() => setRarityFilters(new Set())}>全部</button>
          {ALL_RARITIES.map((r) => (
            <button
              key={r}
              className={filterBtn(rarityFilters.has(r))}
              onClick={() => toggleSet(setRarityFilters, r)}
            >{r}</button>
          ))}
        </div>

        {/* Type – multi-select OR */}
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="text-xs text-text-dim mr-1 w-10 flex-shrink-0">類型</span>
          <button className={filterBtn(typeFilters.size === 0)} onClick={() => setTypeFilters(new Set())}>全部</button>
          {ALL_TYPES.map((t) => (
            <button
              key={t}
              className={filterBtn(typeFilters.has(t))}
              onClick={() => toggleSet(setTypeFilters, t)}
            >{t}</button>
          ))}
        </div>

        {/* Kind – multi-select OR */}
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="text-xs text-text-dim mr-1 w-10 flex-shrink-0">種類</span>
          <button className={filterBtn(kindFilters.size === 0)} onClick={() => setKindFilters(new Set())}>全部</button>
          {ALL_KINDS.map((k) => (
            <button
              key={k}
              className={filterBtn(kindFilters.has(k))}
              onClick={() => toggleSet(setKindFilters, k)}
            >{k}</button>
          ))}
        </div>

        {/* Equip slot – single select */}
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="text-xs text-text-dim mr-1 w-10 flex-shrink-0">部位</span>
          <button className={filterBtn(!equipSlotFilter)} onClick={() => setEquipSlotFilter(null)}>全部</button>
          {ALL_EQUIP_SLOTS.map((s) => (
            <button
              key={s}
              className={filterBtn(equipSlotFilter === s)}
              onClick={() => setEquipSlotFilter(equipSlotFilter === s ? null : s)}
            >{EQUIP_SLOT_LABELS[s]}</button>
          ))}
        </div>
      </div>

      {/* Count */}
      {!loading && (
        <p className="text-xs text-text-dim mb-4">
          顯示 <Num className="text-xs">{filtered.length}</Num> / {weapons.length} 把武器
        </p>
      )}

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="bg-bg-card border border-border rounded-xl h-24 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-bg-card border border-border rounded-xl p-12 text-center text-text-dim">
          沒有符合條件的武器
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {filtered.map((w) => {
            const rarityCls  = RARITY_STYLES[w.rarity] ?? 'text-text-secondary bg-bg-dark border-border'
            const isPinned   = pinnedTooltip?.weaponId === w.id
            const pilotName  = w.exclusiveFor ? pilotNameMap[w.exclusiveFor] : null

            return (
              <div
                key={w.id}
                className={`bg-bg-card border rounded-xl p-3 cursor-pointer transition-all select-none ${
                  isPinned
                    ? 'border-accent-orange/60 bg-accent-orange/5'
                    : 'border-border hover:border-border-accent hover:bg-bg-card-hover'
                }`}
                onMouseEnter={(e) => handleMouseEnter(w.id, e.currentTarget)}
                onMouseLeave={handleMouseLeave}
                onClick={(e) => handleCardClick(w.id, e.currentTarget, e)}
              >
                {/* Top row: icon + name/rarity */}
                <div className="flex items-start gap-2 mb-2">
                  <WeaponIcon icon={w.icon} name={w.name} size="md" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-1 mb-0.5">
                      <h3 className="font-bold text-sm text-text-primary leading-tight line-clamp-2">{w.name}</h3>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border flex-shrink-0 ${rarityCls}`}>
                        {w.rarity}
                      </span>
                    </div>
                    {/* Type · Kind + pilot link */}
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="text-[10px] text-text-dim bg-bg-dark border border-border px-1.5 py-0.5 rounded">
                        {w.type}·{w.kind}
                      </span>
                      {w.isExclusive && pilotName && w.exclusiveFor && (
                        <Link
                          to={`/pilots/${w.exclusiveFor}`}
                          className="text-[10px] text-accent-pink hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {pilotName}
                        </Link>
                      )}
                    </div>
                  </div>
                </div>

                {/* Key stats */}
                <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[11px]">
                  <div>
                    <span className="text-text-dim">射 </span>
                    <Num>{formatRange(w)}</Num>
                    <span className="text-text-dim text-[9px] ml-0.5">{w.rangeType === 'ring' ? '圈' : '線'}</span>
                  </div>
                  <div>
                    <span className="text-text-dim">重 </span>
                    <Num>{w.weight}</Num>
                  </div>
                  <div>
                    <span className="text-text-dim">命中 </span>
                    <Num>{w.accuracy.toLocaleString()}</Num>
                  </div>
                  <div>
                    <span className="text-text-dim">暴擊 </span>
                    <Num>{w.critValue.toLocaleString()}</Num>
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

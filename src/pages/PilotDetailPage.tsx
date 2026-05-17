import { useState, useRef, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { useParams, Link } from 'react-router-dom'
import type { PilotStats, NeuralDrive } from '../types'
type NdLevel = NeuralDrive['levels'][number]
import { assetUrl } from '../utils/assets'
import { usePilot, usePilotExclusiveWeapon } from '../hooks/useFirestore'
import { highlightNumbers } from '../utils/moduleStats'

// ─── Radar Chart ─────────────────────────────────────────────────────────────

const STAT_AXES: { key: keyof PilotStats; label: string; angle: number }[] = [
  { key: 'shooting', label: '射擊', angle: -90 },
  { key: 'defense', label: '防禦', angle: -30 },
  { key: 'engineering', label: '機械', angle: 30 },
  { key: 'melee', label: '格鬥', angle: 90 },
  { key: 'assault', label: '突擊', angle: 150 },
  { key: 'tactics', label: '戰術', angle: 210 },
]

const MAX_STAT = 5500
const CX = 130
const CY = 110
const R = 75

function toRad(deg: number) {
  return (deg * Math.PI) / 180
}

function axisPoint(angle: number, scale: number) {
  return {
    x: CX + scale * R * Math.cos(toRad(angle)),
    y: CY + scale * R * Math.sin(toRad(angle)),
  }
}

function RadarChart({ stats }: { stats: PilotStats }) {
  const gridLevels = [0.25, 0.5, 0.75, 1.0]

  const statPoints = STAT_AXES.map((ax) => {
    const scale = Math.min(stats[ax.key] / MAX_STAT, 1)
    return axisPoint(ax.angle, scale)
  })

  const polyPoints = statPoints.map((p) => `${p.x},${p.y}`).join(' ')

  return (
    <svg viewBox="0 0 260 220" className="w-full select-none">
      {/* Grid rings */}
      {gridLevels.map((lvl) => {
        const pts = STAT_AXES.map((ax) => axisPoint(ax.angle, lvl))
        return (
          <polygon
            key={lvl}
            points={pts.map((p) => `${p.x},${p.y}`).join(' ')}
            fill="none"
            stroke="#1e2330"
            strokeWidth="1"
          />
        )
      })}

      {/* Axis lines */}
      {STAT_AXES.map((ax) => {
        const p = axisPoint(ax.angle, 1)
        return (
          <line
            key={ax.key}
            x1={CX}
            y1={CY}
            x2={p.x}
            y2={p.y}
            stroke="#1e2330"
            strokeWidth="1"
          />
        )
      })}

      {/* Stat fill */}
      <polygon
        points={polyPoints}
        fill="rgba(255,107,43,0.2)"
        stroke="#ff6b2b"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />

      {/* Labels */}
      {STAT_AXES.map((ax) => {
        const labelScale = 1.28
        const p = axisPoint(ax.angle, labelScale)
        const val = stats[ax.key]
        const anchor =
          Math.abs(ax.angle % 180) < 5
            ? 'middle'
            : ax.angle > 0 && ax.angle < 180
            ? 'start'
            : 'end'

        return (
          <g key={ax.key}>
            <text
              x={p.x}
              y={p.y - 6}
              textAnchor={anchor as 'middle' | 'start' | 'end'}
              fill="#9ca3af"
              fontSize="10"
              fontFamily="'Noto Sans TC',sans-serif"
            >
              {ax.label}
            </text>
            <text
              x={p.x}
              y={p.y + 7}
              textAnchor={anchor as 'middle' | 'start' | 'end'}
              fill="#e8eaed"
              fontSize="10"
              fontWeight="600"
              fontFamily="'JetBrains Mono',monospace"
            >
              {val.toLocaleString()}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

// ─── Skill Icon ───────────────────────────────────────────────────────────────

function SkillIcon({ iconLocal, name, size = 'md' }: { iconLocal: string; name: string; size?: 'sm' | 'md' }) {
  const [err, setErr] = useState(false)
  const cls = size === 'sm' ? 'w-7 h-7' : 'w-10 h-10'
  if (err || !iconLocal) {
    return (
      <div className={`${cls} rounded-lg bg-bg-dark border border-border flex items-center justify-center text-text-dim text-xs flex-shrink-0`}>
        ?
      </div>
    )
  }
  return (
    <img
      src={assetUrl(iconLocal)}
      alt={name}
      className={`${cls} rounded-lg object-cover flex-shrink-0`}
      onError={() => setErr(true)}
    />
  )
}

// ─── Skill Type Badge ─────────────────────────────────────────────────────────

const SKILL_TYPE_CLS: Record<string, string> = {
  被動技能: 'text-accent-blue bg-accent-blue/10 border-accent-blue/30',
  主動技能: 'text-accent-red bg-accent-red/10 border-accent-red/30',
  指令技能: 'text-accent-purple bg-accent-purple/10 border-accent-purple/30',
}

function SkillTypeBadge({ type }: { type: string }) {
  const cls = SKILL_TYPE_CLS[type] ?? 'text-text-dim bg-bg-dark border-border'
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${cls}`}>{type}</span>
  )
}

// ─── Diff Highlight ──────────────────────────────────────────────────────────

function lcsMatched(a: string[], b: string[]): boolean[] {
  const m = a.length, n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1])
  const matched = new Array(n).fill(false)
  let i = m, j = n
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) { matched[j - 1] = true; i--; j-- }
    else if (dp[i - 1][j] >= dp[i][j - 1]) i--
    else j--
  }
  return matched
}

function DiffHighlight({ base, enhanced }: { base: string; enhanced: string }) {
  const tokenize = (s: string) =>
    s.match(/\d+(?:\.\d+)?%?|[a-zA-Z]+|[一-鿿]+|[^\w\d一-鿿\s]|\s+/g) ?? []
  const baseTokens = tokenize(base)
  const enhTokens = tokenize(enhanced)
  const matched = lcsMatched(baseTokens, enhTokens)
  return (
    <>
      {enhTokens.map((token, i) => {
        if (/^\s+$/.test(token)) return <span key={i}>{token}</span>
        if (!matched[i]) return <strong key={i} className="text-accent-yellow font-bold">{token}</strong>
        if (/^\d+(?:\.\d+)?%?$/.test(token)) return <span key={i} className="text-accent-red font-bold">{token}</span>
        return <span key={i}>{token}</span>
      })}
    </>
  )
}

// ─── Exclusive Weapon Panel ──────────────────────────────────────────────────

const ACTIVATION_LABEL: Record<string, string> = { carry: '攜帶', equip: '裝備', use: '使用' }
const WEAPON_RARITY_CLS: Record<string, string> = {
  S: 'text-accent-yellow bg-accent-yellow/10 border-accent-yellow/40',
  A: 'text-accent-purple bg-accent-purple/10 border-accent-purple/40',
}

function ExclusiveWeaponPanel({ pilotName }: { pilotName: string }) {
  const { data: weapon, loading } = usePilotExclusiveWeapon(pilotName)

  if (loading) {
    return <div className="rounded-xl border border-border min-h-[120px] animate-pulse bg-bg-dark" />
  }

  if (!weapon) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-bg-dark flex items-center justify-center min-h-[120px]">
        <span className="text-sm text-text-dim">暫無專屬武器</span>
      </div>
    )
  }

  const rarityCls = WEAPON_RARITY_CLS[weapon.rarity] ?? 'text-text-dim bg-bg-dark border-border'

  return (
    <div className="bg-bg-dark border border-border rounded-xl overflow-hidden text-sm">
      <div className="px-4 py-3 border-b border-border bg-accent-yellow/5">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="font-bold text-text-primary">{weapon.name}</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded border font-bold ${rarityCls}`}>
            {weapon.rarity}
          </span>
        </div>
        <p className="text-xs text-text-dim">{weapon.category} · {weapon.type}</p>
      </div>

      <div className="px-4 py-3 border-b border-border grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
        {[
          { label: '攻擊力', value: weapon.attack },
          { label: '精度',   value: weapon.accuracy },
          { label: '暴擊值', value: weapon.critValue },
          { label: '重量',   value: weapon.weight },
          { label: '觸發槽', value: weapon.triggerSlots },
          { label: '效果槽', value: weapon.effectSlots },
        ].map(({ label, value }) => (
          <div key={label} className="flex justify-between">
            <span className="text-text-dim">{label}</span>
            <span className="text-text-primary font-medium font-[JetBrains_Mono,monospace]">{value}</span>
          </div>
        ))}
      </div>

      {weapon.skills.length > 0 && (
        <div className="px-4 py-3 space-y-3">
          <div className="text-[10px] text-text-dim tracking-widest uppercase">武器技能</div>
          {weapon.skills.map((sk, i) => (
            <div key={i}>
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="font-bold text-text-primary">{sk.name}</span>
                <span className="text-[10px] text-text-dim bg-bg-card border border-border px-1.5 py-0.5 rounded">
                  {ACTIVATION_LABEL[sk.activation] ?? sk.activation}
                </span>
              </div>
              <p className="text-xs text-text-secondary leading-relaxed">{highlightNumbers(sk.description)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Neural Drive Zone Card ───────────────────────────────────────────────────

const ND_ORDER = ['α', 'β', 'γ1', 'γ2']
const ND_POSITION_CLASS: Record<string, string> = {
  'α':  'row-start-1 col-start-1',
  'β':  'row-start-2 col-start-1',
  'γ1': 'row-start-1 col-start-2',
  'γ2': 'row-start-2 col-start-2',
}

function NdLevelTooltipPortal({ level, x, anchorTop }: { level: NdLevel; x: number; anchorTop: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [top, setTop] = useState(anchorTop)

  useLayoutEffect(() => {
    if (!ref.current) return
    const h = ref.current.offsetHeight
    setTop(Math.max(8, Math.min(anchorTop, window.innerHeight - h - 8)))
  }, [anchorTop, level])

  return createPortal(
    <div ref={ref} className="fixed z-50 pointer-events-none" style={{ left: x, top }}>
      <div className="w-72 bg-bg-card border border-border-accent rounded-xl p-4 shadow-2xl">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] px-1.5 py-0.5 rounded border text-accent-purple bg-accent-purple/10 border-accent-purple/30 font-bold flex-shrink-0">
            Lv.{level.level}
          </span>
          <span className="text-sm font-bold truncate">{level.skillName}</span>
        </div>
        <p className="text-[10px] text-text-dim mb-2">芯片總計 ≥{level.minSum}</p>
        <p className="text-xs text-text-secondary leading-relaxed">{highlightNumbers(level.effect)}</p>
      </div>
    </div>,
    document.body
  )
}

function NeuralDriveZoneCard({ nd, zoneName, className, expanded, onLevelHover, onLevelLeave }: {
  nd: NeuralDrive | undefined
  zoneName: string
  className?: string
  expanded: boolean
  onLevelHover?: (level: NdLevel, el: HTMLElement) => void
  onLevelLeave?: () => void
}) {
  if (!nd) {
    return (
      <div className={`border border-dashed border-border rounded-xl p-4 flex flex-col items-center justify-center gap-1 ${expanded ? 'min-h-[160px]' : 'min-h-[80px]'} ${className ?? ''}`}>
        <span className="text-sm font-bold text-accent-purple/40 font-[Orbitron,sans-serif]">{zoneName}</span>
        <span className="text-xs text-text-dim">暫無資料</span>
      </div>
    )
  }

  if (!expanded) {
    return (
      <div className={`bg-bg-dark rounded-xl border border-border overflow-hidden ${className ?? ''}`}>
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-accent-purple/5">
          <span className="text-accent-purple font-bold text-xs font-[Orbitron,sans-serif]">
            神經驅動 {nd.name}
          </span>
          <div className="flex gap-1 flex-wrap ml-auto">
            {nd.slots.map((slot, si) => (
              <span key={si} className="text-[10px] text-text-dim bg-bg-card border border-border px-1.5 py-0.5 rounded">
                {slot}
              </span>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 p-3">
          {nd.levels.map((lv) => (
            <div
              key={lv.level}
              className="flex flex-col items-center gap-1 w-16 rounded-lg p-1.5 hover:bg-bg-card cursor-default transition-colors"
              onMouseEnter={(e) => onLevelHover?.(lv, e.currentTarget)}
              onMouseLeave={onLevelLeave}
            >
              <SkillIcon iconLocal={lv.iconLocal} name={lv.skillName} />
              <div className="text-center w-full">
                <div className="text-xs font-medium leading-tight line-clamp-2 break-all">{lv.skillName}</div>
                <div className="text-[10px] text-text-dim leading-none mt-0.5">Lv.{lv.level}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className={`bg-bg-dark rounded-xl border border-border overflow-hidden ${className ?? ''}`}>
      <div className="flex items-center gap-3 p-3 border-b border-border bg-accent-purple/5">
        <span className="text-accent-purple font-bold text-sm font-[Orbitron,sans-serif]">
          神經驅動 {nd.name}
        </span>
        <div className="flex gap-1 flex-wrap ml-auto">
          {nd.slots.map((slot, si) => (
            <span key={si} className="text-[10px] text-text-dim bg-bg-card border border-border px-2 py-0.5 rounded">
              {slot}
            </span>
          ))}
        </div>
      </div>
      <div className="divide-y divide-border">
        {nd.levels.map((lv) => (
          <div key={lv.level} className="flex gap-3 p-3 items-start">
            <SkillIcon iconLocal={lv.iconLocal} name={lv.skillName} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-bold text-sm">{lv.skillName}</span>
                <span className="text-[10px] text-text-dim">
                  Lv.{lv.level}（芯片總計 ≥{lv.minSum}）
                </span>
              </div>
              <p className="text-sm text-text-secondary leading-relaxed">{highlightNumbers(lv.effect)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const CLASS_STYLES: Record<string, string> = {
  守護者: 'text-accent-green bg-accent-green/10 border-accent-green/40',
  突擊手: 'text-accent-orange bg-accent-orange/10 border-accent-orange/40',
  格鬥家: 'text-accent-red bg-accent-red/10 border-accent-red/40',
  狙擊手: 'text-accent-blue bg-accent-blue/10 border-accent-blue/40',
  戰術家: 'text-accent-purple bg-accent-purple/10 border-accent-purple/40',
  機械師: 'text-accent-cyan bg-accent-cyan/10 border-accent-cyan/40',
  調構師: 'text-accent-yellow bg-accent-yellow/10 border-accent-yellow/40',
}

export default function PilotDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data: pilot, loading } = usePilot(id)
  const [activeSkillTab, setActiveSkillTab] = useState<'技能' | '天賦' | '神經驅動'>('天賦')
  const [ndExpanded, setNdExpanded] = useState(false)
  const [ndHoverState, setNdHoverState] = useState<{ level: NdLevel; x: number; anchorTop: number } | null>(null)

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="h-96 bg-bg-card border border-border rounded-xl animate-pulse" />
      </div>
    )
  }

  if (!pilot) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-12 text-center text-text-dim">
        <p>找不到機師資料</p>
        <Link to="/pilots" className="text-accent-orange no-underline text-sm mt-4 inline-block">
          ← 返回機師圖鑑
        </Link>
      </div>
    )
  }

  const classCls = CLASS_STYLES[pilot.class] ?? 'text-text-secondary bg-bg-card border-border'

  // 從 Firestore 中已存的 biometicComputer 交叉比對 unitType（現有資料無 skill.unitType 時使用）
  type BiomUnit = { unitType: string; skill?: { name: string } }
  const biomUnits = ((pilot as unknown as Record<string, unknown>).biometicComputer as BiomUnit[] | undefined) ?? []
  const unitTypeByName: Record<string, string> = {}
  biomUnits.forEach(u => { if (u.skill?.name) unitTypeByName[u.skill.name] = u.unitType })

  const getUnitType = (sk: { name: string; unitType?: string }) => sk.unitType ?? unitTypeByName[sk.name]
  const classSkills  = pilot.skills.filter(sk => getUnitType(sk) === '6')
  const regularSkills = pilot.skills.filter(sk => getUnitType(sk) !== '6')

  const handleNdLevelHover = (level: NdLevel, el: HTMLElement) => {
    const rect = el.getBoundingClientRect()
    const tooltipW = 288
    const x = rect.right + 8 + tooltipW > window.innerWidth ? rect.left - tooltipW - 8 : rect.right + 8
    setNdHoverState({ level, x, anchorTop: rect.top })
  }
  const handleNdLevelLeave = () => setNdHoverState(null)

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      {/* Back */}
      <Link
        to="/pilots"
        className="inline-flex items-center gap-1 text-sm text-text-dim hover:text-text-primary no-underline mb-6 transition-colors"
      >
        ← 機師圖鑑
      </Link>

      {/* Hero Row: 3-col grid */}
      <div className="grid grid-cols-[160px_1fr_auto] gap-6 mb-4 items-start">
        {/* 左欄: 肖像，固定 160px */}
        <div className="w-40 h-52 bg-bg-card border border-border rounded-xl overflow-hidden flex-shrink-0">
          <img
            src={assetUrl(pilot.portrait)}
            alt={pilot.name}
            className="w-full h-full object-cover object-top"
            onError={(e) => {
              ;(e.target as HTMLImageElement).style.display = 'none'
            }}
          />
        </div>

        {/* 中欄: 資訊＋AP */}
        <div className="flex flex-col gap-3 min-w-0">
          <div>
            <span
              className={`inline-block px-2 py-0.5 rounded text-xs font-bold border mb-2 ${classCls}`}
            >
              {pilot.class}
            </span>
            <h1 className="text-3xl font-black">{pilot.name}</h1>
            <p className="text-text-secondary text-sm mt-1">{pilot.fullName}</p>
          </div>

          <div className="grid grid-cols-2 gap-2 text-sm">
            <InfoRow label="勢力" value={pilot.faction} />
            <InfoRow label="駕照" value={pilot.license} />
            <InfoRow label="駕駛等級" value={pilot.masterLevel} />
            {pilot.profile?.gender && <InfoRow label="性別" value={pilot.profile.gender} />}
            {pilot.profile?.height && <InfoRow label="身高" value={pilot.profile.height} />}
            {pilot.profile?.bloodType && (
              <InfoRow label="血型" value={pilot.profile.bloodType} />
            )}
            {pilot.profile?.additionalInfo &&
              Object.entries(pilot.profile.additionalInfo).map(([k, v]) => (
                <InfoRow key={k} label={k} value={v} />
              ))}
          </div>

          {/* AP */}
          {(() => {
            const ndAp = parseNdApBonus(pilot.neuralDrive)
            const hasNdBonus = ndAp.init + ndAp.max + ndAp.recovery > 0
            return (
              <div className="mt-1">
                <div className="flex gap-4">
                  <APBadge label="初始AP" value={pilot.ap.init} bonus={ndAp.init} />
                  <APBadge label="上限AP" value={pilot.ap.max} bonus={ndAp.max} />
                  <APBadge label="AP回復" value={pilot.ap.recovery} bonus={ndAp.recovery} />
                </div>
                <p className="text-[10px] text-text-dim mt-1.5">
                  滿潛力數值{hasNdBonus ? '，括號為加神經驅動滿配後' : ''}
                </p>
              </div>
            )
          })()}
        </div>

        {/* 右欄: 縮小版雷達圖 */}
        <div className="w-64 flex-shrink-0">
          <SectionLabel>六維屬性</SectionLabel>
          <RadarChart stats={pilot.stats} />
        </div>
      </div>

      {/* Skills / Talents / Neural Drive Tabs */}
      <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex border-b border-border">
          {(['天賦', '技能', '神經驅動'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveSkillTab(tab)}
              className={`px-5 py-3 text-sm font-medium transition-colors cursor-pointer ${
                activeSkillTab === tab
                  ? 'text-accent-orange border-b-2 border-accent-orange bg-accent-orange/5'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {tab}
              {tab === '天賦' && ` (${pilot.talents.length})`}
              {tab === '技能' && ` (${regularSkills.length})`}
              {tab === '神經驅動' && ` (${pilot.neuralDrive?.length ?? 0})`}
            </button>
          ))}
        </div>

        <div className="p-4">
          {activeSkillTab === '天賦' && (
            <div className="flex gap-4 items-start">
            <div className="flex-1 min-w-0 space-y-3">
              {pilot.talents.map((t, i) => (
                <div key={i} className="flex gap-3 p-3 bg-bg-dark rounded-xl border border-border">
                  <SkillIcon iconLocal={t.iconLocal} name={t.name} />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <span className="font-bold text-base">{t.name}</span>
                      <SkillTypeBadge type={t.type} />
                    </div>
                    <p className="text-sm text-text-secondary leading-relaxed">{highlightNumbers(t.description)}</p>
                    {t.descriptionMax && t.descriptionMax !== t.description && (
                      <div className="mt-2.5 rounded-lg bg-accent-cyan/5 border border-accent-cyan/25 px-3 py-2.5">
                        <span className="text-[10px] font-bold text-accent-cyan tracking-widest uppercase">▶ 最大強化</span>
                        <p className="text-sm text-text-secondary leading-relaxed mt-1.5">
                          <DiffHighlight base={t.description} enhanced={t.descriptionMax} />
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="w-72 flex-shrink-0">
              <ExclusiveWeaponPanel pilotName={pilot.name} />
            </div>
            </div>
          )}

          {activeSkillTab === '技能' && (
            <div className="space-y-3">
              {regularSkills.map((sk, i) => (
                <div key={i} className="flex gap-3 p-3 bg-bg-dark rounded-xl border border-border">
                  <SkillIcon iconLocal={sk.iconLocal} name={sk.name} />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <span className="font-bold text-base">{sk.name}</span>
                      <SkillTypeBadge type={sk.type} />
                      {sk.ap && (
                        <span className="text-[10px] text-accent-yellow bg-accent-yellow/10 border border-accent-yellow/30 px-2 py-0.5 rounded">
                          AP {sk.ap}
                        </span>
                      )}
                      {sk.cd && (
                        <span className="text-[10px] text-accent-cyan bg-accent-cyan/10 border border-accent-cyan/30 px-2 py-0.5 rounded">
                          CD {sk.cd}
                        </span>
                      )}
                      {sk.weapon && (
                        <span className="text-[10px] text-text-dim bg-bg-card border border-border px-2 py-0.5 rounded">
                          {sk.weapon}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-text-secondary leading-relaxed">{highlightNumbers(sk.description)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeSkillTab === '神經驅動' && (
            <div className="space-y-4">
              {ndHoverState && !ndExpanded && (
                <NdLevelTooltipPortal
                  level={ndHoverState.level}
                  x={ndHoverState.x}
                  anchorTop={ndHoverState.anchorTop}
                />
              )}
              <div className="flex justify-end">
                <button
                  onClick={() => setNdExpanded(prev => !prev)}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                    ndExpanded
                      ? 'text-accent-purple bg-accent-purple/10 border-accent-purple/30'
                      : 'text-text-secondary bg-bg-card border-border hover:text-text-primary hover:border-border-accent'
                  }`}
                >
                  {ndExpanded ? '▼ 收合詳情' : '▶ 展開詳情'}
                </button>
              </div>
              {classSkills.length > 0 && (
                <div>
                  <div className="text-[10px] text-accent-green tracking-widest uppercase mb-2 font-[Orbitron,sans-serif]">職業技能</div>
                  <div className="space-y-2">
                    {classSkills.map((sk, i) => (
                      <div key={i} className="flex gap-3 p-3 bg-bg-dark rounded-xl border border-accent-green/20">
                        <SkillIcon iconLocal={sk.iconLocal} name={sk.name} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="font-bold text-base">{sk.name}</span>
                            <SkillTypeBadge type={sk.type} />
                          </div>
                          <p className="text-sm text-text-secondary leading-relaxed">{highlightNumbers(sk.description)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 grid-rows-2 gap-3">
                {ND_ORDER.map((zoneName) => {
                  const nd = (pilot.neuralDrive ?? []).find((d) => d.name === zoneName)
                  return (
                    <NeuralDriveZoneCard
                      key={zoneName}
                      nd={nd}
                      zoneName={zoneName}
                      className={ND_POSITION_CLASS[zoneName]}
                      expanded={ndExpanded}
                      onLevelHover={handleNdLevelHover}
                      onLevelLeave={handleNdLevelLeave}
                    />
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── AP Neural Drive Bonus Parser ────────────────────────────────────────────

function parseNdApBonus(neuralDrive: NeuralDrive[] | undefined): {
  init: number; max: number; recovery: number
} {
  const bonus = { init: 0, max: 0, recovery: 0 }
  if (!neuralDrive) return bonus
  for (const zone of neuralDrive) {
    for (const lv of zone.levels) {
      const t = lv.effect ?? ''
      const m1 = t.match(/AP的?初始[值]?\+(\d+)/)
      if (m1) bonus.init += parseInt(m1[1])
      const m2 = t.match(/AP的?上限[值]?\+(\d+)/)
      if (m2) bonus.max += parseInt(m2[1])
      const m3 = t.match(/AP的?回復[值量]?\+(\d+)/)
      if (m3) bonus.recovery += parseInt(m3[1])
    }
  }
  return bonus
}

// ─── Small helpers ────────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-text-dim text-xs w-16 shrink-0">{label}</span>
      <span className="text-text-primary text-sm font-medium truncate">{value}</span>
    </div>
  )
}

function APBadge({ label, value, bonus = 0 }: { label: string; value: number; bonus?: number }) {
  return (
    <div className="flex flex-col items-center bg-bg-dark border border-border rounded-lg px-3 py-1.5">
      <span className="text-[10px] text-text-dim">{label}</span>
      <span className="text-base font-bold text-accent-yellow font-[Orbitron,sans-serif]">
        {value}
        {bonus > 0 && (
          <span className="text-accent-cyan text-sm font-bold ml-0.5">({value + bonus})</span>
        )}
      </span>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-xs text-accent-orange tracking-[3px] uppercase font-[Orbitron,sans-serif] mb-4">
      {children}
    </div>
  )
}

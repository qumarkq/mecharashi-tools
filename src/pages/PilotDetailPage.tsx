import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import type { PilotStats } from '../types'
import { assetUrl } from '../utils/assets'
import { usePilot } from '../hooks/useFirestore'

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
const CX = 150
const CY = 140
const R = 90

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
    <svg viewBox="0 0 300 280" className="w-full max-w-xs mx-auto select-none">
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

function SkillIcon({ iconLocal, name }: { iconLocal: string; name: string }) {
  const [err, setErr] = useState(false)
  if (err || !iconLocal) {
    return (
      <div className="w-10 h-10 rounded-lg bg-bg-dark border border-border flex items-center justify-center text-text-dim text-xs flex-shrink-0">
        ?
      </div>
    )
  }
  return (
    <img
      src={assetUrl(iconLocal)}
      alt={name}
      className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
      onError={() => setErr(true)}
    />
  )
}

// ─── Skill Type Badge ─────────────────────────────────────────────────────────

function SkillTypeBadge({ type }: { type: string }) {
  const map: Record<string, string> = {
    被動技能: 'text-text-dim bg-bg-dark border-border',
    主動技能: 'text-accent-orange bg-accent-orange/10 border-accent-orange/30',
    指令技能: 'text-accent-blue bg-accent-blue/10 border-accent-blue/30',
  }
  const cls = map[type] ?? 'text-text-dim bg-bg-dark border-border'
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${cls}`}>{type}</span>
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

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      {/* Back */}
      <Link
        to="/pilots"
        className="inline-flex items-center gap-1 text-sm text-text-dim hover:text-text-primary no-underline mb-6 transition-colors"
      >
        ← 機師圖鑑
      </Link>

      {/* Hero Row */}
      <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-8 mb-8">
        {/* Portrait */}
        <div className="relative w-full md:w-48 aspect-[3/4] md:aspect-auto md:h-64 bg-bg-card border border-border rounded-xl overflow-hidden flex-shrink-0">
          <img
            src={assetUrl(pilot.portrait)}
            alt={pilot.name}
            className="w-full h-full object-cover object-top"
            onError={(e) => {
              ;(e.target as HTMLImageElement).style.display = 'none'
            }}
          />
        </div>

        {/* Basic Info */}
        <div className="flex flex-col gap-3">
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
          <div className="flex gap-4 mt-1">
            <APBadge label="初始" value={pilot.ap.init} />
            <APBadge label="上限" value={pilot.ap.max} />
            <APBadge label="回覆" value={pilot.ap.recovery} />
          </div>
        </div>
      </div>

      {/* Stats Radar */}
      <div className="bg-bg-card border border-border rounded-xl p-6 mb-6">
        <SectionLabel>六維屬性</SectionLabel>
        <RadarChart stats={pilot.stats} />
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
              {tab === '技能' && ` (${pilot.skills.length})`}
              {tab === '神經驅動' && ` (${pilot.neuralDrive?.length ?? 0})`}
            </button>
          ))}
        </div>

        <div className="p-4">
          {activeSkillTab === '天賦' && (
            <div className="space-y-3">
              {pilot.talents.map((t, i) => (
                <div key={i} className="flex gap-3 p-3 bg-bg-dark rounded-xl border border-border">
                  <SkillIcon iconLocal={t.iconLocal} name={t.name} />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="font-bold text-sm">{t.name}</span>
                      <SkillTypeBadge type={t.type} />
                    </div>
                    <p className="text-xs text-text-secondary leading-relaxed">{t.description}</p>
                    {t.descriptionMax && t.descriptionMax !== t.description && (
                      <details className="mt-1">
                        <summary className="text-[10px] text-accent-cyan cursor-pointer">
                          最大強化效果
                        </summary>
                        <p className="text-xs text-text-dim leading-relaxed mt-1">
                          {t.descriptionMax}
                        </p>
                      </details>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeSkillTab === '技能' && (
            <div className="space-y-3">
              {pilot.skills.map((sk, i) => (
                <div key={i} className="flex gap-3 p-3 bg-bg-dark rounded-xl border border-border">
                  <SkillIcon iconLocal={sk.iconLocal} name={sk.name} />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="font-bold text-sm">{sk.name}</span>
                      <SkillTypeBadge type={sk.type} />
                      {sk.ap && (
                        <span className="text-[10px] text-accent-yellow bg-accent-yellow/10 border border-accent-yellow/30 px-2 py-0.5 rounded">
                          AP {sk.ap}
                        </span>
                      )}
                      {sk.weapon && (
                        <span className="text-[10px] text-text-dim bg-bg-card border border-border px-2 py-0.5 rounded">
                          {sk.weapon}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-text-secondary leading-relaxed">{sk.description}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeSkillTab === '神經驅動' && (
            <div className="space-y-4">
              {(pilot.neuralDrive ?? []).map((nd, i) => (
                <div key={i} className="bg-bg-dark rounded-xl border border-border overflow-hidden">
                  <div className="flex items-center gap-3 p-3 border-b border-border bg-accent-purple/5">
                    <span className="text-accent-purple font-bold text-sm font-[Orbitron,sans-serif]">
                      神經驅動 {nd.name}
                    </span>
                    <div className="flex gap-1 flex-wrap ml-auto">
                      {nd.slots.map((slot, si) => (
                        <span
                          key={si}
                          className="text-[10px] text-text-dim bg-bg-card border border-border px-2 py-0.5 rounded"
                        >
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
                            <span className="font-bold text-xs">{lv.skillName}</span>
                            <span className="text-[10px] text-text-dim">
                              Lv.{lv.level}（芯片總計 ≥{lv.minSum}）
                            </span>
                          </div>
                          <p className="text-xs text-text-secondary leading-relaxed">{lv.effect}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
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

function APBadge({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col items-center bg-bg-dark border border-border rounded-lg px-3 py-1.5">
      <span className="text-[10px] text-text-dim">{label}</span>
      <span className="text-base font-bold text-accent-yellow font-[Orbitron,sans-serif]">
        {value}
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

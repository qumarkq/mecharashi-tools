import { useParams, Link } from 'react-router-dom'
import { useWeapon, usePilotNameMap } from '../../hooks/useFirestore'
import { WeaponRarityBadge } from '../../components/WeaponRarityBadge'
import { WeaponIcon } from '../../components/WeaponIcon'
import {
  WeaponTypeBadge,
  WeaponEquipSlotBadge,
  WeaponMechRestrictionBadge,
} from '../../components/WeaponBadges'
import { WeaponSkillCard } from '../../components/WeaponSkillCard'
import type { Weapon } from '../../types'

// ── Labels & formatters ───────────────────────────────────────────────────────

const MOD_STAT_LABELS: Record<string, string> = {
  attack:    '攻擊力',
  crit:      '暴擊',
  accuracy:  '命中',
  firepower: '火力',
  weight:    '重量',
}

const RANGE_TYPE_LABELS: Record<string, string> = {
  manhattan:  '菱形',
  orthogonal: '十字直線',
  ring:       '環形',
}

function formatRange(weapon: Weapon): string {
  return weapon.rangeType === 'ring'
    ? `${weapon.maxRange}+`
    : `${weapon.minRange}-${weapon.maxRange}`
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionHeading({ children }: { children: string }) {
  return (
    <h2 className="text-xs text-text-dim tracking-[3px] uppercase font-[Orbitron,sans-serif] mb-3">
      {children}
    </h2>
  )
}

function StatCell({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="bg-bg-dark rounded-lg p-3 text-center">
      <div className="text-xs text-text-dim mb-1">{label}</div>
      <div className="text-base font-bold text-accent-red font-[JetBrains_Mono,monospace] leading-tight">
        {value}
      </div>
      {sub && <div className="text-[11px] text-text-dim mt-0.5">{sub}</div>}
    </div>
  )
}

function SlotBoxes({ count, colorClass }: { count: number; colorClass: string }) {
  if (count === 0) return <span className="text-text-dim text-sm font-[JetBrains_Mono,monospace]">0</span>
  return (
    <div className="flex gap-1.5 items-center">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={`w-5 h-5 rounded border-2 ${colorClass}`} />
      ))}
      <span className={`text-sm font-bold font-[JetBrains_Mono,monospace] ${colorClass.split(' ')[0]}`}>
        ×{count}
      </span>
    </div>
  )
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12 space-y-5">
      <div className="h-4 w-28 bg-bg-card rounded animate-pulse" />
      <div className="h-36 bg-bg-card rounded-xl animate-pulse" />
      <div className="h-28 bg-bg-card rounded-xl animate-pulse" />
      <div className="h-40 bg-bg-card rounded-xl animate-pulse" />
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function WeaponDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data: weapon, loading, error } = useWeapon(id)
  const { data: pilotNameMap } = usePilotNameMap()

  if (loading) return <LoadingSkeleton />

  if (error || !weapon) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <Link to="/weapons" className="text-accent-cyan hover:underline text-sm">← 返回武器圖鑑</Link>
        <div className="mt-8 bg-bg-card border border-border rounded-xl p-12 text-center text-text-dim">
          {error ? `載入失敗：${error.message}` : '找不到此武器'}
        </div>
      </div>
    )
  }

  const pilotName   = weapon.exclusiveFor ? pilotNameMap[weapon.exclusiveFor] : null
  const hasFixedMod = !!(weapon.fixedMod?.planName)
  const hasFloatMod = !!(weapon.floatingMod?.planName)
  const hasSlots    = weapon.triggerSlots > 0 || weapon.effectSlots > 0 || weapon.componentLimit > 0

  return (
    <div className="max-w-4xl mx-auto px-4 py-12 space-y-6">

      {/* Breadcrumb */}
      <div>
        <Link to="/weapons" className="text-accent-cyan hover:underline text-sm">
          ← 返回武器圖鑑
        </Link>
      </div>

      {/* ── B-1 Hero + B-5 Component Slots ──────────────────────────────────── */}
      <div className={hasSlots ? 'grid grid-cols-1 md:grid-cols-2 gap-4' : ''}>

        <div className="bg-bg-card border border-border rounded-xl p-6">
          <div className="flex items-start gap-4">
            <WeaponIcon icon={weapon.icon} name={weapon.name} size="lg" isExclusive={weapon.isExclusive} />
            <div className="flex-1 min-w-0">
              <div className="flex items-start gap-3 flex-wrap mb-3">
                <h1 className="text-2xl font-bold text-text-primary leading-tight">{weapon.name}</h1>
                <WeaponRarityBadge rarity={weapon.rarity} />
              </div>

              <div className="flex flex-wrap gap-2">
                <WeaponTypeBadge type={weapon.type} />
                <span className="px-2 py-0.5 rounded text-[13px] border text-text-secondary bg-bg-dark border-border">
                  {weapon.kind}
                </span>
                <WeaponEquipSlotBadge slot={weapon.equipSlot} />
                <WeaponMechRestrictionBadge restriction={weapon.mechRestriction} />
              </div>

              {weapon.isExclusive && pilotName && weapon.exclusiveFor && (
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-[13px] text-accent-yellow font-bold">⭐ 專屬武器</span>
                  <Link
                    to={`/pilots/${weapon.exclusiveFor}`}
                    className="text-[13px] text-accent-pink hover:underline"
                  >
                    {pilotName}
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>

        {hasSlots && (
          <div className="bg-bg-card border border-border rounded-xl p-5">
            <SectionHeading>元件插槽</SectionHeading>
            <div className="flex flex-wrap gap-8">

              <div>
                <div className="text-[13px] text-text-dim mb-2">觸發元件</div>
                <SlotBoxes
                  count={weapon.triggerSlots}
                  colorClass="border-accent-orange text-accent-orange"
                />
              </div>

              <div>
                <div className="text-[13px] text-text-dim mb-2">應用元件</div>
                <SlotBoxes
                  count={weapon.effectSlots}
                  colorClass="border-accent-cyan text-accent-cyan"
                />
              </div>

              {weapon.componentLimit > 0 && (
                <div className="border-l border-border pl-8">
                  <div className="text-[13px] text-text-dim mb-2">元件上限</div>
                  <div className="text-2xl font-bold text-accent-red font-[JetBrains_Mono,monospace]">
                    {weapon.componentLimit}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

      </div>

      {/* ── B-2 Stats ────────────────────────────────────────────────────────── */}
      <div className="bg-bg-card border border-border rounded-xl p-5">
        <SectionHeading>基礎屬性</SectionHeading>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <StatCell label="攻擊力"   value={weapon.attack} />
          <StatCell label="命中"     value={weapon.accuracy.toLocaleString()} />
          <StatCell label="暴擊"     value={weapon.critValue.toLocaleString()} />
          <StatCell label="重量"     value={weapon.weight} />
          <StatCell
            label="射程"
            value={formatRange(weapon)}
            sub={RANGE_TYPE_LABELS[weapon.rangeType]}
          />
          <StatCell
            label="彈藥量"
            value={weapon.ammoCount === 0 ? '∞' : weapon.ammoCount}
          />
          <StatCell label="連擊數"   value={weapon.hitCount} />
          <StatCell label="種類係數" value={weapon.kindCoefficient.toFixed(2)} />
        </div>
      </div>

      {/* ── B-3 Skills ───────────────────────────────────────────────────────── */}
      {weapon.skills.length > 0 && (
        <div>
          <SectionHeading>武器技能</SectionHeading>
          <div className="space-y-3">
            {weapon.skills.map((skill, i) => (
              <WeaponSkillCard key={i} skill={skill} />
            ))}
          </div>
        </div>
      )}

      {/* ── B-4 Mods ─────────────────────────────────────────────────────────── */}
      {(hasFixedMod || hasFloatMod) && (
        <div>
          <SectionHeading>改裝資訊</SectionHeading>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {hasFixedMod && (
              <div className="bg-bg-card border border-border rounded-xl p-4">
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <span className="text-[11px] text-accent-orange font-bold tracking-widest uppercase font-[Orbitron,sans-serif]">
                    固定改裝
                  </span>
                  <span className="text-sm font-bold text-text-primary">{weapon.fixedMod.planName}</span>
                </div>
                <div className="text-[13px] text-text-dim mb-3">
                  可改等級上限{' '}
                  <span className="text-accent-red font-bold font-[JetBrains_Mono,monospace]">
                    {weapon.fixedMod.maxLevel}
                  </span>
                </div>
                {weapon.fixedMod.effects.length > 0 && (
                  <div className="space-y-2">
                    {weapon.fixedMod.effects.map((e, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span className="text-text-secondary">{MOD_STAT_LABELS[e.stat] ?? e.stat}</span>
                        <span className="text-accent-red font-bold font-[JetBrains_Mono,monospace]">
                          +{e.value}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {hasFloatMod && (
              <div className="bg-bg-card border border-border rounded-xl p-4">
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <span className="text-[11px] text-accent-cyan font-bold tracking-widest uppercase font-[Orbitron,sans-serif]">
                    浮動改裝
                  </span>
                  <span className="text-sm font-bold text-text-primary">{weapon.floatingMod.planName}</span>
                </div>
                <div className="text-[13px] text-text-dim mb-3">
                  可填{' '}
                  <span className="text-accent-red font-bold font-[JetBrains_Mono,monospace]">
                    {weapon.floatingMod.slots}
                  </span>{' '}
                  個效果
                </div>
                {weapon.floatingMod.possibleEffects.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-[13px]">
                      <thead>
                        <tr className="text-text-dim border-b border-border">
                          <th className="text-left pb-2 font-medium">效果</th>
                          <th className="text-left pb-2 font-medium">條件</th>
                          <th className="text-right pb-2 font-medium">數值範圍</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {weapon.floatingMod.possibleEffects.map((e, i) => (
                          <tr key={i} className="hover:bg-bg-dark/50 transition-colors">
                            <td className="py-1.5 text-text-secondary">
                              {MOD_STAT_LABELS[e.stat] ?? e.stat}
                            </td>
                            <td className="py-1.5 text-text-dim">
                              {e.condition ?? '無條件'}
                            </td>
                            <td className="py-1.5 text-right font-bold text-accent-red font-[JetBrains_Mono,monospace]">
                              {e.min} ~ {e.max}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}


    </div>
  )
}

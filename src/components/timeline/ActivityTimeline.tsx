import { useMemo } from 'react'
import type { PatchVersion, TimedActivity, ActivityType } from '../../data/patchVersions/types'
import PatchInfoRow from './PatchInfoRow'

// ─── Date utilities ───────────────────────────────────────────────────────────

function parseDate(str: string): Date {
  // Handle prefixes like "約 " and formats YYYY/MM/DD or YYYY-MM-DD
  const cleaned = str.replace(/^[^0-9]+/, '')
  const parts = cleaned.split(/[\/\-]/).map(Number)
  return new Date(parts[0], parts[1] - 1, parts[2])
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86400000)
}

function fmtShort(date: Date): string {
  return `${date.getMonth() + 1}/${date.getDate()}`
}

function fmtFull(date: Date): string {
  const m = date.getMonth() + 1
  const d = date.getDate()
  return `${date.getFullYear()}/${m < 10 ? '0' + m : m}/${d < 10 ? '0' + d : d}`
}

function activityEnd(act: TimedActivity): Date {
  return addDays(parseDate(act.startDate), act.weeks * 7)
}

function isActiveInWeek(act: TimedActivity, thursday: Date): boolean {
  const start = parseDate(act.startDate)
  const end = activityEnd(act)
  return start <= thursday && thursday < end
}

function computeWeeks(fromStr: string, toStr: string | null, extendActs: TimedActivity[], minWeeks = 3): Date[] {
  const from = parseDate(fromStr)
  let to = toStr ? parseDate(toStr) : addDays(from, minWeeks * 7)

  // Extend to cover all activity ends
  for (const act of extendActs) {
    const end = activityEnd(act)
    if (end > to) to = end
  }

  // Ensure minimum
  const minTo = addDays(from, minWeeks * 7)
  if (to < minTo) to = minTo

  const weeks: Date[] = []
  let cur = from
  while (cur < to) {
    weeks.push(cur)
    cur = addDays(cur, 7)
  }
  return weeks
}

// ─── Activity color map ───────────────────────────────────────────────────────

type ColorEntry = { cell: string; header: string; short: string }

const COLORS: Record<ActivityType, ColorEntry> = {
  skinGacha:           { cell: 'bg-accent-orange/20 border-accent-orange/50',   header: 'text-accent-orange',   short: '刮' },
  roulette:            { cell: 'bg-accent-yellow/20 border-accent-yellow/50',   header: 'text-accent-yellow',   short: '輪' },
  pilotMission:        { cell: 'bg-accent-purple/20 border-accent-purple/50',   header: 'text-accent-purple',   short: '特' },
  crossShipping:       { cell: 'bg-[rgba(201,160,220,0.2)] border-[rgba(201,160,220,0.5)]', header: 'text-[#c9a0dc]', short: '海' },
  specificPilotBanner: { cell: 'bg-[rgba(121,192,255,0.2)] border-[rgba(121,192,255,0.5)]', header: 'text-[#79c0ff]', short: '角池' },
  specificMechBanner:  { cell: 'bg-[rgba(88,166,212,0.2)] border-[rgba(88,166,212,0.5)]',  header: 'text-[#58a6d4]', short: '甲池' },
  limitedEvent:        { cell: 'bg-accent-cyan/20 border-accent-cyan/50',       header: 'text-accent-cyan',     short: '限' },
  loginEvent:          { cell: 'bg-accent-green/20 border-accent-green/50',     header: 'text-accent-green',    short: '簽' },
  battlePass:          { cell: 'bg-gray-500/20 border-gray-500/50',             header: 'text-gray-400',        short: '令' },
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function WeekRow({
  week, prevWeek, nextWeek, activities,
}: {
  week: Date
  prevWeek: Date | null
  nextWeek: Date | null
  activities: TimedActivity[]
}) {
  return (
    <div className="flex items-stretch gap-px">
      <div className="w-9 shrink-0 text-[9px] text-text-dim text-right pr-1 flex items-center justify-end leading-none">
        {fmtShort(week)}
      </div>
      <div className="flex gap-px flex-1">
        {activities.map((act, i) => {
          const active     = isActiveInWeek(act, week)
          const prevActive = prevWeek ? isActiveInWeek(act, prevWeek) : false
          const nextActive = nextWeek ? isActiveInWeek(act, nextWeek) : false

          if (!active) return <div key={i} className="flex-1 h-5" />

          const c = COLORS[act.type]
          const cls = [
            'flex-1 h-5',
            c.cell,
            'border-l border-r',
            !prevActive ? 'border-t rounded-t' : 'border-t-0',
            !nextActive ? 'border-b rounded-b' : 'border-b-0',
          ].join(' ')

          const endDay = addDays(activityEnd(act), -1)
          const sub = act.pilots?.join('、') ?? act.mechs?.join('、') ?? ''
          const tooltip = `${act.name}${sub ? `（${sub}）` : ''}\n${fmtFull(parseDate(act.startDate))} → ${fmtFull(endDay)}`

          return <div key={i} className={cls} title={tooltip} />
        })}
      </div>
    </div>
  )
}

function HalfDivider({ count }: { count: number }) {
  return (
    <div className="flex gap-px my-0.5">
      <div className="w-9 shrink-0" />
      <div className="flex gap-px flex-1">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="flex-1 h-px bg-accent-purple/40" />
        ))}
      </div>
    </div>
  )
}

// ─── Fallback: no gantt data ──────────────────────────────────────────────────

function ActivityFallback({ version, side }: { version: PatchVersion; side: 'cn' | 'tw' }) {
  const upper = version.upper
  const lower = version.lower

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Upper half ends when the lower half begins
  const lowerStartStr = side === 'cn' ? lower.cnDate : lower.twDate
  const upperHasEnded = lowerStartStr ? parseDate(lowerStartStr) <= today : false

  function legacyItems(half: typeof upper) {
    return [
      ...(half.skinGacha ? [`刮刮樂：${half.skinGacha}`] : []),
      ...(half.rouletteEvent ? ['角雕輪盤（末週）'] : []),
      ...(half.revivedBanners ?? []).map(b => `復刻：${b}`),
      ...(half.specialEvents ?? []),
    ]
  }

  const upperItems = upperHasEnded ? [] : legacyItems(upper)
  const lowerItems = legacyItems(lower)

  if (upperItems.length === 0 && lowerItems.length === 0) {
    return (
      <p className="text-[11px] text-text-dim text-center py-4">（暫無活動資料）</p>
    )
  }

  return (
    <div className="space-y-2 text-[11px]">
      {side === 'cn'
        ? <div className="text-[9px] text-text-dim">陸版 {upper.cnDate.slice(0, 7)}</div>
        : <div className="text-[9px] text-text-dim">台版 {(upper.twDate ?? '').slice(0, 7)}</div>
      }
      {upperItems.map((t, i) => (
        <PatchInfoRow key={i} label={t} items={[]} color="blue" />
      ))}
      {lowerItems.length > 0 && (
        <div className={upperItems.length > 0 ? 'border-t border-border/40 pt-1.5' : ''}>
          {lowerItems.map((t, i) => (
            <PatchInfoRow key={i} label={t} items={[]} color="blue" />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Column count helper (used by parent for dynamic layout) ─────────────────

export function countGanttColumns(version: PatchVersion, side: 'cn' | 'tw'): number {
  const isCn = side === 'cn'
  const rawUpper = isCn ? (version.upper.cnActivities ?? []) : (version.upper.twActivities ?? [])
  const rawLower = isCn ? (version.lower.cnActivities ?? []) : (version.lower.twActivities ?? [])
  if (rawUpper.length === 0 && rawLower.length === 0) return 0
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return [...rawUpper, ...rawLower].filter(act => activityEnd(act) > today).length
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  version: PatchVersion
  side: 'cn' | 'tw'
}

export default function ActivityTimeline({ version, side }: Props) {
  const isCn = side === 'cn'

  const upperStart = isCn ? version.upper.cnDate : (version.upper.twDate ?? '')
  const lowerStart = isCn ? version.lower.cnDate : (version.lower.twDate ?? '')

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const rawUpperActs: TimedActivity[] = isCn
    ? (version.upper.cnActivities ?? [])
    : (version.upper.twActivities ?? [])
  const rawLowerActs: TimedActivity[] = isCn
    ? (version.lower.cnActivities ?? [])
    : (version.lower.twActivities ?? [])

  const upperActs = rawUpperActs.filter(act => activityEnd(act) > today)
  const lowerActs = rawLowerActs.filter(act => activityEnd(act) > today)

  const hasGanttData = rawUpperActs.length > 0 || rawLowerActs.length > 0
  const allActs = useMemo(() => [...upperActs, ...lowerActs], [upperActs, lowerActs])

  // Fallback when no gantt data provided
  if (!hasGanttData || !upperStart || !lowerStart) {
    return <ActivityFallback version={version} side={side} />
  }

  // All gantt activities have ended
  if (allActs.length === 0) {
    return <p className="text-[11px] text-text-dim text-center py-4">（本版活動已結束）</p>
  }

  // Upper weeks: from upper start to lower start (extended by activities beyond that)
  const upperWeeks = useMemo(
    () => computeWeeks(upperStart, lowerStart, upperActs),
    [upperStart, lowerStart, upperActs],
  )

  // Lower weeks: from lower start to last activity end (min 3 weeks)
  const lowerWeeks = useMemo(
    () => computeWeeks(lowerStart, null, lowerActs),
    [lowerStart, lowerActs],
  )

  return (
    <div className="overflow-x-auto">
      {/* Track headers */}
      <div className="flex gap-px mb-1">
        <div className="w-9 shrink-0" />
        <div className="flex gap-px flex-1">
          {allActs.map((act, i) => (
            <div
              key={i}
              className={`flex-1 text-center text-[9px] font-bold leading-tight ${COLORS[act.type].header}`}
              title={act.name}
            >
              {COLORS[act.type].short}
            </div>
          ))}
        </div>
      </div>

      {/* Upper half weeks */}
      {upperWeeks.map((week, i) => (
        <WeekRow
          key={`u${i}`}
          week={week}
          prevWeek={i > 0 ? upperWeeks[i - 1] : null}
          nextWeek={i < upperWeeks.length - 1 ? upperWeeks[i + 1] : lowerWeeks[0]}
          activities={allActs}
        />
      ))}

      {/* Half divider */}
      <HalfDivider count={allActs.length} />

      {/* Lower half weeks */}
      {lowerWeeks.map((week, i) => (
        <WeekRow
          key={`l${i}`}
          week={week}
          prevWeek={i > 0 ? lowerWeeks[i - 1] : upperWeeks[upperWeeks.length - 1]}
          nextWeek={i < lowerWeeks.length - 1 ? lowerWeeks[i + 1] : null}
          activities={allActs}
        />
      ))}
    </div>
  )
}

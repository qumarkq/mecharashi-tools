import { useState, useMemo } from 'react'
import type { PatchVersion, PatchHalf, TimedActivity, ActivityType } from '../../data/patchVersions/types'
import PatchInfoRow from './PatchInfoRow'

// ── Date utils ─────────────────────────────────────────────────────────────────

function parseDate(str: string): Date {
  const cleaned = str.replace(/^[^0-9]+/, '')
  const [y, m, d] = cleaned.split(/[\/\-]/).map(Number)
  return new Date(y, m - 1, d)
}

function addDays(date: Date, n: number): Date {
  return new Date(date.getTime() + n * 86400000)
}

function fmtShort(date: Date): string {
  return `${date.getMonth() + 1}/${date.getDate()}`
}

function fmtFull(date: Date): string {
  const m = date.getMonth() + 1
  const d = date.getDate()
  return `${date.getFullYear()}/${m < 10 ? '0' + m : m}/${d < 10 ? '0' + d : d}`
}

// ── C-1: 週軸計算 ──────────────────────────────────────────────────────────────

function generateWeeks(
  startStr: string,
  endStr: string | null,
  acts: TimedActivity[],
  minWeeks = 3,
): Date[] {
  if (!startStr) return []
  const start = parseDate(startStr)
  const minEnd = addDays(start, minWeeks * 7)
  let end = endStr ? parseDate(endStr) : minEnd
  if (end < minEnd) end = minEnd

  for (const act of acts) {
    const actEnd = addDays(parseDate(act.startDate), act.weeks * 7)
    if (actEnd > end) end = actEnd
  }

  const weeks: Date[] = []
  let cur = start
  while (cur < end) {
    weeks.push(cur)
    cur = addDays(cur, 7)
  }
  return weeks
}

function activityToColumns(
  act: TimedActivity,
  allWeeks: Date[],
): { colStart: number; colSpan: number } | null {
  if (allWeeks.length === 0) return null
  const startDt = parseDate(act.startDate)
  const endDt = addDays(startDt, act.weeks * 7)

  const colStart = allWeeks.findIndex(w => w >= startDt)
  if (colStart === -1) return null

  let colEnd = -1
  for (let i = allWeeks.length - 1; i >= 0; i--) {
    if (allWeeks[i] <= endDt) { colEnd = i; break }
  }
  if (colEnd < colStart) return null

  return { colStart, colSpan: colEnd - colStart + 1 }
}

// ── 活動顏色 ────────────────────────────────────────────────────────────────────

const COLORS: Record<ActivityType, { dot: string; line: string; text: string; label: string }> = {
  skinGacha:           { dot: 'bg-accent-orange',  line: 'bg-accent-orange/60',              text: 'text-accent-orange',  label: '刮刮樂' },
  roulette:            { dot: 'bg-accent-yellow',  line: 'bg-accent-yellow/60',              text: 'text-accent-yellow',  label: '輪盤' },
  pilotMission:        { dot: 'bg-accent-purple',  line: 'bg-accent-purple/60',              text: 'text-accent-purple',  label: '特遣' },
  crossShipping:       { dot: 'bg-[#c9a0dc]',      line: 'bg-[rgba(201,160,220,0.6)]',       text: 'text-[#c9a0dc]',      label: '海運' },
  specificPilotBanner: { dot: 'bg-[#79c0ff]',      line: 'bg-[rgba(121,192,255,0.6)]',       text: 'text-[#79c0ff]',      label: '角色池' },
  specificMechBanner:  { dot: 'bg-[#58a6d4]',      line: 'bg-[rgba(88,166,212,0.6)]',        text: 'text-[#58a6d4]',      label: '機甲池' },
  limitedEvent:        { dot: 'bg-accent-cyan',    line: 'bg-accent-cyan/60',                text: 'text-accent-cyan',    label: '限時活動' },
  loginEvent:          { dot: 'bg-accent-green',   line: 'bg-accent-green/60',               text: 'text-accent-green',   label: '簽到' },
  battlePass:          { dot: 'bg-gray-500',        line: 'bg-gray-500/60',                   text: 'text-gray-400',       label: '戰令' },
}

// ── CSS 常數 ──────────────────────────────────────────────────────────────────

const TD = 'border border-[#2a3040] px-2 py-1.5 text-[13px] text-center align-middle text-text-secondary'
const TH = 'border border-[#2a3040] px-2 py-1.5 text-center align-middle'
const LABEL = 'border border-[#2a3040] px-3 py-1.5 text-left text-[12px] text-text-dim bg-[#0e1119] whitespace-nowrap'

// ── C-4: VersionInfoRows ───────────────────────────────────────────────────────

function VersionInfoRows({
  upper,
  lower,
  upperCount,
  lowerCount,
  totalWeeks,
}: {
  upper: PatchHalf
  lower: PatchHalf
  upperCount: number
  lowerCount: number
  totalWeeks: number
}) {
  const pilotsU = (upper.pilots ?? []).join('、')
  const pilotsL = (lower.pilots ?? []).join('、')
  const mechsU = (upper.mechs ?? []).join('、')
  const mechsL = (lower.mechs ?? []).join('、')

  const raidNamesU = (upper.armamentRaids ?? []).map(r => r.name).join('、')
  const raidNamesL = (lower.armamentRaids ?? []).map(r => r.name).join('、')
  const weaponsU = (upper.armamentRaids ?? [])
    .filter(r => r.weapons?.length)
    .map(r => `${r.name}：${r.weapons!.join('/')}`)
    .join('　')
  const weaponsL = (lower.armamentRaids ?? [])
    .filter(r => r.weapons?.length)
    .map(r => `${r.name}：${r.weapons!.join('/')}`)
    .join('　')
  const backpacksU = (upper.armamentRaids ?? [])
    .filter(r => r.backpacks?.length)
    .map(r => `${r.name}：${r.backpacks!.join('/')}`)
    .join('　')
  const backpacksL = (lower.armamentRaids ?? [])
    .filter(r => r.backpacks?.length)
    .map(r => `${r.name}：${r.backpacks!.join('/')}`)
    .join('　')

  const bpPilots = (upper.battlePass?.pilots ?? lower.battlePass?.pilots ?? []).join('、')
  const bpMechs  = (upper.battlePass?.mechs  ?? lower.battlePass?.mechs  ?? []).join('、')

  const halfRows = [
    { label: '機師',    u: pilotsU,    l: pilotsL    },
    { label: '機甲',    u: mechsU,     l: mechsL     },
    { label: '武裝關卡', u: raidNamesU, l: raidNamesL },
    { label: '討伐專武', u: weaponsU,   l: weaponsL   },
    { label: '討伐背包', u: backpacksU, l: backpacksL },
  ].filter(r => r.u || r.l)

  const dash = <span className="opacity-30">—</span>

  return (
    <>
      {halfRows.map(row => (
        <tr key={row.label}>
          <td className={LABEL}>{row.label}</td>
          <td colSpan={upperCount} className={`${TD} bg-[rgba(255,107,43,0.05)]`}>
            {row.u || dash}
          </td>
          <td colSpan={lowerCount} className={`${TD} bg-[rgba(6,182,212,0.05)]`}>
            {row.l || dash}
          </td>
        </tr>
      ))}
      {bpPilots && (
        <tr>
          <td className={LABEL}>角色戰令</td>
          <td colSpan={totalWeeks} className={`${TD} bg-[rgba(168,85,247,0.05)] text-accent-purple`}>
            {bpPilots}
          </td>
        </tr>
      )}
      {bpMechs && (
        <tr>
          <td className={LABEL}>機甲戰令</td>
          <td colSpan={totalWeeks} className={`${TD} bg-[rgba(168,85,247,0.05)] text-accent-purple`}>
            {bpMechs}
          </td>
        </tr>
      )}
    </>
  )
}

// ── C-5: ActivityGanttRow ─────────────────────────────────────────────────────

function ActivityGanttRow({
  act,
  allWeeks,
  totalWeeks,
}: {
  act: TimedActivity
  allWeeks: Date[]
  totalWeeks: number
}) {
  const cols = activityToColumns(act, allWeeks)
  const c = COLORS[act.type]
  const endDt = addDays(parseDate(act.startDate), act.weeks * 7)
  const sub = act.pilots?.join('、') ?? act.mechs?.join('、') ?? ''

  const cells: React.ReactNode[] = []

  if (!cols || totalWeeks === 0) {
    cells.push(<td key="all" colSpan={Math.max(totalWeeks, 1)} />)
  } else {
    const { colStart, colSpan } = cols
    if (colStart > 0) {
      cells.push(<td key="pre" colSpan={colStart} />)
    }
    cells.push(
      <td key="bar" colSpan={colSpan} className="group relative py-3.5 px-2 cursor-default">
        {/* Hover tooltip */}
        <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2
                        hidden group-hover:block z-20
                        bg-bg-dark/95 border border-border rounded-lg px-3 py-2 shadow-lg">
          <div className={`text-[13px] font-medium ${c.text}`}>{act.name}</div>
          {sub && <div className="text-[12px] text-text-dim mt-0.5">{sub}</div>}
          <div className="text-[12px] text-text-dim mt-0.5">{act.startDate} → {fmtFull(endDt)}</div>
        </div>

        {colSpan === 1 ? (
          <div className="flex items-center justify-center">
            <div className={`w-3 h-3 rounded-full ${c.dot}`} />
          </div>
        ) : (
          <div className="flex items-center">
            <div className={`w-3 h-3 rounded-full shrink-0 ${c.dot}`} />
            <div className={`flex-1 h-px ${c.line}`} />
            <div className={`w-3 h-3 rounded-full shrink-0 ${c.dot}`} />
          </div>
        )}
      </td>,
    )
    const remaining = totalWeeks - colStart - colSpan
    if (remaining > 0) {
      cells.push(<td key="post" colSpan={remaining} />)
    }
  }

  return (
    <tr>
      <td className="border-r border-[#2a3040] px-3 py-1.5 text-left text-[12px] text-text-dim bg-[#0e1119] whitespace-nowrap">
        <span className={c.text}>{c.label}</span>
      </td>
      {cells}
    </tr>
  )
}

// ── 版本層級資訊（危境重構 / 邊境商店等）────────────────────────────────────────

function VersionLevelInfo({ version }: { version: PatchVersion }) {
  const hasExtra = !!(
    version.crisisShop?.length ||
    version.memoryStorm ||
    version.borderShop ||
    version.arenaShop ||
    version.notes
  )
  if (!hasExtra) return null

  return (
    <div className="mt-3 pt-3 border-t border-border/40 space-y-0.5">
      {version.crisisShop?.length ? (
        <PatchInfoRow icon="🏪" label="危境重構" items={version.crisisShop} color="purple" />
      ) : null}
      {version.memoryStorm ? (
        <PatchInfoRow icon="🌀" label="記憶風暴" items={[version.memoryStorm]} color="cyan" />
      ) : null}
      {version.borderShop ? (
        <PatchInfoRow icon="🛒" label="邊境商店" items={[version.borderShop]} color="yellow" />
      ) : null}
      {version.arenaShop ? (
        <PatchInfoRow icon="🏆" label="鬥技場" items={[version.arenaShop]} color="orange" />
      ) : null}
      {version.notes ? (
        <PatchInfoRow icon="📝" label="備註" items={[version.notes]} color="blue" />
      ) : null}
    </div>
  )
}

// ── C-2: Main — VersionGanttPanel ─────────────────────────────────────────────

export default function VersionGanttPanel({ version }: { version: PatchVersion }) {
  const [side, setSide] = useState<'tw' | 'cn'>('tw')

  const { upperWeeks, lowerWeeks, allWeeks, upperActs, lowerActs, upperStartStr, lowerStartStr } =
    useMemo(() => {
      const upperStartStr =
        side === 'tw' ? (version.upper.twDate ?? '') : version.upper.cnDate
      const lowerStartStr =
        side === 'tw' ? (version.lower.twDate ?? '') : version.lower.cnDate
      const upperActs =
        (side === 'tw' ? version.upper.twActivities : version.upper.cnActivities) ?? []
      const lowerActs =
        (side === 'tw' ? version.lower.twActivities : version.lower.cnActivities) ?? []

      // Upper half ends at lowerStart (natural boundary — activities may span across via colSpan)
      const upperWeeks =
        upperStartStr && lowerStartStr
          ? generateWeeks(upperStartStr, lowerStartStr, [])
          : []
      const lowerWeeks = lowerStartStr
        ? generateWeeks(lowerStartStr, null, lowerActs)
        : []
      const allWeeks = [...upperWeeks, ...lowerWeeks]

      return { upperWeeks, lowerWeeks, allWeeks, upperActs, lowerActs, upperStartStr, lowerStartStr }
    }, [side, version])

  const totalWeeks = allWeeks.length
  const upperCount = upperWeeks.length
  const lowerCount = lowerWeeks.length
  const allActs = [...upperActs, ...lowerActs]

  const upperLabel = upperStartStr ? fmtShort(parseDate(upperStartStr)) : '—'
  const lowerLabel = lowerStartStr ? fmtShort(parseDate(lowerStartStr)) : '—'

  return (
    <div>
      {/* C-2: 切換按鈕 */}
      <div className="flex justify-end mb-2">
        <button
          onClick={() => setSide(s => (s === 'tw' ? 'cn' : 'tw'))}
          className="px-3 py-1.5 text-[13px] rounded border border-accent-purple/50 bg-accent-purple/10 text-accent-purple hover:bg-accent-purple/20 transition-colors font-medium tracking-wide"
        >
          {side === 'tw' ? '台版' : '陸版'} ⇄ {side === 'tw' ? '切換陸版' : '切換台版'}
        </button>
      </div>

      {/* C-3 + C-4 + C-5: 甘特表格 */}
      <div className="overflow-x-auto">
        <table
          className="border-collapse text-[13px] w-full"
          style={{
            minWidth: `${110 + Math.max(totalWeeks, 6) * 80}px`,
            tableLayout: 'fixed',
          }}
        >
          <colgroup>
            <col style={{ width: '110px', minWidth: '110px' }} />
            {allWeeks.map((_, i) => (
              <col key={i} style={{ minWidth: '80px' }} />
            ))}
            {/* Placeholder cols when no dates */}
            {totalWeeks === 0 &&
              Array.from({ length: 6 }).map((_, i) => (
                <col key={i} style={{ minWidth: '80px' }} />
              ))}
          </colgroup>

          {/* C-3: 欄標題列 */}
          <thead>
            <tr>
              <th
                rowSpan={2}
                className={`${LABEL} text-[11px] text-center tracking-[2px] uppercase text-text-dim`}
              >
                {side === 'tw' ? '台版' : '陸版'}
              </th>
              {upperCount > 0 && (
                <th
                  colSpan={upperCount}
                  className={`${TH} bg-[rgba(255,107,43,0.08)] text-accent-orange text-[12px] font-[Orbitron,sans-serif] tracking-wide py-2`}
                >
                  上半版本
                  <span className="ml-1.5 text-[11px] opacity-70">{upperLabel}～</span>
                </th>
              )}
              {lowerCount > 0 && (
                <th
                  colSpan={lowerCount}
                  className={`${TH} bg-[rgba(6,182,212,0.08)] text-accent-cyan text-[12px] font-[Orbitron,sans-serif] tracking-wide py-2`}
                >
                  下半版本
                  <span className="ml-1.5 text-[11px] opacity-70">{lowerLabel}～</span>
                </th>
              )}
              {totalWeeks === 0 && (
                <th colSpan={6} className={`${TH} text-text-dim text-[12px]`}>
                  （{side === 'tw' ? '台版' : '陸版'}日期未定）
                </th>
              )}
            </tr>
            <tr>
              {allWeeks.map((week, i) => (
                <th
                  key={i}
                  className={`${TH} text-[11px] py-1.5 ${
                    i < upperCount ? 'bg-[#151a24]' : 'bg-[#0e1820]'
                  }`}
                >
                  <div className="text-text-dim">第{i + 1}週</div>
                  <div className={i < upperCount ? 'text-accent-orange/70' : 'text-accent-cyan/70'}>
                    {fmtShort(week)}
                  </div>
                </th>
              ))}
              {totalWeeks === 0 &&
                Array.from({ length: 6 }).map((_, i) => (
                  <th key={i} className={`${TH} bg-[#151a24]`} />
                ))}
            </tr>
          </thead>

          <tbody>
            {/* C-4: 版本內容行 */}
            {totalWeeks > 0 && (
              <VersionInfoRows
                upper={version.upper}
                lower={version.lower}
                upperCount={upperCount}
                lowerCount={lowerCount}
                totalWeeks={totalWeeks}
              />
            )}

            {/* C-5: 活動甘特條行 */}
            {allActs.map((act, i) => (
              <ActivityGanttRow key={i} act={act} allWeeks={allWeeks} totalWeeks={totalWeeks} />
            ))}

            {/* 無資料時的提示列 */}
            {totalWeeks > 0 && allActs.length === 0 && (
              <tr>
                <td className={LABEL} />
                <td
                  colSpan={totalWeeks}
                  className={`${TD} text-text-dim text-[10px] py-2`}
                >
                  （暫無活動甘特資料）
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <VersionLevelInfo version={version} />
    </div>
  )
}

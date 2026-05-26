import type { PatchVersion } from '../../data/patchVersions'

function getUpperUpdate(v: PatchVersion) {
  const parts: string[] = []
  if (v.upper.pilots?.length) parts.push(...v.upper.pilots)
  if (v.upper.mechs?.length) parts.push(...v.upper.mechs)
  return parts
}

function getLowerUpdate(v: PatchVersion) {
  const parts: string[] = []
  if (v.lower.pilots?.length) parts.push(...v.lower.pilots)
  if (v.lower.mechs?.length) parts.push(...v.lower.mechs)
  return parts
}

function getArmamentWeapons(v: PatchVersion) {
  const results: string[] = []
  for (const half of [v.upper, v.lower]) {
    for (const r of half.armamentRaids ?? []) {
      if (r.weapons?.length) results.push(`${r.name}:${r.weapons.join('/')}`)
    }
  }
  return results
}

function getArmamentBackpacks(v: PatchVersion) {
  const results: string[] = []
  for (const half of [v.upper, v.lower]) {
    for (const r of half.armamentRaids ?? []) {
      if (r.backpacks?.length) results.push(`${r.name}:${r.backpacks.join('/')}`)
    }
  }
  return results
}

function getBattlePassPilots(v: PatchVersion) {
  const results: string[] = []
  for (const half of [v.upper, v.lower]) {
    if (half.battlePass?.pilots?.length) results.push(half.battlePass.pilots.join('/'))
  }
  return results
}

function getBattlePassMechs(v: PatchVersion) {
  const results: string[] = []
  for (const half of [v.upper, v.lower]) {
    if (half.battlePass?.mechs?.length) results.push(half.battlePass.mechs.join('/'))
  }
  return results
}

interface CellProps {
  items: string[]
  isPredicted?: boolean
  isCurrent?: boolean
}

function Cell({ items, isPredicted, isCurrent }: CellProps) {
  if (!items.length) return <td className="px-3 py-2 text-center text-text-dim/30 text-xs border-r border-border">—</td>
  return (
    <td className={`px-3 py-2 border-r border-border align-top ${isCurrent ? 'bg-accent-green/5' : ''}`}>
      <div className="flex flex-col gap-1">
        {items.map((item, i) => (
          <span
            key={i}
            className={`text-[11px] leading-tight whitespace-nowrap ${isPredicted ? 'text-accent-cyan' : 'text-text-secondary'}`}
          >
            {item}
          </span>
        ))}
      </div>
    </td>
  )
}

const ROW_DEFS = [
  { key: 'upper',    label: '上半更新',  fn: getUpperUpdate },
  { key: 'lower',    label: '下半更新',  fn: getLowerUpdate },
  { key: 'weapons',  label: '武裝生產',  fn: getArmamentWeapons },
  { key: 'backpack', label: '背包製作',  fn: getArmamentBackpacks },
  { key: 'bpPilot',  label: '角色戰令',  fn: getBattlePassPilots },
  { key: 'bpMech',   label: '機甲戰令',  fn: getBattlePassMechs },
  {
    key: 'crisis',
    label: '危境重構',
    fn: (v: PatchVersion) => v.crisisShop ?? [],
  },
  {
    key: 'border',
    label: '邊境商店',
    fn: (v: PatchVersion) => v.borderShop ? [v.borderShop] : [],
  },
  {
    key: 'arena',
    label: '鬥技場',
    fn: (v: PatchVersion) => v.arenaShop ? [v.arenaShop] : [],
  },
] as const

interface Props {
  versions: PatchVersion[]
  loading: boolean
  error: Error | null
}

export default function VersionQuickTable({ versions, loading, error }: Props) {
  return (
    <div className="bg-bg-dark/10 rounded-2xl p-4 backdrop-blur-sm">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[10px] font-bold tracking-[3px] text-accent-orange uppercase font-[Orbitron,sans-serif]">
          Quick Table
        </span>
        {loading && <span className="text-[9px] text-text-dim animate-pulse">同步中…</span>}
        <div className="h-px flex-1 bg-border" />
      </div>

      {error && (
        <p className="text-[11px] text-accent-yellow mb-2">⚠ 無法連線 Firestore，顯示本地資料</p>
      )}

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full border-collapse text-sm" style={{ minWidth: '640px' }}>
          <thead>
            <tr className="border-b border-border">
              {/* Sticky category header */}
              <th className="sticky left-0 z-10 bg-bg-dark px-3 py-2.5 text-left text-[10px] font-bold tracking-[2px] text-accent-orange uppercase font-[Orbitron,sans-serif] border-r border-border whitespace-nowrap w-20">
                類別
              </th>
              {versions.map(v => {
                const isCurrent = v.isTwCurrent
                const isPredicted = v.upper.twIsPredicted && !isCurrent
                const twDate = v.upper.twDate?.replace('約 ', '') ?? '—'
                return (
                  <th
                    key={v.version}
                    className={`px-3 py-2.5 text-center border-r border-border whitespace-nowrap ${
                      isCurrent
                        ? 'bg-accent-green/8 text-accent-green'
                        : isPredicted
                        ? 'text-accent-cyan'
                        : 'text-text-secondary'
                    }`}
                  >
                    <div className="text-[11px] font-bold font-[Orbitron,sans-serif] tracking-wide">
                      v{v.version}{isCurrent ? ' ★' : ''}
                    </div>
                    <div className="text-[10px] font-normal mt-0.5 opacity-80">
                      {twDate}
                    </div>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {ROW_DEFS.map((row, rowIdx) => (
              <tr key={row.key} className={rowIdx % 2 === 1 ? 'bg-bg-card/30' : ''}>
                {/* Sticky label column */}
                <td className="sticky left-0 z-10 bg-bg-dark px-3 py-2 text-[11px] text-text-dim font-medium border-r border-border whitespace-nowrap">
                  {row.label}
                </td>
                {versions.map(v => {
                  const isCurrent = v.isTwCurrent ?? false
                  const isPredicted = !isCurrent && (v.upper.twIsPredicted || v.lower.twIsPredicted)
                  const items = row.fn(v)
                  return (
                    <Cell
                      key={v.version}
                      items={items}
                      isPredicted={isPredicted}
                      isCurrent={isCurrent}
                    />
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[10px] text-text-dim mt-1.5 text-right">
        <span className="text-accent-cyan">■</span> 預測值
        <span className="text-accent-green">■</span> 台服當前
      </p>
    </div>
  )
}

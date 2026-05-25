import { GRAY_OPS_BASE, type GrayOpsCompany, type PatchVersion } from '../../data/patchVersions'

const COMPANIES: GrayOpsCompany[] = ['武裝工坊', '創新動力', 'GeekX', '火花塞']

interface MechEntry {
  name: string
  version?: string
}

function buildRoster(versions: PatchVersion[]): Record<GrayOpsCompany, MechEntry[]> {
  const roster = {} as Record<GrayOpsCompany, MechEntry[]>

  for (const company of COMPANIES) {
    roster[company] = GRAY_OPS_BASE[company].map(name => ({ name }))
  }

  for (const v of versions) {
    for (const update of v.grayOpsUpdates ?? []) {
      for (const mech of update.newMechs) {
        roster[update.company].push({ name: mech, version: v.version })
      }
    }
  }

  return roster
}

const COMPANY_COLORS: Record<GrayOpsCompany, string> = {
  '武裝工坊': 'text-accent-orange border-accent-orange/30 bg-accent-orange/5',
  '創新動力': 'text-accent-blue border-accent-blue/30 bg-accent-blue/5',
  'GeekX':    'text-accent-cyan border-accent-cyan/30 bg-accent-cyan/5',
  '火花塞':   'text-accent-yellow border-accent-yellow/30 bg-accent-yellow/5',
}

interface Props {
  versions: PatchVersion[]
  loading: boolean
}

export default function GrayOpsPanel({ versions, loading }: Props) {
  const ROSTER = buildRoster(versions)

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[10px] font-bold tracking-[3px] text-accent-orange uppercase font-[Orbitron,sans-serif]">
          Gray Ops
        </span>
        {loading && <span className="text-[9px] text-text-dim animate-pulse">同步中…</span>}
        <div className="h-px flex-1 bg-border" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {COMPANIES.map(company => (
          <div
            key={company}
            className={`rounded-xl border p-3 ${COMPANY_COLORS[company]}`}
          >
            <div className="text-[11px] font-bold tracking-wide mb-2 pb-1.5 border-b border-current/20">
              {company}
            </div>
            <div className="flex flex-col gap-1">
              {ROSTER[company]?.map((entry, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <span className="text-[11px] text-text-secondary leading-tight">
                    {entry.name}
                  </span>
                  {entry.version && (
                    <span className="text-[9px] text-accent-cyan border border-accent-cyan/30 px-1 rounded leading-tight shrink-0">
                      {entry.version}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

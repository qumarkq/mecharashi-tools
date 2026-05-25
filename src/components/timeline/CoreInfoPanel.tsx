import type { PatchVersion, PatchHalf } from '../../data/patchVersions/types'
import PatchInfoRow from './PatchInfoRow'

interface Props {
  version: PatchVersion
}

function DateRow({ label, date, predicted }: { label: string; date?: string; predicted?: boolean }) {
  if (!date) return null
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-[9px] text-text-dim tracking-wide shrink-0">{label}</span>
      <span className={`text-[11px] font-medium ${predicted ? 'text-accent-cyan' : 'text-text-secondary'}`}>
        {date}
        {predicted && (
          <span className="ml-1 text-[8px] border border-accent-cyan/40 text-accent-cyan px-1 rounded">預測</span>
        )}
      </span>
    </div>
  )
}

function HalfCore({ half, label }: { half: PatchHalf; label: '上半' | '下半' }) {
  const weaponRows = (half.armamentRaids ?? [])
    .filter(r => r.weapons?.length)
    .map(r => `${r.name}：${r.weapons!.join('/')}`)

  const backpackRows = (half.armamentRaids ?? [])
    .filter(r => r.backpacks?.length)
    .map(r => `${r.name}：${r.backpacks!.join('/')}`)

  return (
    <div>
      <div className="text-[9px] tracking-[2px] text-text-dim uppercase font-[Orbitron,sans-serif] mb-1.5">
        {label}
      </div>
      <div className="space-y-0.5">
        <PatchInfoRow icon="👤" label="角色"   items={half.pilots ?? []}          color="blue" />
        <PatchInfoRow icon="🤖" label="機甲"   items={half.mechs ?? []}           color="orange" />
        <PatchInfoRow icon="🎯" label="角雕特遣" items={half.pilotSelection ?? []} color="purple" />
        <PatchInfoRow icon="🚢" label="跨域海運" items={half.mechSelection ?? []}  color="cyan" />
        <PatchInfoRow icon="⚔️" label="武裝討伐" items={weaponRows}               color="yellow" />
        <PatchInfoRow icon="🎒" label="背包製作" items={backpackRows}              color="green" />
        {half.battlePass && (
          <>
            <PatchInfoRow icon="📜" label="角色戰令" items={half.battlePass.pilots ?? []} color="purple" />
            <PatchInfoRow icon="📜" label="機甲戰令" items={half.battlePass.mechs ?? []}  color="orange" />
          </>
        )}
      </div>
    </div>
  )
}

export default function CoreInfoPanel({ version }: Props) {
  return (
    <div className="space-y-2">
      {/* Date summary */}
      <div className="space-y-0.5 pb-2 border-b border-border/50">
        <DateRow label="陸上" date={version.upper.cnDate} />
        <DateRow label="陸下" date={version.lower.cnDate} />
        <DateRow label="台上" date={version.upper.twDate} predicted={version.upper.twIsPredicted} />
        <DateRow label="台下" date={version.lower.twDate} predicted={version.lower.twIsPredicted} />
      </div>

      {/* Upper half core */}
      <HalfCore half={version.upper} label="上半" />

      <div className="border-t border-border/50" />

      {/* Lower half core */}
      <HalfCore half={version.lower} label="下半" />

      {/* Version-level fields */}
      {(version.crisisShop?.length || version.memoryStorm || version.borderShop || version.arenaShop || version.notes) && (
        <div className="pt-2 border-t border-border/50 space-y-0.5">
          {version.crisisShop && version.crisisShop.length > 0 && (
            <PatchInfoRow icon="🏪" label="危境重構" items={version.crisisShop} color="purple" />
          )}
          {version.memoryStorm && (
            <PatchInfoRow icon="🌀" label="記憶風暴" items={[version.memoryStorm]} color="cyan" />
          )}
          {version.borderShop && (
            <PatchInfoRow icon="🛒" label="邊境商店" items={[version.borderShop]} color="yellow" />
          )}
          {version.arenaShop && (
            <PatchInfoRow icon="🏆" label="鬥技場" items={[version.arenaShop]} color="orange" />
          )}
          {version.notes && (
            <PatchInfoRow icon="📝" label="備註" items={[version.notes]} color="blue" />
          )}
        </div>
      )}
    </div>
  )
}

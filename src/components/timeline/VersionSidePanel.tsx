import type { PatchVersion, PatchHalf } from '../../data/patchVersions'
import PatchInfoRow from './PatchInfoRow'

interface Props {
  version: PatchVersion
  side: 'cn' | 'tw'
}

function HalfSection({
  half,
  label,
  side,
}: {
  half: PatchHalf
  label: '上半' | '下半'
  side: 'cn' | 'tw'
}) {
  const date = side === 'cn' ? half.cnDate : half.twDate
  const isPredicted = side === 'tw' && half.twIsPredicted

  const allArmamentWeapons = (half.armamentRaids ?? [])
    .filter(r => r.weapons && r.weapons.length > 0)
    .map(r => `${r.name}:${r.weapons!.join('/')}`)

  const allArmamentBackpacks = (half.armamentRaids ?? [])
    .filter(r => r.backpacks && r.backpacks.length > 0)
    .map(r => `${r.name}:${r.backpacks!.join('/')}`)

  return (
    <div className="mb-3">
      {/* Half header */}
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-[10px] font-semibold tracking-[2px] text-text-dim uppercase font-[Orbitron,sans-serif]">
          {label}
        </span>
        {date ? (
          <span className={`text-[11px] font-medium ${isPredicted ? 'text-accent-cyan' : 'text-text-secondary'}`}>
            {date}
            {isPredicted && <span className="ml-1 text-[9px] border border-accent-cyan/40 text-accent-cyan px-1 rounded">預測</span>}
          </span>
        ) : (
          <span className="text-[11px] text-text-dim">—</span>
        )}
      </div>

      <div className="space-y-0.5 pl-0">
        <PatchInfoRow icon="👤" label="角色" items={half.pilots ?? []} color="blue" />
        <PatchInfoRow icon="🤖" label="機甲" items={half.mechs ?? []} color="orange" />
        <PatchInfoRow icon="🎯" label="角雕特遣" items={half.pilotSelection ?? []} color="purple" />
        <PatchInfoRow icon="🚢" label="跨域海運" items={half.mechSelection ?? []} color="cyan" />
        <PatchInfoRow icon="⚔️" label="武裝討伐" items={allArmamentWeapons} color="yellow" />
        <PatchInfoRow icon="🎒" label="背包製作" items={allArmamentBackpacks} color="green" />
        {half.battlePass && (
          <>
            <PatchInfoRow icon="📜" label="角色戰令" items={half.battlePass.pilots ?? []} color="purple" />
            <PatchInfoRow icon="📜" label="機甲戰令" items={half.battlePass.mechs ?? []} color="orange" />
          </>
        )}
        {half.skinGacha && (
          <PatchInfoRow icon="🎰" label="刮刮樂" items={[half.skinGacha]} color="purple" />
        )}
        {half.rouletteEvent && (
          <PatchInfoRow icon="⭐" label="角雕輪盤" items={['末週活動']} color="yellow" />
        )}
        <PatchInfoRow icon="🔄" label="復刻卡池" items={half.revivedBanners ?? []} color="cyan" />
        <PatchInfoRow icon="📅" label="限時活動" items={half.specialEvents ?? []} color="blue" />
      </div>
    </div>
  )
}

export default function VersionSidePanel({ version, side }: Props) {
  const isTw = side === 'tw'
  const label = isTw ? '台服' : '陸服'
  const accentClass = isTw ? 'text-accent-green' : 'text-text-secondary'
  const borderClass = isTw ? 'border-accent-green/30' : 'border-border'

  return (
    <div className={`p-3 rounded-xl border bg-bg-dark/75 backdrop-blur-md ${borderClass}`}>
      {/* Side header */}
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border">
        <span className={`text-xs font-bold tracking-[3px] uppercase font-[Orbitron,sans-serif] ${accentClass}`}>
          {label}
        </span>
        {isTw && version.isTwCurrent && (
          <span className="text-[10px] bg-accent-green/10 text-accent-green border border-accent-green/30 px-1.5 py-0.5 rounded">
            ★ 當前版本
          </span>
        )}
      </div>

      <HalfSection half={version.upper} label="上半" side={side} />
      <div className="border-t border-border/50 my-2" />
      <HalfSection half={version.lower} label="下半" side={side} />

      {/* Version-level fields (TW side only to avoid duplication) */}
      {isTw && (
        <div className="mt-2 pt-2 border-t border-border/50 space-y-0.5">
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

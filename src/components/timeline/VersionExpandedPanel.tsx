import type { PatchVersion } from '../../data/patchVersions'
import VersionGanttPanel from './VersionGanttPanel'

interface Props {
  version: PatchVersion
  isExpanded: boolean
}

export default function VersionExpandedPanel({ version, isExpanded }: Props) {
  const bannerSrc = version.bannerImage
    ? `${import.meta.env.BASE_URL}${version.bannerImage.replace(/^\//, '')}`
    : null

  return (
    <div
      className="overflow-hidden transition-all duration-300 ease-in-out"
      style={{ maxHeight: isExpanded ? '4000px' : '0', opacity: isExpanded ? 1 : 0 }}
    >
      <div className="relative rounded-xl overflow-hidden">

        {/* ── Background layer ── */}
        <div className="absolute inset-0 pointer-events-none select-none">
          <div className="absolute inset-0 bg-gradient-to-br from-bg-card/30 to-bg-card-hover/60" />
          {bannerSrc && (
            <img
              src={bannerSrc}
              alt=""
              className="absolute inset-0 w-full h-full object-cover object-top opacity-80"
              draggable={false}
              onError={(e) => { e.currentTarget.style.display = 'none' }}
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-bg-dark/20 via-bg-dark/35 to-bg-dark/65" />
        </div>

        {/* ── Version badge ── */}
        <div className="absolute top-3 right-3 z-10">
          <div className="bg-bg-dark/10 backdrop-blur-sm border border-border/60 px-2 py-1 rounded-lg">
            <span className="text-xs font-bold text-accent-orange font-[Orbitron,sans-serif] tracking-wide">
              v{version.version}{version.name ? ` ${version.name}` : ''}
            </span>
          </div>
        </div>

        {version.isTwCurrent && (
          <div className="absolute top-3 left-3 z-10">
            <div className="text-[10px] bg-accent-green/10 text-accent-green border border-accent-green/30 px-1.5 py-0.5 rounded">
              ★ 台服當前版本
            </div>
          </div>
        )}

        <div className="relative z-10 pt-10 pb-3 px-3">
          <div className="p-3 rounded-xl border border-border bg-bg-dark/45 backdrop-blur-md">
            <VersionGanttPanel version={version} />
          </div>
        </div>

      </div>
    </div>
  )
}

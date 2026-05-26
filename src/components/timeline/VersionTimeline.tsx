import { useState, useRef } from 'react'
import { flushSync } from 'react-dom'
import type { PatchVersion } from '../../data/patchVersions'
import VersionDot from './VersionDot'
import VersionDetailView from './VersionDetailView'

interface Props {
  versions: PatchVersion[]
  loading: boolean
}

export default function VersionTimeline({ versions, loading }: Props) {
  const [mode, setMode] = useState<'timeline' | 'detail'>('timeline')
  const [activeIndex, setActiveIndex] = useState(0)
  const [origin, setOrigin] = useState({ x: 0, y: 0 })
  const [clipOpen, setClipOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  function openDetail(idx: number, e: React.MouseEvent<HTMLButtonElement>) {
    const container = containerRef.current
    if (!container) return
    const br = e.currentTarget.getBoundingClientRect()
    const cr = container.getBoundingClientRect()

    // Commit the closed state + mode change in one synchronous flush
    // so the detail mounts with clip-path already at the small circle
    flushSync(() => {
      setOrigin({
        x: Math.round(br.left + br.width / 2 - cr.left),
        y: Math.round(br.top + br.height / 2 - cr.top),
      })
      setActiveIndex(idx)
      setClipOpen(false)
      setMode('detail')
    })

    // Two rAFs: first lets the browser paint the mounted-but-closed detail,
    // second starts the CSS transition to open
    requestAnimationFrame(() => requestAnimationFrame(() => setClipOpen(true)))
  }

  function closeDetail() {
    setClipOpen(false)
    setTimeout(() => setMode('timeline'), 460)
  }

  const currentVersion = versions.find(v => v.isTwCurrent)
  const currentBannerSrc = currentVersion?.bannerImage
    ? `${import.meta.env.BASE_URL}${currentVersion.bannerImage.replace(/^\//, '')}`
    : null

  const rows = versions.map((version, idx) => {
    const labelRight = idx % 2 === 0
    const isCurrent = version.isTwCurrent
    const isPredicted = !isCurrent && (version.upper.twIsPredicted || version.lower.twIsPredicted)

    const label = (
      <div className={labelRight ? 'text-left' : 'text-right'}>
        <div className={`text-sm md:text-base font-bold font-[Orbitron,sans-serif] leading-tight ${
          isCurrent ? 'text-accent-green' : isPredicted ? 'text-accent-cyan' : 'text-text-primary'
        }`}>
          v{version.version}
          {version.name && <span className="ml-1.5 font-semibold">{version.name}</span>}
        </div>
        <div className="text-[11px] md:text-[13px] text-text-dim mt-0.5 font-[JetBrains_Mono,monospace]">
          台 {version.upper.twDate ?? '—'}
        </div>
        {isCurrent && (
          <span className="inline-block mt-1 text-[9px] md:text-[11px] bg-accent-green/10 text-accent-green border border-accent-green/30 px-1.5 py-0.5 rounded">
            ★ 當前
          </span>
        )}
        {isPredicted && (
          <span className="inline-block mt-1 text-[9px] md:text-[11px] border border-accent-cyan/40 text-accent-cyan px-1 rounded">
            預測
          </span>
        )}
      </div>
    )

    return (
      <div key={version.version} className="relative flex items-center h-[95px] md:h-[110px] px-6">
        <div className="flex-1 flex justify-end pr-8 min-w-0">
          {!labelRight && label}
        </div>
        <VersionDot version={version} onExpand={(e) => openDetail(idx, e)} />
        <div className="flex-1 flex justify-start pl-8 min-w-0">
          {labelRight && label}
        </div>
      </div>
    )
  })

  return (
    <div>
      {/* Section header */}
      <div className="flex items-center gap-3 mb-2">
        <div className="h-px flex-1 bg-gradient-to-r from-transparent to-border" />
        <span className="text-xs font-bold tracking-[3px] text-accent-orange uppercase font-[Orbitron,sans-serif]">
          Version Timeline
        </span>
        <div className="h-px flex-1 bg-gradient-to-l from-transparent to-border" />
      </div>

      {/* Outer container: overflow-hidden required for clip-path to animate within bounds */}
      <div ref={containerRef} className="relative border border-border rounded-2xl overflow-hidden bg-bg-card min-h-[580px]">
        {/* Current TW version banner as subtle background */}
        {currentBannerSrc && (
          <div className="absolute inset-0 pointer-events-none select-none z-0">
            <img
              src={currentBannerSrc}
              alt=""
              className="absolute inset-0 w-full h-full object-cover object-top opacity-20"
              draggable={false}
              onError={(e) => { e.currentTarget.style.display = 'none' }}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-bg-card/40 via-bg-card/60 to-bg-card/90" />
          </div>
        )}

        {loading && (
          <div className="absolute top-0 left-0 right-0 h-0.5 z-20 overflow-hidden">
            <div className="h-full bg-accent-orange animate-pulse w-full opacity-60" />
          </div>
        )}

        {/* ── Timeline ── (stays in DOM to hold container height) */}
        <div className={`relative z-10 transition-opacity duration-200 ${mode !== 'timeline' ? 'opacity-0 pointer-events-none' : ''}`}>
          {/* Mobile: fixed-height scrollable */}
          <div className="md:hidden h-[560px] overflow-y-auto relative">
            <div
              className="absolute w-px bg-border/60 pointer-events-none"
              style={{ left: 'calc(50% - 0.5px)', top: '1rem', bottom: '1rem' }}
            />
            <div className="py-4">{rows}</div>
          </div>

          {/* PC: auto height, shows all versions */}
          <div className="hidden md:block relative">
            <div
              className="absolute w-px bg-border/60 pointer-events-none"
              style={{ left: 'calc(50% - 0.5px)', top: '1rem', bottom: '1rem' }}
            />
            <div className="py-4">{rows}</div>
          </div>
        </div>

        {/* ── Detail overlay ── clip-path circle animates from dot position */}
        {mode !== 'timeline' && (
          <div
            className="absolute inset-0 bg-bg-card/10 backdrop-blur-md"
            style={{
              clipPath: clipOpen
                ? `circle(200% at ${origin.x}px ${origin.y}px)`
                : `circle(22px at ${origin.x}px ${origin.y}px)`,
              transition: 'clip-path 0.45s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          >
            <VersionDetailView
              versions={versions}
              activeIndex={activeIndex}
              onNavigate={setActiveIndex}
              onClose={closeDetail}
            />
          </div>
        )}
      </div>
    </div>
  )
}

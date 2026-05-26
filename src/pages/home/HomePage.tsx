import { usePatchVersions } from '../../hooks/usePatchVersions'
import HomeTabPanel from '../../components/home/HomeTabPanel'

export default function HomePage() {
  const { data: versions, loading, error } = usePatchVersions()

  return (
    <div className="homepage-snap">

      {/* ── Page 1: Hero ── */}
      <section className="snap-page relative flex items-center overflow-hidden">
        {/* Left-to-right overlay: opaque on left for readability, fades to transparent on right */}
        <div className="absolute inset-0 bg-gradient-to-r from-bg-dark/85 via-bg-dark/50 lg:via-bg-dark/30 to-transparent pointer-events-none" />

        <div className="relative z-10 w-full max-w-[90vw] lg:max-w-[45vw] px-8 lg:px-16 flex flex-col gap-5">
          {/* Site name */}
          <div>
            <h1 className="font-[Orbitron,sans-serif] text-3xl sm:text-4xl lg:text-5xl font-black tracking-wider leading-tight bg-gradient-to-br from-white to-accent-orange bg-clip-text text-transparent">
              MECHARASHI<br />
              <span className="text-xl sm:text-2xl lg:text-3xl">
                Milhama PawInfo Station
              </span>
            </h1>
            <p className="mt-3 text-text-secondary text-base font-semibold tracking-[0.2em]">
              獾迎你的到來！
            </p>
          </div>

          {/* Feature summary */}
          <p className="text-text-dim text-sm leading-loose">
            機甲資料庫 · 機師資料庫 · 武器資料庫 · 傷害模擬器
          </p>

          {/* Scroll hint */}
          <div className="flex items-center gap-2 text-text-dim text-xs animate-bounce w-fit">
            <span>▼</span>
            <span className="tracking-widest">向下捲動看版本摘要</span>
          </div>
        </div>
      </section>

      {/* ── Page 2: Data Tab ── */}
      <section className="snap-page relative flex flex-col overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-bg-dark/90 via-bg-dark/60 lg:via-bg-dark/35 to-transparent pointer-events-none" />

        {/* Panel + copyright, constrained to left portion */}
        <div className="relative z-10 flex flex-col flex-1 min-h-0 w-full md:max-w-[70vw] lg:max-w-[48vw]">
          <HomeTabPanel versions={versions} loading={loading} error={error} />
          <div className="shrink-0 px-5 py-2 text-[11px] text-text-dim border-t border-border/50">
            米赫瑪超吉情豹站 — 非官方社群工具，與官方無關，無營利。99%圖片資源都來源於官方網站或WIKI
          </div>
        </div>
      </section>

    </div>
  )
}

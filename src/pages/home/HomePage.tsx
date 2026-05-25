import VersionQuickTable from '../../components/home/VersionQuickTable'
import GrayOpsPanel from '../../components/home/GrayOpsPanel'
import VersionTimeline from '../../components/timeline/VersionTimeline'
import { usePatchVersions } from '../../hooks/usePatchVersions'

export default function HomePage() {
  const { data: versions, loading, error } = usePatchVersions()

  return (
    <div>
      {/* ── 上方雙欄：版本濃縮資訊表 + 灰燼行動參考 ── */}
      <section className="border-b border-border px-4 py-8">
        <div className="max-w-7xl mx-auto grid grid-cols-1 xl:grid-cols-[3fr_2fr] gap-6">
          <VersionQuickTable versions={versions} loading={loading} error={error} />
          <GrayOpsPanel versions={versions} loading={loading} />
        </div>
      </section>

      {/* ── 版本時間線 ── */}
      <section className="px-4 py-8">
        <div className="max-w-5xl mx-auto">
          <VersionTimeline versions={versions} loading={loading} />
        </div>
      </section>

      {/* ── 原 Hero / Welcome（縮版，移至底部） ── */}
      <section className="border-t border-border px-6 py-12 text-center">
        <div className="relative max-w-xl mx-auto">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,rgba(255,107,43,0.07)_0%,transparent_70%)]" />
          <div className="relative z-10 flex flex-col items-center gap-6">
            <img
              src={`${import.meta.env.BASE_URL}images/cat_no_bg.png`}
              alt="吉祥物"
              className="w-28 object-contain pointer-events-none opacity-80"
            />
            <div>
              <h2 className="text-2xl font-black tracking-wider bg-gradient-to-br from-white to-accent-orange bg-clip-text text-transparent font-[Orbitron,sans-serif] mb-2">
                獾迎！
              </h2>
              <p className="text-text-secondary text-sm leading-loose">
                傷害模擬器 · 配裝計算器 · 角色資料庫 · 機甲資料庫 · 模組資料庫 · 武器資料庫
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

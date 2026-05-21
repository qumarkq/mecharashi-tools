export default function HomePage() {
  return (
    <div>
      {/* Hero Section */}
      <section className="relative py-16 px-6 text-center border-b border-border">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,rgba(255,107,43,0.12)_0%,transparent_60%)]" />
        <div className="relative z-10 flex flex-col items-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 border border-accent-orange rounded-full text-xs text-accent-orange tracking-[3px] uppercase mb-6 bg-accent-orange/5">
            ◆ COMMUNITY TOOLKIT
          </div>
          <h1 className="text-4xl md:text-6xl font-black tracking-wider bg-gradient-to-br from-white to-accent-orange bg-clip-text text-transparent font-[Orbitron,sans-serif]">
            獾迎！
          </h1>
          <img
            src={`${import.meta.env.BASE_URL}images/cat_no_bg.png`}
            alt="吉祥物"
            className="w-52 md:w-64 object-contain pointer-events-none"
          />
          <p className="text-text-secondary text-base md:text-lg max-w-2xl mx-auto mt-6 leading-relaxed">
            傷害模擬器(沒做完) · 配裝計算器(沒做完) · 角色資料庫 · 機甲資料庫 · 模組資料庫 · 武器資料庫(沒做完) · 元件資料庫(沒做完) · 攻略百科(等你加入)
          </p>
        </div>
      </section>

      {/* Welcome Section */}
      <section className="max-w-xl mx-auto px-4 py-16 flex flex-col items-center gap-10">

        {/* Welcome card */}
        <div className="relative w-full group">
          {/* Ambient glow */}
          <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-accent-orange/25 via-accent-purple/15 to-accent-orange/25 blur-xl opacity-50 group-hover:opacity-80 transition-opacity duration-700" />
          <div className="relative bg-bg-card border border-border-accent rounded-2xl overflow-hidden">
            {/* Top accent bar */}
            <div className="h-0.5 bg-gradient-to-r from-transparent via-accent-orange to-transparent" />
            <div className="px-6 py-8 sm:px-10 sm:py-10 text-center">
              <p className="text-2xl md:text-3xl font-bold text-text-primary leading-relaxed mb-5">
                你的到來真是讓人獾天喜地！
              </p>
              <p className="text-text-secondary text-base leading-loose">
                因為是免費的，所以關於使用者的提議<br />
                我們都會仔細聆聽...吧？
              </p>
              {/* Divider dots */}
              <div className="mt-8 flex items-center justify-center gap-2">
                <div className="h-px w-20 bg-gradient-to-r from-transparent to-border-accent" />
                <div className="w-1.5 h-1.5 rounded-full bg-accent-orange" />
                <div className="h-px w-20 bg-gradient-to-l from-transparent to-border-accent" />
              </div>
            </div>
            {/* Bottom accent bar */}
            <div className="h-0.5 bg-gradient-to-r from-transparent via-accent-orange to-transparent" />
          </div>
        </div>

        {/* Sticker badge */}
        <div
          className="select-none shadow-2xl"
          style={{ transform: 'rotate(-1.5deg)' }}
        >
          <div className="rounded-lg overflow-hidden border-2 border-gray-600 w-52 ring-4 ring-gray-900">
            <div className="bg-[#1a1a1a] text-white text-center text-xl font-black py-4 tracking-[0.4em]">
              意見接受
            </div>
            <div className="bg-yellow-400 text-gray-900 text-center text-xl font-black py-4 tracking-[0.4em]">
              態度依舊
            </div>
          </div>
        </div>

      </section>
    </div>
  )
}

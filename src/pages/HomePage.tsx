import { Link } from 'react-router-dom'

const quickLinks = [
  { to: '/pilots', label: '機師圖鑑', icon: '👤', desc: '查看所有機師資料與六維屬性', color: 'accent-cyan' },
  { to: '/mechs', label: '機甲圖鑑', icon: '🤖', desc: '瀏覽機甲部件與模組配置', color: 'accent-green' },
  { to: '/weapons', label: '武器圖鑑', icon: '🔫', desc: '武器技能、元件插槽與改裝', color: 'accent-purple' },
  { to: '/backpacks', label: '背包圖鑑', icon: '🎒', desc: '背包效果與裝配限制', color: 'accent-pink' },
  { to: '/simulator', label: '配裝模擬器', icon: '⚔️', desc: '傷害計算與 A/B 對比', color: 'accent-orange' },
  { to: '/research', label: '科研設定', icon: '🔬', desc: '配置你的全域科研等級', color: 'accent-blue' },
]

export default function HomePage() {
  return (
    <div>
      {/* Hero Section */}
      <section className="relative py-20 px-6 text-center border-b border-border">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,rgba(255,107,43,0.12)_0%,transparent_60%)]" />
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 border border-accent-orange rounded-full text-xs text-accent-orange tracking-[3px] uppercase mb-8 bg-accent-orange/5">
            ◆ COMMUNITY TOOLKIT
          </div>
          <h1 className="text-4xl md:text-6xl font-black tracking-wider mb-4 bg-gradient-to-br from-white to-accent-orange bg-clip-text text-transparent font-[Orbitron,sans-serif]">
            鋼嵐工具站
          </h1>
          <p className="text-text-secondary text-lg max-w-xl mx-auto">
            傷害模擬器 · 配裝計算器 · 角色資料庫 · 攻略百科
          </p>
        </div>
      </section>

      {/* Quick Links */}
      <section className="max-w-6xl mx-auto px-4 py-16">
        <h2 className="text-2xl font-bold mb-8">快速入口</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {quickLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="group block bg-bg-card border border-border rounded-xl p-6 no-underline transition-all hover:bg-bg-card-hover hover:border-border-accent hover:-translate-y-0.5"
            >
              <div className="text-3xl mb-3">{link.icon}</div>
              <h3 className="text-base font-bold text-text-primary mb-1">{link.label}</h3>
              <p className="text-sm text-text-dim">{link.desc}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}

import { Outlet, Link, NavLink } from 'react-router-dom'
import { useState } from 'react'

const navItems = [
  { to: '/', label: '首頁', icon: '🏠' },
  { to: '/pilots', label: '機師圖鑑', icon: '👤' },
  { to: '/mechs', label: '機甲圖鑑', icon: '🤖' },
  { to: '/weapons', label: '武器圖鑑', icon: '🔫' },
  { to: '/backpacks', label: '背包圖鑑', icon: '🎒' },
  { to: '/modules', label: '模組圖鑑', icon: '🧩' },
  { to: '/simulator', label: '配裝模擬器', icon: '⚔️' },
  { to: '/research', label: '科研設定', icon: '🔬' },
  { to: '/news', label: '改版資訊', icon: '📰' },
  { to: '/guides', label: '攻略專區', icon: '📚' },
]

export default function Layout() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-bg-dark/95 backdrop-blur border-b border-border">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 no-underline">
            <span className="text-accent-orange font-bold text-xl tracking-wider font-[Orbitron,sans-serif]">
              鋼嵐工具站
            </span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden lg:flex items-center gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `px-3 py-2 rounded-lg text-sm no-underline transition-colors ${
                    isActive
                      ? 'bg-accent-orange/10 text-accent-orange'
                      : 'text-text-secondary hover:text-text-primary hover:bg-bg-card'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          {/* Mobile Menu Button */}
          <button
            className="lg:hidden p-2 text-text-secondary hover:text-text-primary"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? '✕' : '☰'}
          </button>
        </div>

        {/* Mobile Nav */}
        {menuOpen && (
          <nav className="lg:hidden border-t border-border bg-bg-dark px-4 py-4 flex flex-col gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) =>
                  `px-4 py-2 rounded-lg text-sm no-underline transition-colors flex items-center gap-2 ${
                    isActive
                      ? 'bg-accent-orange/10 text-accent-orange'
                      : 'text-text-secondary hover:text-text-primary hover:bg-bg-card'
                  }`
                }
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-8 text-center text-text-dim text-sm">
        <p>鋼嵐工具站 — Mecharashi Community Toolkit</p>
        <p className="mt-1">本站為玩家社群工具，與官方無關</p>
      </footer>
    </div>
  )
}

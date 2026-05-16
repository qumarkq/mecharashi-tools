import { Outlet, Link, NavLink, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'

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
  const { user, userProfile, loading, signOut, openAuthModal } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/')
  }

  const initial = user?.displayName?.[0] ?? user?.email?.[0] ?? '?'

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-bg-dark/95 backdrop-blur border-b border-border">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2 no-underline shrink-0">
            <span className="text-accent-orange font-bold text-xl tracking-wider font-[Orbitron,sans-serif]">
              鋼嵐工具站
            </span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden lg:flex items-center gap-1 overflow-x-auto">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `px-3 py-2 rounded-lg text-sm no-underline transition-colors whitespace-nowrap ${
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

          {/* User area */}
          <div className="flex items-center gap-2 shrink-0">
            {!loading && (
              user ? (
                <div className="flex items-center gap-2">
                  <NavLink
                    to="/profile"
                    className={({ isActive }) =>
                      `w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border transition-colors no-underline ${
                        isActive
                          ? 'bg-accent-orange text-white border-accent-orange'
                          : 'bg-accent-orange/20 text-accent-orange border-accent-orange/40 hover:bg-accent-orange/30'
                      }`
                    }
                    title={user.displayName ?? user.email ?? '個人中心'}
                  >
                    {user.photoURL ? (
                      <img src={user.photoURL} alt="" className="w-8 h-8 rounded-full object-cover" />
                    ) : (
                      initial.toUpperCase()
                    )}
                  </NavLink>
                  <button
                    onClick={handleSignOut}
                    className="hidden lg:block text-xs text-text-dim hover:text-text-secondary transition-colors cursor-pointer"
                  >
                    登出
                  </button>
                </div>
              ) : (
                <button
                  onClick={openAuthModal}
                  className="px-3 py-1.5 text-xs bg-accent-orange/10 text-accent-orange border border-accent-orange/30 rounded-lg hover:bg-accent-orange/20 transition-colors cursor-pointer whitespace-nowrap"
                >
                  登入 / 註冊
                </button>
              )
            )}

            {/* Mobile Menu Button */}
            <button
              className="lg:hidden p-2 text-text-secondary hover:text-text-primary"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              {menuOpen ? '✕' : '☰'}
            </button>
          </div>
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
            <div className="border-t border-border mt-2 pt-2">
              {user ? (
                <>
                  <NavLink
                    to="/profile"
                    onClick={() => setMenuOpen(false)}
                    className={({ isActive }) =>
                      `px-4 py-2 rounded-lg text-sm no-underline transition-colors flex items-center gap-2 ${
                        isActive ? 'bg-accent-orange/10 text-accent-orange' : 'text-text-secondary hover:text-text-primary hover:bg-bg-card'
                      }`
                    }
                  >
                    <span>👤</span>
                    <span>{user.displayName ?? '個人中心'}</span>
                  </NavLink>
                  <button
                    onClick={() => { setMenuOpen(false); handleSignOut() }}
                    className="w-full text-left px-4 py-2 rounded-lg text-sm text-text-dim hover:text-text-primary hover:bg-bg-card transition-colors flex items-center gap-2 cursor-pointer"
                  >
                    <span>🚪</span>
                    <span>登出</span>
                  </button>
                </>
              ) : (
                <button
                  onClick={() => { setMenuOpen(false); openAuthModal() }}
                  className="w-full text-left px-4 py-2 rounded-lg text-sm text-accent-orange hover:bg-accent-orange/10 transition-colors flex items-center gap-2 cursor-pointer"
                >
                  <span>🔑</span>
                  <span>登入 / 註冊</span>
                </button>
              )}
            </div>
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
        <p className="mt-1">本站是氣吉敗壞的豹吉自己摸出來的，與官方無關，但99%圖片資源都來源於官方WIKI</p>
        <div className="mt-4 flex items-center justify-center gap-4">
          <NavLink
            to="/profile"
            className={({ isActive }) =>
              `text-xs no-underline transition-colors ${isActive ? 'text-accent-orange' : 'hover:text-text-secondary'}`
            }
          >
            👤 個人中心
          </NavLink>
          {userProfile?.role === 'ADMIN' && (
            <>
              <span className="text-border">|</span>
              <NavLink
                to="/admin"
                className={({ isActive }) =>
                  `text-xs no-underline transition-colors ${isActive ? 'text-accent-orange' : 'hover:text-text-secondary'}`
                }
              >
                🛠️ 管理後台
              </NavLink>
            </>
          )}
        </div>
      </footer>
    </div>
  )
}

import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'

interface Props {
  isOpen: boolean
  onClose: () => void
}

function parseFirebaseError(e: unknown): string {
  if (!(e instanceof Error)) return '操作失敗，請重試'
  const code = (e as { code?: string }).code
  switch (code) {
    case 'auth/email-already-in-use': return '此 Email 已被註冊'
    case 'auth/weak-password': return '密碼至少需要 6 個字元'
    case 'auth/invalid-email': return 'Email 格式不正確'
    case 'auth/user-not-found': return '找不到此帳號'
    case 'auth/wrong-password': return '密碼錯誤'
    case 'auth/invalid-credential': return 'Email 或密碼錯誤'
    case 'auth/too-many-requests': return '嘗試次數過多，請稍後再試'
    default: return e.message
  }
}

export default function AuthModal({ isOpen, onClose }: Props) {
  const { signIn, signInWithEmail, signUpWithEmail } = useAuth()
  const [tab, setTab] = useState<'google' | 'email'>('google')
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (!isOpen) return null

  function resetForm() {
    setEmail('')
    setPassword('')
    setConfirmPassword('')
    setDisplayName('')
    setError(null)
  }

  function switchTab(t: 'google' | 'email') {
    setTab(t)
    setError(null)
  }

  function switchMode(m: 'login' | 'register') {
    setMode(m)
    setError(null)
  }

  async function handleGoogle() {
    setSubmitting(true)
    setError(null)
    try {
      await signIn()
      onClose()
    } catch (e) {
      setError(parseFirebaseError(e))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (mode === 'register') {
      if (!displayName.trim()) { setError('請輸入顯示名稱'); return }
      if (password !== confirmPassword) { setError('兩次密碼不一致'); return }
    }
    setSubmitting(true)
    try {
      if (mode === 'register') {
        await signUpWithEmail(email, password, displayName.trim())
      } else {
        await signInWithEmail(email, password)
      }
      resetForm()
      onClose()
    } catch (e) {
      setError(parseFirebaseError(e))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-bg-card border border-border rounded-xl p-6 w-full max-w-sm shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold">登入 / 註冊</h2>
          <button
            onClick={onClose}
            className="text-text-dim hover:text-text-primary transition-colors text-lg leading-none"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-5">
          <button
            onClick={() => switchTab('google')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === 'google'
                ? 'bg-accent-orange text-black'
                : 'bg-bg-dark border border-border text-text-secondary hover:text-text-primary'
            }`}
          >
            Google
          </button>
          <button
            onClick={() => switchTab('email')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === 'email'
                ? 'bg-accent-orange text-black'
                : 'bg-bg-dark border border-border text-text-secondary hover:text-text-primary'
            }`}
          >
            Email
          </button>
        </div>

        {/* Google */}
        {tab === 'google' && (
          <div>
            <p className="text-xs text-text-dim mb-4 text-center">使用 Google 帳號快速登入</p>
            <button
              onClick={handleGoogle}
              disabled={submitting}
              className="w-full py-3 bg-white text-gray-800 rounded-lg font-medium hover:bg-gray-100 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
            >
              <span className="font-bold text-base leading-none" style={{ fontFamily: 'sans-serif' }}>G</span>
              使用 Google 帳號登入
            </button>
            {error && <p className="text-xs text-accent-red mt-3">{error}</p>}
          </div>
        )}

        {/* Email */}
        {tab === 'email' && (
          <div>
            {/* Login / Register toggle */}
            <div className="flex gap-1 mb-4 border-b border-border pb-3">
              <button
                onClick={() => switchMode('login')}
                className={`px-3 py-1 rounded-md text-xs transition-colors ${
                  mode === 'login'
                    ? 'text-accent-orange bg-accent-orange/10 font-medium'
                    : 'text-text-dim hover:text-text-secondary'
                }`}
              >
                已有帳號，直接登入
              </button>
              <button
                onClick={() => switchMode('register')}
                className={`px-3 py-1 rounded-md text-xs transition-colors ${
                  mode === 'register'
                    ? 'text-accent-orange bg-accent-orange/10 font-medium'
                    : 'text-text-dim hover:text-text-secondary'
                }`}
              >
                建立新帳號
              </button>
            </div>

            <form onSubmit={handleEmailSubmit} className="space-y-3">
              {mode === 'register' && (
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="顯示名稱"
                  required
                  autoComplete="nickname"
                  className="w-full px-3 py-2 rounded-lg bg-bg-dark border border-border text-text-primary text-sm focus:outline-none focus:border-accent-orange placeholder:text-text-dim"
                />
              )}
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                required
                autoComplete="email"
                className="w-full px-3 py-2 rounded-lg bg-bg-dark border border-border text-text-primary text-sm focus:outline-none focus:border-accent-orange placeholder:text-text-dim"
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="密碼（至少 6 個字元）"
                required
                minLength={6}
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                className="w-full px-3 py-2 rounded-lg bg-bg-dark border border-border text-text-primary text-sm focus:outline-none focus:border-accent-orange placeholder:text-text-dim"
              />
              {mode === 'register' && (
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="確認密碼"
                  required
                  autoComplete="new-password"
                  className="w-full px-3 py-2 rounded-lg bg-bg-dark border border-border text-text-primary text-sm focus:outline-none focus:border-accent-orange placeholder:text-text-dim"
                />
              )}

              {error && <p className="text-xs text-accent-red">{error}</p>}

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 bg-accent-orange text-black font-bold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 text-sm"
              >
                {submitting ? '處理中...' : mode === 'register' ? '建立帳號' : '登入'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}

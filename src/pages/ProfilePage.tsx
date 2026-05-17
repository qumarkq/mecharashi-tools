import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { getUserBuilds, deleteBuild } from '../lib/userApi'
import type { UserBuild } from '../types'

export default function ProfilePage() {
  const { user, loading, signOut, openAuthModal } = useAuth()
  const [builds, setBuilds] = useState<UserBuild[]>([])
  const [buildsLoading, setBuildsLoading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    setBuildsLoading(true)
    getUserBuilds(user.uid)
      .then(setBuilds)
      .catch(console.error)
      .finally(() => setBuildsLoading(false))
  }, [user])

  const handleDelete = async (buildId: string) => {
    if (!user || !confirm('確定要刪除此配裝？')) return
    setDeletingId(buildId)
    try {
      await deleteBuild(user.uid, buildId)
      setBuilds((prev) => prev.filter((b) => b.id !== buildId))
    } catch (e) {
      console.error(e)
    } finally {
      setDeletingId(null)
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="text-center py-20 text-text-dim">載入中...</div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="mb-8">
          <span className="text-xs text-accent-orange tracking-[3px] uppercase font-[Orbitron,sans-serif]">User</span>
          <h1 className="text-3xl font-bold mt-2">個人中心</h1>
        </div>
        <div className="bg-bg-card border border-border rounded-xl p-10 text-center">
          <div className="text-5xl mb-4">🔐</div>
          <h2 className="text-xl font-bold mb-2">請先登入</h2>
          <p className="text-text-dim text-sm mb-6">
            登入後可儲存配裝紀錄，以及管理個人資料。
          </p>
          <button
            onClick={openAuthModal}
            className="px-6 py-3 bg-accent-orange text-white rounded-xl font-medium hover:bg-accent-orange/80 transition-colors cursor-pointer"
          >
            登入 / 註冊
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="mb-8">
        <span className="text-xs text-accent-orange tracking-[3px] uppercase font-[Orbitron,sans-serif]">User</span>
        <h1 className="text-3xl font-bold mt-2">個人中心</h1>
      </div>

      {/* User info card */}
      <div className="bg-bg-card border border-border rounded-xl p-6 mb-6 flex items-center gap-5">
        {user.photoURL ? (
          <img src={user.photoURL} alt="" className="w-16 h-16 rounded-full object-cover border-2 border-accent-orange/30" />
        ) : (
          <div className="w-16 h-16 rounded-full bg-accent-orange/20 border-2 border-accent-orange/30 flex items-center justify-center text-2xl font-bold text-accent-orange">
            {(user.displayName?.[0] ?? user.email?.[0] ?? '?').toUpperCase()}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-lg font-bold truncate">{user.displayName ?? '用戶'}</div>
          <div className="text-sm text-text-dim truncate">{user.email}</div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            onClick={signOut}
            className="px-4 py-2 text-sm bg-bg-dark text-text-dim border border-border rounded-lg hover:text-text-primary hover:border-border-accent transition-colors cursor-pointer"
          >
            登出
          </button>
        </div>
      </div>

      {/* Builds list */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">我的配裝紀錄</h2>
          <Link
            to="/simulator"
            className="text-sm text-accent-orange no-underline hover:text-accent-orange/80 transition-colors"
          >
            + 新增配裝
          </Link>
        </div>

        {buildsLoading ? (
          <div className="bg-bg-card border border-border rounded-xl p-8 text-center text-text-dim">
            載入配裝中...
          </div>
        ) : builds.length === 0 ? (
          <div className="bg-bg-card border border-border rounded-xl p-8 text-center">
            <div className="text-3xl mb-3">📋</div>
            <p className="text-text-dim text-sm">尚無儲存的配裝</p>
            <Link
              to="/simulator"
              className="inline-block mt-4 px-4 py-2 text-sm bg-accent-orange/10 text-accent-orange border border-accent-orange/30 rounded-lg hover:bg-accent-orange/20 transition-colors no-underline"
            >
              前往配裝模擬器
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {builds.map((build) => (
              <BuildCard
                key={build.id}
                build={build}
                deleting={deletingId === build.id}
                onDelete={() => handleDelete(build.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function BuildCard({
  build,
  deleting,
  onDelete,
}: {
  build: UserBuild
  deleting: boolean
  onDelete: () => void
}) {
  const date = build.updatedAt
    ? new Date(build.updatedAt).toLocaleDateString('zh-TW', { year: 'numeric', month: 'short', day: 'numeric' })
    : '—'

  return (
    <div className="bg-bg-card border border-border rounded-xl p-4 flex items-start gap-4 hover:border-border-accent transition-colors">
      <div className="flex-1 min-w-0">
        <div className="font-bold text-base truncate">{build.buildName || '未命名配裝'}</div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5">
          {build.pilotId && (
            <span className="text-[11px] text-text-dim">
              機師: <span className="text-text-secondary">{build.pilotId.replace(/^pilot_\d+_/, '')}</span>
            </span>
          )}
          {build.mechId && (
            <span className="text-[11px] text-text-dim">
              機甲: <span className="text-text-secondary">{build.mechId.replace(/^mech_/, '')}</span>
            </span>
          )}
          {build.weaponId && (
            <span className="text-[11px] text-text-dim">
              武器: <span className="text-text-secondary">{build.weaponId}</span>
            </span>
          )}
        </div>
        <div className="text-[11px] text-text-dim mt-1.5">更新：{date}</div>
      </div>
      <button
        onClick={onDelete}
        disabled={deleting}
        className="shrink-0 p-2 text-text-dim hover:text-accent-red transition-colors cursor-pointer disabled:opacity-40"
        title="刪除配裝"
      >
        {deleting ? '...' : '🗑️'}
      </button>
    </div>
  )
}

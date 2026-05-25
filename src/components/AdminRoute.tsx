import { Navigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '../contexts/AuthContext'

export default function AdminRoute({ children }: { children: ReactNode }) {
  const { user, userProfile, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <p className="text-text-dim text-sm">驗證中...</p>
      </div>
    )
  }

  if (!user || (userProfile?.role !== 'ADMIN' && userProfile?.role !== 'OWNER')) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

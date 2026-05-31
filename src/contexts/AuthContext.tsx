import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { User } from 'firebase/auth'
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut as fbSignOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  updateProfile,
} from 'firebase/auth'
import { auth } from '../lib/firebase'
import { getUserProfile, initUserProfile, patchUserProfile } from '../lib/userApi'
import type { UserProfile } from '../types'
import AuthModal from '../components/AuthModal'

interface AuthContextValue {
  user: User | null
  userProfile: UserProfile | null
  loading: boolean
  signIn: () => Promise<void>
  signOut: () => Promise<void>
  signUpWithEmail: (email: string, password: string, displayName: string) => Promise<void>
  signInWithEmail: (email: string, password: string) => Promise<void>
  openAuthModal: () => void
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (cancelled) return
      setUser(u)
      if (u) {
        const profile = await initUserProfile(u.uid, {
          displayName: u.displayName ?? u.email ?? 'User',
          email: u.email ?? '',
          ...(u.photoURL ? { photoURL: u.photoURL } : {}),
        })
        if (!cancelled) {
          setUserProfile(profile)
          setLoading(false)
        }
      } else {
        if (!cancelled) {
          setUserProfile(null)
          setLoading(false)
        }
      }
    })
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  const signIn = async () => {
    await signInWithPopup(auth, new GoogleAuthProvider())
  }

  const signOut = async () => {
    await fbSignOut(auth)
  }

  const signUpWithEmail = async (email: string, password: string, displayName: string) => {
    const credential = await createUserWithEmailAndPassword(auth, email, password)
    await updateProfile(credential.user, { displayName })
    // 先確保 profile 文件存在（含 role: 'USER'），再 patch displayName
    // 若 onAuthStateChanged 搶先跑過 initUserProfile，這裡會直接跳過 create；
    // 後續 patchUserProfile 一律是 update（不觸發 create 規則的 role 檢查）
    await initUserProfile(credential.user.uid, {
      displayName,
      email: credential.user.email ?? '',
      ...(credential.user.photoURL ? { photoURL: credential.user.photoURL } : {}),
    })
    await patchUserProfile(credential.user.uid, { displayName })
    await sendEmailVerification(credential.user)
    // 寄出驗證信後登出，使用者必須點擊連結驗證後才能正式登入
    await fbSignOut(auth)
  }

  const signInWithEmail = async (email: string, password: string) => {
    const credential = await signInWithEmailAndPassword(auth, email, password)
    if (!credential.user.emailVerified) {
      await sendEmailVerification(credential.user)
      await fbSignOut(auth)
      throw Object.assign(new Error('auth/email-not-verified'), { code: 'auth/email-not-verified' })
    }
  }

  const openAuthModal = () => setModalOpen(true)

  const refreshProfile = async () => {
    if (!user) return
    const profile = await getUserProfile(user.uid)
    setUserProfile(profile)
  }

  return (
    <AuthContext.Provider
      value={{ user, userProfile, loading, signIn, signOut, signUpWithEmail, signInWithEmail, openAuthModal, refreshProfile }}
    >
      {children}
      <AuthModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

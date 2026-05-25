import { initializeApp, getApps } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'
import { getStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
}

// 避免 HMR 時重複初始化
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]

export const db      = getFirestore(app)
export const auth    = getAuth(app)
const storageBucket = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET
export const storage = getStorage(app, storageBucket ? `gs://${storageBucket}` : undefined)
export default app

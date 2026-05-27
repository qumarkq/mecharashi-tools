import { initializeApp, getApps } from 'firebase/app'
import {
  initializeFirestore,
  getFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore'
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
const isNewApp = getApps().length === 0
const app = isNewApp ? initializeApp(firebaseConfig) : getApps()[0]

// initializeFirestore 只能呼叫一次；HMR reload 時改用 getFirestore 取已存在的實例
export const db = isNewApp
  ? initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    })
  : getFirestore(app)

export const auth    = getAuth(app)
const storageBucket = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET
export const storage = getStorage(app, storageBucket ? `gs://${storageBucket}` : undefined)
export default app

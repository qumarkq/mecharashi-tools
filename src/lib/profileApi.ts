import { doc, updateDoc } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage } from './firebase'
import type { GameServer } from '../types/enums'

const profileDoc = (uid: string) => doc(db, 'users', uid, 'profile', 'main')

// ── 圖片壓縮工具 ──────────────────────────────────────────────────────────────

async function compressToWebP(file: File, quality = 0.85): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      const canvas = document.createElement('canvas')
      canvas.width  = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('無法建立 canvas context')); return }
      ctx.drawImage(img, 0, 0)
      canvas.toBlob(
        (blob) => {
          if (!blob) { reject(new Error('圖片壓縮失敗')); return }
          if (blob.size >= 2 * 1024 * 1024) {
            reject(new Error('壓縮後圖片仍超過 2MB，請選擇更小的圖片'))
            return
          }
          resolve(blob)
        },
        'image/webp',
        quality,
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('圖片讀取失敗'))
    }

    img.src = objectUrl
  })
}

// ── 公開 API ──────────────────────────────────────────────────────────────────

/** 上傳頭像：壓縮為 WebP → Storage → 更新 profile */
export async function uploadAvatar(uid: string, file: File): Promise<void> {
  if (file.size >= 2 * 1024 * 1024) {
    throw new Error('圖片超過 2MB 限制')
  }
  const webp        = await compressToWebP(file)
  const storageRef  = ref(storage, `avatars/${uid}/avatar.webp`)
  await uploadBytes(storageRef, webp, { contentType: 'image/webp' })
  const url = await getDownloadURL(storageRef)
  await updateDoc(profileDoc(uid), {
    avatarType:    'upload',
    avatarUrl:     url,
    avatarPilotId: null,
  })
}

/** 選取機師頭像：更新 avatarType='pilot'，不儲存靜態 URL */
export async function setPilotAvatar(uid: string, pilotId: string): Promise<void> {
  await updateDoc(profileDoc(uid), {
    avatarType:    'pilot',
    avatarPilotId: pilotId,
    avatarUrl:     null,
  })
}

/** 使用 Google 帳號頭像（第三方登入用戶專屬） */
export async function setGoogleAvatar(uid: string): Promise<void> {
  await updateDoc(profileDoc(uid), {
    avatarType:    'google',
    avatarUrl:     null,
    avatarPilotId: null,
  })
}

export interface ProfileInfoUpdate {
  displayName?:  string
  gameNickname?: string | null
  gameServer?:   GameServer | null
  guild?:        string | null
}

/** 更新個人資料文字欄位，空字串轉為 null */
export async function updateProfileInfo(uid: string, data: ProfileInfoUpdate): Promise<void> {
  const payload: Record<string, unknown> = {}

  if (data.displayName !== undefined) {
    payload.displayName = data.displayName.trim() || null
  }
  if ('gameNickname' in data) {
    payload.gameNickname = data.gameNickname?.trim() || null
  }
  if ('gameServer' in data) {
    payload.gameServer = data.gameServer ?? null
  }
  if ('guild' in data) {
    payload.guild = data.guild?.trim() || null
  }

  payload.updatedAt = new Date().toISOString()
  await updateDoc(profileDoc(uid), payload)
}

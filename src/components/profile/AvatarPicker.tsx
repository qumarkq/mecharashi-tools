import { useState, useRef, useCallback } from 'react'
import { uploadAvatar, setGoogleAvatar } from '../../lib/profileApi'
import PilotAvatarGallery from './PilotAvatarGallery'

type Tab = 'upload' | 'pilot' | 'google'

interface Props {
  isOpen: boolean
  uid: string
  currentPilotId?: string | null
  googlePhotoUrl?: string | null
  onSuccess: () => void
  onClose: () => void
}

const MAX_BYTES = 2 * 1024 * 1024

export default function AvatarPicker({ isOpen, uid, currentPilotId, googlePhotoUrl, onSuccess, onClose }: Props) {
  const hasGoogle = Boolean(googlePhotoUrl)
  const [tab, setTab]         = useState<Tab>('upload')
  const [file, setFile]       = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [sizeError, setSizeError] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [googleLoading, setGoogleLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    handleFileChange(e.dataTransfer.files[0] ?? null)
  }, [])

  if (!isOpen) return null

  function handleFileChange(selected: File | null) {
    if (!selected) return
    setSizeError(selected.size >= MAX_BYTES)
    setUploadError(null)
    setFile(selected)
    if (preview) URL.revokeObjectURL(preview)
    setPreview(URL.createObjectURL(selected))
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    handleFileChange(e.target.files?.[0] ?? null)
  }

  async function handleUpload() {
    if (!file || sizeError) return
    setUploading(true)
    setUploadError(null)
    try {
      await uploadAvatar(uid, file)
      onSuccess()
      onClose()
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : '上傳失敗，請重試')
    } finally {
      setUploading(false)
    }
  }

  async function handleUseGoogle() {
    setGoogleLoading(true)
    try {
      await setGoogleAvatar(uid)
      onSuccess()
      onClose()
    } finally {
      setGoogleLoading(false)
    }
  }

  function handlePilotSuccess() {
    onSuccess()
    onClose()
  }

  const tabs: Tab[] = hasGoogle ? ['upload', 'pilot', 'google'] : ['upload', 'pilot']
  const tabLabel: Record<Tab, string> = { upload: '上傳圖片', pilot: '機師頭像', google: 'Google 頭像' }

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-bg-card border border-border rounded-xl w-full max-w-md shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border">
          <h2 className="text-base font-bold">更換頭像</h2>
          <button
            onClick={onClose}
            className="text-text-dim hover:text-text-primary transition-colors text-lg leading-none cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 px-6 pt-4">
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                tab === t
                  ? 'bg-accent-purple/15 text-accent-purple border border-accent-purple/40'
                  : 'bg-bg-dark border border-border text-text-secondary hover:text-text-primary'
              }`}
            >
              {tabLabel[t]}
            </button>
          ))}
        </div>

        <div className="px-6 py-4">
          {/* Upload tab */}
          {tab === 'upload' && (
            <div className="flex flex-col gap-3">
              <div
                onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => inputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                  dragging ? 'border-accent-purple bg-accent-purple/5' : 'border-border hover:border-border-accent'
                }`}
              >
                {preview ? (
                  <img src={preview} alt="預覽" className="w-24 h-24 rounded-full object-cover mx-auto border-2 border-border" />
                ) : (
                  <>
                    <div className="text-3xl mb-2">🖼️</div>
                    <p className="text-sm text-text-secondary">拖曳圖片至此，或點擊選取檔案</p>
                    <p className="text-xs text-text-dim mt-1">支援 JPG / PNG / WebP，最大 2MB</p>
                  </>
                )}
              </div>

              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleInputChange}
              />

              {sizeError && (
                <p className="text-xs text-accent-red">圖片超過 2MB 限制，請選擇較小的圖片</p>
              )}
              {uploadError && (
                <p className="text-xs text-accent-red">{uploadError}</p>
              )}

              <button
                onClick={handleUpload}
                disabled={!file || sizeError || uploading}
                className="w-full py-2.5 bg-accent-purple text-white font-bold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-40 text-sm cursor-pointer"
              >
                {uploading ? '上傳中...' : '確認上傳'}
              </button>
            </div>
          )}

          {/* Pilot tab */}
          {tab === 'pilot' && (
            <PilotAvatarGallery
              uid={uid}
              currentPilotId={currentPilotId}
              onSuccess={handlePilotSuccess}
            />
          )}

          {/* Google tab */}
          {tab === 'google' && googlePhotoUrl && (
            <div className="flex flex-col items-center gap-4 py-4">
              <img
                src={googlePhotoUrl}
                alt="Google 頭像"
                className="w-24 h-24 rounded-full object-cover border-2 border-border"
              />
              <p className="text-sm text-text-secondary text-center">使用您 Google 帳號的個人頭像</p>
              <button
                onClick={handleUseGoogle}
                disabled={googleLoading}
                className="w-full py-2.5 bg-accent-purple text-white font-bold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-40 text-sm cursor-pointer"
              >
                {googleLoading ? '套用中...' : '使用 Google 頭像'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

import { useState } from 'react'

// ── Field：帶標籤的表單欄位包裝 ────────────────────────────────────────────────
export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs text-text-dim mb-1 block">{label}</label>
      {children}
    </div>
  )
}

// ── TabButton：頂層分頁按鈕（AdminPage 用）────────────────────────────────────
export function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
        active
          ? 'bg-accent-orange text-black'
          : 'bg-bg-dark border border-border text-text-secondary hover:text-text-primary'
      }`}
    >
      {children}
    </button>
  )
}

// ── AdminModal：各 EditPanel 共用彈窗殼層 ─────────────────────────────────────
// children 應包含：標題、(可選 Tab 列)、overflow-y-auto flex-1 捲動區
// 彈窗殼自帶：錯誤行、儲存/取消按鈕列
export function AdminModal({
  maxWidth = 'max-w-2xl',
  saving,
  error,
  onSave,
  saveLabel = '儲存變更',
  onCancel,
  children,
}: {
  maxWidth?: string
  saving: boolean
  error: string | null
  onSave: () => void
  saveLabel?: string
  onCancel: () => void
  children: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className={`bg-bg-card border border-border rounded-xl p-6 w-full ${maxWidth} max-h-[90vh] flex flex-col`}>
        {children}
        {error && <p className="text-xs text-accent-red mt-3 shrink-0">⚠ {error}</p>}
        <div className="flex gap-3 mt-4 shrink-0">
          <button
            onClick={onSave}
            disabled={saving}
            className="flex-1 px-4 py-2 bg-accent-orange text-black font-bold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {saving ? '儲存中...' : saveLabel}
          </button>
          <button
            onClick={onCancel}
            disabled={saving}
            className="px-4 py-2 border border-border text-text-secondary rounded-lg hover:bg-bg-dark transition-colors disabled:opacity-50"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  )
}

// ── useNewItemCreation：新建 ID 對話框邏輯（模組/武器/元件共用）─────────────────
export function useNewItemCreation<T>(
  existingItems: T[],
  getId: (item: T) => string,
  makeDefault: (id: string) => T,
) {
  const [creating, setCreating] = useState(false)
  const [newId, setNewId]       = useState('')
  const [newIdError, setNewIdError] = useState('')

  function openCreate()  { setCreating(true); setNewId(''); setNewIdError('') }
  function cancelCreate() { setCreating(false) }

  function confirmCreate(): T | null {
    const trimmed = newId.trim()
    if (!trimmed) { setNewIdError('請輸入 ID'); return null }
    if (existingItems.some((item) => getId(item) === trimmed)) {
      setNewIdError(`ID「${trimmed}」已存在`)
      return null
    }
    setCreating(false); setNewId(''); setNewIdError('')
    return makeDefault(trimmed)
  }

  return { creating, newId, setNewId, newIdError, setNewIdError, openCreate, cancelCreate, confirmCreate }
}

// ── NewItemDialog：新建 ID 輸入框 UI ─────────────────────────────────────────
export function NewItemDialog({
  creating,
  newId,
  newIdError,
  placeholder,
  hint,
  onChangeId,
  onConfirm,
  onCancel,
}: {
  creating: boolean
  newId: string
  newIdError: string
  placeholder: string
  hint: React.ReactNode
  onChangeId: (v: string) => void
  onConfirm: () => void
  onCancel: () => void
}) {
  if (!creating) return null
  return (
    <div className="mb-4 p-4 bg-bg-dark border border-accent-orange/40 rounded-xl">
      <p className="text-xs text-text-dim mb-2 font-medium">{hint}</p>
      <div className="flex gap-2">
        <input
          autoFocus
          type="text"
          value={newId}
          onChange={(e) => onChangeId(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') onConfirm() }}
          placeholder={placeholder}
          className="flex-1 px-3 py-2 rounded-lg bg-bg-card border border-border text-text-primary text-sm focus:outline-none focus:border-accent-orange"
        />
        <button
          onClick={onConfirm}
          className="px-4 py-2 bg-accent-orange text-black text-sm font-bold rounded-lg hover:opacity-90"
        >
          建立
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-2 border border-border text-text-secondary text-sm rounded-lg hover:bg-bg-card"
        >
          取消
        </button>
      </div>
      {newIdError && <p className="text-xs text-accent-red mt-1.5">⚠ {newIdError}</p>}
    </div>
  )
}

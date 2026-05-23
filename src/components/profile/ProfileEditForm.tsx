import { useState } from 'react'
import { GameServer } from '../../types/enums'
import { updateProfileInfo } from '../../lib/profileApi'
import type { UserProfile } from '../../types'

const GAME_SERVERS = Object.values(GameServer)
const MAX_LEN = 30

interface Props {
  profile: UserProfile
  uid: string
  onSaved: () => void
}

export default function ProfileEditForm({ profile, uid, onSaved }: Props) {
  const [displayName,  setDisplayName]  = useState(profile.displayName ?? '')
  const [gameNickname, setGameNickname] = useState(profile.gameNickname ?? '')
  const [gameServer,   setGameServer]   = useState<string>(profile.gameServer ?? '')
  const [guild,        setGuild]        = useState(profile.guild ?? '')

  const [saving,  setSaving]  = useState(false)
  const [toast,   setToast]   = useState<{ type: 'ok' | 'err'; msg: string } | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!displayName.trim()) return
    setSaving(true)
    setToast(null)
    try {
      await updateProfileInfo(uid, {
        displayName:  displayName.trim(),
        gameNickname: gameNickname || null,
        gameServer:   (gameServer as import('../../types/enums').GameServer) || null,
        guild:        guild || null,
      })
      setToast({ type: 'ok', msg: '已儲存' })
      onSaved()
    } catch {
      setToast({ type: 'err', msg: '儲存失敗，請重試' })
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'w-full px-3 py-2 rounded-lg bg-bg-dark border border-border text-text-primary text-sm focus:outline-none focus:border-accent-purple placeholder:text-text-dim'
  const labelCls = 'text-xs text-text-dim mb-1 flex items-center gap-1'

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <div className={labelCls}>顯示名稱</div>
        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value.slice(0, MAX_LEN))}
          placeholder="輸入顯示名稱"
          required
          maxLength={MAX_LEN}
          className={inputCls}
        />
        {displayName.length >= MAX_LEN && (
          <p className="text-xs text-text-dim mt-1">最多 {MAX_LEN} 字</p>
        )}
      </div>

      <div>
        <div className={labelCls}>遊戲暱稱 <span className="text-text-dim/60">（選填）</span></div>
        <input
          type="text"
          value={gameNickname}
          onChange={(e) => setGameNickname(e.target.value.slice(0, MAX_LEN))}
          placeholder="遊戲內暱稱"
          maxLength={MAX_LEN}
          className={inputCls}
        />
      </div>

      <div>
        <div className={labelCls}>遊戲伺服器 <span className="text-text-dim/60">（選填）</span></div>
        <select
          value={gameServer}
          onChange={(e) => setGameServer(e.target.value)}
          className={`${inputCls} cursor-pointer`}
        >
          <option value="">未設定</option>
          {GAME_SERVERS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      <div>
        <div className={labelCls}>遊戲公會 <span className="text-text-dim/60">（選填）</span></div>
        <input
          type="text"
          value={guild}
          onChange={(e) => setGuild(e.target.value.slice(0, MAX_LEN))}
          placeholder="公會名稱"
          maxLength={MAX_LEN}
          className={inputCls}
        />
      </div>

      {toast && (
        <p className={`text-xs ${toast.type === 'ok' ? 'text-accent-green' : 'text-accent-red'}`}>
          {toast.msg}
        </p>
      )}

      <button
        type="submit"
        disabled={saving || !displayName.trim()}
        className="w-full py-2.5 bg-accent-purple text-white font-bold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-40 text-sm cursor-pointer"
      >
        {saving ? '儲存中...' : '儲存變更'}
      </button>
    </form>
  )
}

import { useState } from 'react'
import type { GrayOpsRoster, GrayOpsMechEntry } from '../../../types'
import { GRAY_OPS_BASE } from '../../../data/patchVersions'
import { GRAY_OPS_COMPANIES, GRAY_OPS_COMPANY_COLOR } from './constants'

function buildSeedRoster(): GrayOpsRoster {
  return {
    companies: Object.fromEntries(
      GRAY_OPS_COMPANIES.map((c) => [c, GRAY_OPS_BASE[c].map((name) => ({ name }))])
    ),
  }
}

export default function GrayOpsAdmin({
  roster,
  onSave,
}: {
  roster: GrayOpsRoster | null
  onSave: (updated: GrayOpsRoster) => Promise<void>
}) {
  const [form, setForm] = useState<GrayOpsRoster>(
    roster ?? { companies: Object.fromEntries(GRAY_OPS_COMPANIES.map((c) => [c, []])) }
  )
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [newName, setNewName]       = useState<Record<string, string>>({})
  const [newVersion, setNewVersion] = useState<Record<string, string>>({})

  function getMechs(company: string): GrayOpsMechEntry[] {
    return form.companies[company] ?? []
  }

  function updateMechs(company: string, mechs: GrayOpsMechEntry[]) {
    setForm((f) => ({ companies: { ...f.companies, [company]: mechs } }))
  }

  function addMech(company: string) {
    const name = (newName[company] ?? '').trim()
    if (!name) return
    const version = (newVersion[company] ?? '').trim() || undefined
    updateMechs(company, [...getMechs(company), { name, version }])
    setNewName((n) => ({ ...n, [company]: '' }))
    setNewVersion((n) => ({ ...n, [company]: '' }))
  }

  function removeMech(company: string, idx: number) {
    updateMechs(company, getMechs(company).filter((_, i) => i !== idx))
  }

  function handleSeed() {
    if (!confirm('這將以靜態資料覆蓋目前表單（尚未儲存至 Firestore），確定嗎？')) return
    setForm(buildSeedRoster())
  }

  async function handleSave() {
    setSaving(true); setError(null); setSuccess(false)
    try {
      await onSave(form)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (e) {
      setError(e instanceof Error ? e.message : '儲存失敗')
    } finally {
      setSaving(false)
    }
  }

  const totalCount = GRAY_OPS_COMPANIES.reduce((acc, c) => acc + getMechs(c).length, 0)

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-text-dim text-xs">共 {totalCount} 筆機甲</p>
        <div className="flex gap-2">
          <button
            onClick={handleSeed}
            className="text-xs px-3 py-1.5 bg-bg-dark border border-border text-text-secondary rounded-lg hover:border-border-accent hover:text-text-primary transition-colors"
          >
            從靜態資料初始化
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="text-xs px-4 py-1.5 bg-accent-orange text-black font-bold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {saving ? '儲存中...' : '儲存至 Firestore'}
          </button>
        </div>
      </div>

      {error   && <p className="text-xs text-accent-red mb-3">⚠ {error}</p>}
      {success && <p className="text-xs text-green-400 mb-3">✓ 已儲存</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {GRAY_OPS_COMPANIES.map((company) => {
          const mechs = getMechs(company)
          const colorClass = GRAY_OPS_COMPANY_COLOR[company]
          return (
            <div key={company} className="bg-bg-dark border border-border rounded-xl p-4">
              <div className={`text-sm font-bold mb-3 ${colorClass}`}>{company}</div>

              <div className="space-y-1.5 mb-3 max-h-72 overflow-y-auto pr-1">
                {mechs.map((m, idx) => (
                  <div key={idx} className="flex items-center gap-2 group">
                    <span className="flex-1 text-sm text-text-secondary truncate">{m.name}</span>
                    {m.version && (
                      <span className="text-[11px] text-accent-cyan border border-accent-cyan/30 px-1 rounded shrink-0">
                        {m.version}
                      </span>
                    )}
                    <button
                      onClick={() => removeMech(company, idx)}
                      className="text-[12px] text-text-dim hover:text-accent-red opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                {mechs.length === 0 && (
                  <p className="text-xs text-text-dim">（尚無資料）</p>
                )}
              </div>

              <div className="space-y-1.5 pt-3 border-t border-border/60">
                <input
                  type="text"
                  value={newName[company] ?? ''}
                  onChange={(e) => setNewName((n) => ({ ...n, [company]: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === 'Enter') addMech(company) }}
                  placeholder="機甲名稱"
                  className="w-full px-2 py-1 text-sm rounded bg-bg-card border border-border text-text-primary focus:outline-none focus:border-accent-orange"
                />
                <div className="flex gap-1">
                  <input
                    type="text"
                    value={newVersion[company] ?? ''}
                    onChange={(e) => setNewVersion((n) => ({ ...n, [company]: e.target.value }))}
                    onKeyDown={(e) => { if (e.key === 'Enter') addMech(company) }}
                    placeholder="版本（選填，如 v3.3）"
                    className="flex-1 px-2 py-1 text-sm rounded bg-bg-card border border-border text-text-primary focus:outline-none focus:border-accent-orange"
                  />
                  <button
                    onClick={() => addMech(company)}
                    className="px-2 py-1 text-xs bg-accent-orange text-black font-bold rounded hover:opacity-90"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

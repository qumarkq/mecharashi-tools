import { useState, useEffect, useMemo } from 'react'
import type { Module, Mech } from '../types'
import { fetchData } from '../utils/assets'

// ─── 模組管理分頁 ──────────────────────────────────────────────────────
function ModuleAdmin() {
  const [modules, setModules] = useState<Module[]>([])
  const [mechs, setMechs] = useState<Mech[]>([])
  const [search, setSearch] = useState('')
  const [filterBound, setFilterBound] = useState<'all' | 'bound' | 'unbound'>('all')
  const [editing, setEditing] = useState<Module | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetchData<Module[]>('modules.json'),
      fetchData<Mech[]>('mechs.json'),
    ]).then(([mods, mechs]) => {
      setModules(mods)
      setMechs(mechs)
      setLoading(false)
    })
  }, [])

  const filtered = useMemo(() => {
    return modules.filter((m) => {
      const matchSearch =
        !search ||
        m.name.includes(search) ||
        m.id.includes(search) ||
        m.description.includes(search)
      const matchBound =
        filterBound === 'all' ||
        (filterBound === 'bound' && m.boundMechId) ||
        (filterBound === 'unbound' && !m.boundMechId)
      return matchSearch && matchBound
    })
  }, [modules, search, filterBound])

  function handleSave(updated: Module) {
    setModules((prev) => prev.map((m) => (m.id === updated.id ? updated : m)))
    setEditing(null)
  }

  if (loading) return <div className="text-text-dim">載入中...</div>

  return (
    <div>
      {/* 搜尋與篩選 */}
      <div className="flex flex-wrap gap-3 mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜尋模組名稱 / ID / 描述..."
          className="flex-1 min-w-[200px] px-3 py-2 rounded-lg bg-bg-dark border border-border text-text-primary text-sm focus:outline-none focus:border-accent-orange"
        />
        <select
          value={filterBound}
          onChange={(e) => setFilterBound(e.target.value as 'all' | 'bound' | 'unbound')}
          className="px-3 py-2 rounded-lg bg-bg-dark border border-border text-text-primary text-sm"
        >
          <option value="all">全部</option>
          <option value="bound">已綁定</option>
          <option value="unbound">未綁定</option>
        </select>
      </div>

      <p className="text-text-dim text-xs mb-3">
        共 {filtered.length} / {modules.length} 個模組
      </p>

      {/* 模組列表 */}
      <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
        {filtered.map((mod) => (
          <div
            key={mod.id}
            className="bg-bg-dark border border-border rounded-lg p-3 flex items-center gap-3 hover:border-border-accent transition-colors cursor-pointer"
            onClick={() => setEditing(mod)}
          >
            {mod.icon && (
              <img
                src={mod.icon}
                alt=""
                className="w-8 h-8 rounded"
                onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
              />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-text-primary truncate">{mod.name}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-bg-card border border-border text-text-dim">
                  {mod.slot}
                </span>
                {mod.source === 'auto' && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent-cyan/10 text-accent-cyan border border-accent-cyan/30">
                    自動
                  </span>
                )}
              </div>
              <p className="text-xs text-text-dim truncate mt-0.5">{mod.description || '（無描述）'}</p>
            </div>
            <div className="text-right shrink-0">
              {mod.boundMechId ? (
                <span className="text-[11px] text-accent-orange">
                  {mechs.find((m) => m.id === mod.boundMechId)?.name || mod.boundMechId}
                </span>
              ) : (
                <span className="text-[11px] text-text-dim">通用</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* 編輯面板 */}
      {editing && (
        <ModuleEditPanel
          module={editing}
          mechs={mechs}
          onSave={handleSave}
          onCancel={() => setEditing(null)}
        />
      )}
    </div>
  )
}

// ─── 模組編輯面板 ──────────────────────────────────────────────────────
function ModuleEditPanel({
  module: mod,
  mechs,
  onSave,
  onCancel,
}: {
  module: Module
  mechs: Mech[]
  onSave: (m: Module) => void
  onCancel: () => void
}) {
  const [form, setForm] = useState<Module>({ ...mod })

  useEffect(() => {
    setForm({ ...mod })
  }, [mod])

  function update<K extends keyof Module>(key: K, value: Module[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-bg-card border border-border rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
          <span className="text-accent-orange">✎</span> 編輯模組
        </h3>

        <div className="space-y-3">
          {/* 名稱 */}
          <Field label="名稱">
            <input
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
              className="input-field"
            />
          </Field>

          {/* ID (唯讀) */}
          <Field label="ID">
            <input value={form.id} readOnly className="input-field opacity-60" />
          </Field>

          {/* 描述 */}
          <Field label="效果描述">
            <textarea
              value={form.description}
              onChange={(e) => update('description', e.target.value)}
              className="input-field min-h-[80px] resize-y"
            />
          </Field>

          {/* 數值欄位 */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="增傷 (%)">
              <input
                type="number"
                value={form.dmg}
                onChange={(e) => update('dmg', Number(e.target.value))}
                className="input-field"
              />
            </Field>
            <Field label="暴擊率">
              <input
                type="number"
                value={form.crit}
                onChange={(e) => update('crit', Number(e.target.value))}
                className="input-field"
              />
            </Field>
            <Field label="暴擊傷害 (%)">
              <input
                type="number"
                value={form.critDmg}
                onChange={(e) => update('critDmg', Number(e.target.value))}
                className="input-field"
              />
            </Field>
            <Field label="命中率">
              <input
                type="number"
                value={form.acc}
                onChange={(e) => update('acc', Number(e.target.value))}
                className="input-field"
              />
            </Field>
          </div>

          {/* 槽位 */}
          <Field label="槽位">
            <select
              value={form.slot}
              onChange={(e) => update('slot', e.target.value as Module['slot'])}
              className="input-field"
            >
              <option value="4mod">四模組 (4mod)</option>
              <option value="8mod">八模組 (8mod)</option>
              <option value="fixed">固定模 (fixed)</option>
              <option value="fixed_1">固定模 1 (fixed_1)</option>
              <option value="fixed_2">固定模 2 (fixed_2)</option>
              <option value="fixed_3">固定模 3 (fixed_3)</option>
            </select>
          </Field>

          {/* 綁定機甲 */}
          <Field label="綁定機甲">
            <select
              value={form.boundMechId ?? ''}
              onChange={(e) => update('boundMechId', e.target.value || null)}
              className="input-field"
            >
              <option value="">不綁定（通用模組）</option>
              {mechs.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </Field>

          {/* 綁定部位 */}
          <Field label="綁定部位">
            <select
              value={form.boundPart ?? ''}
              onChange={(e) =>
                update('boundPart', (e.target.value || null) as Module['boundPart'])
              }
              className="input-field"
            >
              <option value="">不限部位</option>
              <option value="torso">軀幹</option>
              <option value="leftArm">左臂</option>
              <option value="rightArm">右臂</option>
              <option value="legs">腿部</option>
            </select>
          </Field>

          {/* 稀有度 */}
          <Field label="稀有度">
            <select
              value={form.rarity}
              onChange={(e) => update('rarity', e.target.value)}
              className="input-field"
            >
              <option value="SSR">SSR</option>
              <option value="SR">SR</option>
              <option value="R">R</option>
              <option value="N">N</option>
            </select>
          </Field>
        </div>

        {/* 按鈕 */}
        <div className="flex gap-3 mt-6">
          <button
            onClick={() => onSave(form)}
            className="flex-1 px-4 py-2 bg-accent-orange text-black font-bold rounded-lg hover:opacity-90 transition-opacity"
          >
            儲存變更
          </button>
          <button
            onClick={onCancel}
            className="px-4 py-2 border border-border text-text-secondary rounded-lg hover:bg-bg-dark transition-colors"
          >
            取消
          </button>
        </div>

        <p className="text-[11px] text-text-dim mt-3">
          ⚠ 變更僅在前端預覽，需匯出 JSON 並提交至 Git 才會生效。
        </p>
      </div>
    </div>
  )
}

// ─── 機甲管理分頁 ──────────────────────────────────────────────────────
function MechAdmin() {
  const [mechs, setMechs] = useState<Mech[]>([])
  const [modules, setModules] = useState<Module[]>([])
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Mech | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetchData<Mech[]>('mechs.json'),
      fetchData<Module[]>('modules.json'),
    ]).then(([m, mod]) => {
      setMechs(m)
      setModules(mod)
      setLoading(false)
    })
  }, [])

  const filtered = useMemo(() => {
    if (!search) return mechs
    return mechs.filter(
      (m) => m.name.includes(search) || m.id.includes(search)
    )
  }, [mechs, search])

  function handleSave(updated: Mech) {
    setMechs((prev) => prev.map((m) => (m.id === updated.id ? updated : m)))
    setEditing(null)
  }

  if (loading) return <div className="text-text-dim">載入中...</div>

  return (
    <div>
      <div className="flex gap-3 mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜尋機甲名稱..."
          className="flex-1 min-w-[200px] px-3 py-2 rounded-lg bg-bg-dark border border-border text-text-primary text-sm focus:outline-none focus:border-accent-orange"
        />
      </div>

      <p className="text-text-dim text-xs mb-3">
        共 {filtered.length} / {mechs.length} 台機甲
      </p>

      <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
        {filtered.map((mech) => {
          const mod4 = modules.find((m) => m.id === mech.module4Id)
          const mod8 = modules.find((m) => m.id === mech.module8Id)
          const fixedMods = mech.moduleFixedIds
            ?.map((id) => modules.find((m) => m.id === id))
            .filter(Boolean)

          return (
            <div
              key={mech.id}
              className="bg-bg-dark border border-border rounded-lg p-3 hover:border-border-accent transition-colors cursor-pointer"
              onClick={() => setEditing(mech)}
            >
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm">{mech.name}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded border border-border text-text-dim">
                      {mech.armorType}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {mod4 && (
                      <span className="text-[11px] text-accent-cyan">
                        四模: {mod4.name}
                      </span>
                    )}
                    {mod8 && (
                      <span className="text-[11px] text-accent-orange">
                        八模: {mod8.name}
                      </span>
                    )}
                    {fixedMods && fixedMods.length > 0 && (
                      <span className="text-[11px] text-accent-green">
                        固定: {fixedMods.map((m) => m!.name).join(', ')}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {editing && (
        <MechEditPanel
          mech={editing}
          modules={modules}
          onSave={handleSave}
          onCancel={() => setEditing(null)}
        />
      )}
    </div>
  )
}

// ─── 機甲編輯面板 ──────────────────────────────────────────────────────
function MechEditPanel({
  mech,
  modules,
  onSave,
  onCancel,
}: {
  mech: Mech
  modules: Module[]
  onSave: (m: Mech) => void
  onCancel: () => void
}) {
  const [form, setForm] = useState<Mech>({ ...mech })

  useEffect(() => {
    setForm({ ...mech })
  }, [mech])

  const boundModules = useMemo(
    () => modules.filter((m) => m.boundMechId === form.id || !m.boundMechId),
    [modules, form.id]
  )

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-bg-card border border-border rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
          <span className="text-accent-orange">⚙</span> 編輯機甲模組
          <span className="text-text-secondary text-sm font-normal ml-1">{form.name}</span>
        </h3>

        <div className="space-y-4">
          {/* 四模組 */}
          <Field label="四格模組 (4mod)">
            <select
              value={form.module4Id}
              onChange={(e) => setForm((f) => ({ ...f, module4Id: e.target.value }))}
              className="input-field"
            >
              <option value="">（未設定）</option>
              {boundModules
                .filter((m) => m.slot === '4mod')
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.id})
                  </option>
                ))}
            </select>
          </Field>

          {/* 八模組 */}
          <Field label="八格模組 (8mod)">
            <select
              value={form.module8Id}
              onChange={(e) => setForm((f) => ({ ...f, module8Id: e.target.value }))}
              className="input-field"
            >
              <option value="">（未設定）</option>
              {boundModules
                .filter((m) => m.slot === '8mod')
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.id})
                  </option>
                ))}
            </select>
          </Field>

          {/* 固定模組 */}
          <Field label="固定模組">
            <div className="space-y-2">
              {(form.moduleFixedIds || []).map((fixedId, idx) => (
                <div key={idx} className="flex gap-2">
                  <select
                    value={fixedId}
                    onChange={(e) => {
                      const newIds = [...(form.moduleFixedIds || [])]
                      newIds[idx] = e.target.value
                      setForm((f) => ({ ...f, moduleFixedIds: newIds }))
                    }}
                    className="input-field flex-1"
                  >
                    <option value="">（未設定）</option>
                    {boundModules
                      .filter((m) => m.slot.startsWith('fixed'))
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.id})
                        </option>
                      ))}
                  </select>
                  <button
                    onClick={() => {
                      const newIds = (form.moduleFixedIds || []).filter(
                        (_, i) => i !== idx
                      )
                      setForm((f) => ({ ...f, moduleFixedIds: newIds }))
                    }}
                    className="px-2 py-1 text-accent-red border border-accent-red/30 rounded hover:bg-accent-red/10 text-xs"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    moduleFixedIds: [...(f.moduleFixedIds || []), ''],
                  }))
                }
                className="text-xs text-accent-cyan hover:text-accent-cyan/80"
              >
                + 新增固定模組
              </button>
            </div>
          </Field>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={() => onSave(form)}
            className="flex-1 px-4 py-2 bg-accent-orange text-black font-bold rounded-lg hover:opacity-90 transition-opacity"
          >
            儲存變更
          </button>
          <button
            onClick={onCancel}
            className="px-4 py-2 border border-border text-text-secondary rounded-lg hover:bg-bg-dark transition-colors"
          >
            取消
          </button>
        </div>

        <p className="text-[11px] text-text-dim mt-3">
          ⚠ 變更僅在前端預覽，需匯出 JSON 並提交至 Git 才會生效。
        </p>
      </div>
    </div>
  )
}

// ─── 匯出 JSON 按鈕 ──────────────────────────────────────────────────────
function ExportButton({
  data,
  filename,
  label,
}: {
  data: unknown
  filename: string
  label: string
}) {
  function handleExport() {
    const json = JSON.stringify(data, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <button
      onClick={handleExport}
      className="px-3 py-1.5 text-xs border border-accent-green text-accent-green rounded-lg hover:bg-accent-green/10 transition-colors"
    >
      ⬇ {label}
    </button>
  )
}

// ─── 共用元件 ──────────────────────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs text-text-dim mb-1 block">{label}</label>
      {children}
    </div>
  )
}

// ─── 主頁面 ──────────────────────────────────────────────────────────────
export default function AdminPage() {
  const [tab, setTab] = useState<'modules' | 'mechs'>('modules')
  const [modules, setModules] = useState<Module[]>([])
  const [mechs, setMechs] = useState<Mech[]>([])

  useEffect(() => {
    Promise.all([
      fetchData<Module[]>('modules.json'),
      fetchData<Mech[]>('mechs.json'),
    ]).then(([mods, m]) => {
      setModules(mods)
      setMechs(m)
    })
  }, [])

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <div className="mb-8">
        <span className="text-xs text-accent-orange tracking-[3px] uppercase font-[Orbitron,sans-serif]">
          Admin
        </span>
        <h1 className="text-3xl font-bold mt-2">管理後台</h1>
        <p className="text-text-secondary mt-2">
          管理者專用：維護模組數值、機甲模組綁定。
        </p>
      </div>

      {/* 分頁標籤 */}
      <div className="flex gap-2 mb-6">
        <TabButton active={tab === 'modules'} onClick={() => setTab('modules')}>
          模組管理
        </TabButton>
        <TabButton active={tab === 'mechs'} onClick={() => setTab('mechs')}>
          機甲管理
        </TabButton>
        <div className="ml-auto flex gap-2">
          <ExportButton data={modules} filename="modules.json" label="匯出模組" />
          <ExportButton data={mechs} filename="mechs.json" label="匯出機甲" />
        </div>
      </div>

      {/* 分頁內容 */}
      <div className="bg-bg-card border border-border rounded-xl p-6">
        {tab === 'modules' && <ModuleAdmin />}
        {tab === 'mechs' && <MechAdmin />}
      </div>
    </div>
  )
}

function TabButton({
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

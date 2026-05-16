import { useState, useEffect, useMemo } from 'react'
import type { Module, Mech, ConditionalEffect, ModuleLevel, UserProfile } from '../types'
import { ModuleRarity, MechPartPosition, ModuleSlot, ModuleSource, ModuleDataSource, ConditionalTrigger } from '../types/enums'
import { getModules, getMechs, updateModule, updateMech } from '../lib/firestoreApi'
import { getAllUsers, updateUserRole } from '../lib/userApi'
import { useAuth } from '../contexts/AuthContext'

// ── 顯示常數 ───────────────────────────────────────────────────────────────────

const SLOT_OPTIONS: { value: string; label: string }[] = [
  { value: ModuleSlot.SLOT_4,    label: `四格特性模組（${ModuleSlot.SLOT_4}）` },
  { value: ModuleSlot.SLOT_8,    label: `八格模組（${ModuleSlot.SLOT_8}）` },
  { value: ModuleSlot.UNIVERSAL, label: `通用模組（${ModuleSlot.UNIVERSAL}）` },
  { value: ModuleSlot.BUILT_IN,  label: `副模組・機甲內建（${ModuleSlot.BUILT_IN}）` },
  { value: ModuleSlot.EXCLUSIVE, label: `機甲專屬模組（${ModuleSlot.EXCLUSIVE}）` },
]

const SLOT_LABEL: Record<string, string> = {
  [ModuleSlot.SLOT_4]:    '四模',
  [ModuleSlot.SLOT_8]:    '八模',
  [ModuleSlot.UNIVERSAL]: '通用',
  [ModuleSlot.BUILT_IN]:  '副模',
  [ModuleSlot.EXCLUSIVE]: '專屬',
}

const PART_OPTIONS: { value: string; label: string }[] = [
  { value: MechPartPosition.TORSO,     label: `軀幹（${MechPartPosition.TORSO}）` },
  { value: MechPartPosition.LEFT_ARM,  label: `左臂（${MechPartPosition.LEFT_ARM}）` },
  { value: MechPartPosition.RIGHT_ARM, label: `右臂（${MechPartPosition.RIGHT_ARM}）` },
  { value: MechPartPosition.LEGS,      label: `腿部（${MechPartPosition.LEGS}）` },
]

const TRIGGER_LABEL: Record<string, string> = {
  [ConditionalTrigger.PER_BUFF_HELD]:     `每持有N個增益效果（${ConditionalTrigger.PER_BUFF_HELD}）`,
  [ConditionalTrigger.PER_COMBO]:         `每N連擊（${ConditionalTrigger.PER_COMBO}）`,
  [ConditionalTrigger.AP_SKILL]:          `AP技能・最低AP門檻（${ConditionalTrigger.AP_SKILL}）`,
  [ConditionalTrigger.PER_AMMO_CONSUMED]: `每消耗N枚彈藥（${ConditionalTrigger.PER_AMMO_CONSUMED}）`,
  [ConditionalTrigger.TACTICAL_WEAPON]:   `使用戰術武器時（${ConditionalTrigger.TACTICAL_WEAPON}）`,
}

const STAT_OPTIONS: { key: string; label: string }[] = [
  { key: 'dmg',                  label: '增傷 dmg (%)' },
  { key: 'crit_rate',            label: '暴擊率 crit_rate' },
  { key: 'critDmg',              label: '暴擊傷害 critDmg (%)' },
  { key: 'acc_rate',             label: '命中率 acc_rate' },
  { key: 'firepower_rate',       label: '火力 firepower_rate (%)' },
  { key: 'armor_rate',           label: '護甲 armor_rate (%)' },
  { key: 'output_bonus',         label: '出力 output_bonus' },
  { key: 'crit_resist_rate',     label: '被暴擊降低 crit_resist_rate' },
  { key: 'dodge_rate',           label: '回避 dodge_rate (%)' },
  { key: 'durable_rate',         label: '耐久 durable_rate (%)' },
  { key: 'dmg_resist_rate',      label: '傷害降低 dmg_resist_rate (%)' },
  { key: 'dmg_assault',          label: '突擊武器增傷 dmg_assault (%)' },
  { key: 'dmg_melee',            label: '格鬥武器增傷 dmg_melee (%)' },
  { key: 'dmg_shooting',         label: '射擊武器增傷 dmg_shooting (%)' },
  { key: 'dmg_tactical',         label: '戰術武器增傷 dmg_tactical (%)' },
  { key: 'dmg_blade',            label: '刀劍增傷 dmg_blade (%)' },
  { key: 'dmg_polearm',          label: '長柄增傷 dmg_polearm (%)' },
  { key: 'dmg_missile',          label: '導彈增傷 dmg_missile (%)' },
  { key: 'dmg_rocket',           label: '火箭增傷 dmg_rocket (%)' },
  { key: 'dmg_shotgun',          label: '霰彈增傷 dmg_shotgun (%)' },
  { key: 'dmg_machinegun',       label: '機槍增傷 dmg_machinegun (%)' },
  { key: 'dmg_heavy_machinegun', label: '重機槍增傷 dmg_heavy_machinegun (%)' },
  { key: 'dmg_railgun',          label: '電磁炮增傷 dmg_railgun (%)' },
  { key: 'dmg_funnel',           label: '浮游炮增傷 dmg_funnel (%)' },
  { key: 'dmg_sniper_light',     label: '輕型狙擊步槍增傷 dmg_sniper_light (%)' },
  { key: 'dmg_sniper',           label: '狙擊步槍增傷 dmg_sniper (%)' },
  { key: 'dmg_fist',             label: '拳套增傷 dmg_fist (%)' },
  { key: 'dmg_pile',             label: '打樁機增傷 dmg_pile (%)' },
  { key: 'dmg_chainsaw',         label: '電鋸增傷 dmg_chainsaw (%)' },
  { key: 'dmg_flamethrower',     label: '噴火器增傷 dmg_flamethrower (%)' },
  { key: 'dmg_counter',          label: '反擊增傷 dmg_counter (%)' },
  { key: 'dmg_enemy_phase',      label: '敵方階段增傷 dmg_enemy_phase (%)' },
]

function moduleHasStats(m: Module): boolean {
  return (
    m.dmg > 0 || m.critDmg > 0 || m.crit_rate > 0 || m.acc_rate > 0 ||
    m.firepower_rate > 0 || m.armor_rate > 0 || m.output_bonus > 0 ||
    m.crit_resist_rate > 0 || m.dodge_rate > 0 || m.durable_rate > 0 ||
    m.dmg_resist_rate > 0 ||
    (m.dmg_assault ?? 0) > 0 || (m.dmg_melee ?? 0) > 0 ||
    (m.dmg_shooting ?? 0) > 0 || (m.dmg_tactical ?? 0) > 0 ||
    (m.dmg_blade ?? 0) > 0 || (m.dmg_polearm ?? 0) > 0 ||
    (m.dmg_missile ?? 0) > 0 || (m.dmg_rocket ?? 0) > 0 ||
    (m.dmg_shotgun ?? 0) > 0 || (m.dmg_machinegun ?? 0) > 0 ||
    (m.dmg_heavy_machinegun ?? 0) > 0 || (m.dmg_railgun ?? 0) > 0 ||
    (m.dmg_funnel ?? 0) > 0 || (m.dmg_sniper_light ?? 0) > 0 ||
    (m.dmg_sniper ?? 0) > 0 || (m.dmg_fist ?? 0) > 0 ||
    (m.dmg_pile ?? 0) > 0 || (m.dmg_chainsaw ?? 0) > 0 ||
    (m.dmg_flamethrower ?? 0) > 0 || (m.dmg_counter ?? 0) > 0 ||
    (m.dmg_enemy_phase ?? 0) > 0
  )
}

function makeDefaultModule(id: string): Module {
  return {
    id,
    name: '',
    slot: ModuleSlot.SLOT_4,
    boundMechId: null,
    boundPart: null,
    dmg: 0, critDmg: 0, crit_rate: 0, acc_rate: 0,
    firepower_rate: 0, armor_rate: 0, crit_resist_rate: 0,
    output_bonus: 0, dodge_rate: 0, durable_rate: 0, dmg_resist_rate: 0,
    description: '',
    rarity: ModuleRarity.A,
    source: [ModuleSource.UNKNOWN],
    managedBy: ModuleDataSource.MANUAL,
    levels: [],
    conditionalEffects: [],
    moduleAddLevel: 1,
  }
}

// ─── 模組管理分頁 ──────────────────────────────────────────────────────
function ModuleAdmin({
  modules,
  mechs,
  onModuleSave,
}: {
  modules: Module[]
  mechs: Mech[]
  onModuleSave: (updated: Module) => Promise<void>
}) {
  const [search, setSearch] = useState('')
  const [filterBound, setFilterBound] = useState<'all' | 'bound' | 'unbound'>('all')
  const [filterSlot, setFilterSlot] = useState<'all' | string>('all')
  const [filterStats, setFilterStats] = useState<'all' | 'has' | 'none'>('all')
  const [filterSource, setFilterSource] = useState<'all' | string>('all')
  const [editing, setEditing] = useState<Module | null>(null)
  const [creating, setCreating] = useState(false)
  const [newId, setNewId] = useState('')
  const [newIdError, setNewIdError] = useState('')

  const filtered = useMemo(() => {
    return modules.filter((m) => {
      const matchSearch =
        !search ||
        m.name.includes(search) ||
        m.id.includes(search) ||
        (m.description || '').includes(search)
      const matchBound =
        filterBound === 'all' ||
        (filterBound === 'bound' && m.boundMechId) ||
        (filterBound === 'unbound' && !m.boundMechId)
      const matchSlot = filterSlot === 'all' || m.slot === filterSlot
      const matchStats =
        filterStats === 'all' ||
        (filterStats === 'has' && moduleHasStats(m)) ||
        (filterStats === 'none' && !moduleHasStats(m))
      const matchSource =
        filterSource === 'all' ||
        (Array.isArray(m.source) ? m.source.includes(filterSource) : m.source === filterSource)
      return matchSearch && matchBound && matchSlot && matchStats && matchSource
    })
  }, [modules, search, filterBound, filterSlot, filterStats, filterSource])

  async function handleSave(updated: Module) {
    await onModuleSave(updated)
    setEditing(null)
  }

  function handleCreateConfirm() {
    const trimmed = newId.trim()
    if (!trimmed) {
      setNewIdError('請輸入 ID')
      return
    }
    if (modules.some((m) => m.id === trimmed)) {
      setNewIdError(`ID「${trimmed}」已存在`)
      return
    }
    setCreating(false)
    setNewId('')
    setNewIdError('')
    setEditing(makeDefaultModule(trimmed))
  }

  return (
    <div>
      {/* 搜尋與篩選 */}
      <div className="flex flex-wrap gap-2 mb-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜尋名稱 / ID / 描述..."
          className="flex-1 min-w-[180px] px-3 py-2 rounded-lg bg-bg-dark border border-border text-text-primary text-sm focus:outline-none focus:border-accent-orange"
        />
        <select
          value={filterSlot}
          onChange={(e) => setFilterSlot(e.target.value)}
          className="px-3 py-2 rounded-lg bg-bg-dark border border-border text-text-primary text-sm"
        >
          <option value="all">全部槽位</option>
          {SLOT_OPTIONS.map(({ value, label }) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <select
          value={filterBound}
          onChange={(e) => setFilterBound(e.target.value as typeof filterBound)}
          className="px-3 py-2 rounded-lg bg-bg-dark border border-border text-text-primary text-sm"
        >
          <option value="all">全部綁定</option>
          <option value="bound">已綁定機甲</option>
          <option value="unbound">未綁定（通用）</option>
        </select>
        <select
          value={filterStats}
          onChange={(e) => setFilterStats(e.target.value as typeof filterStats)}
          className="px-3 py-2 rounded-lg bg-bg-dark border border-border text-text-primary text-sm"
        >
          <option value="all">全部數值</option>
          <option value="has">已填數值</option>
          <option value="none">尚未填值</option>
        </select>
        <select
          value={filterSource}
          onChange={(e) => setFilterSource(e.target.value)}
          className="px-3 py-2 rounded-lg bg-bg-dark border border-border text-text-primary text-sm"
        >
          <option value="all">全部來源</option>
          {Object.values(ModuleSource).map((v) => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>
      </div>

      {/* 計數 + 新增按鈕 */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-text-dim text-xs">
          共 {filtered.length} / {modules.length} 個模組
        </p>
        <button
          onClick={() => { setCreating(true); setNewId(''); setNewIdError('') }}
          className="text-xs px-3 py-1.5 bg-accent-orange text-black font-bold rounded-lg hover:opacity-90 transition-opacity"
        >
          + 新增模組
        </button>
      </div>

      {/* 新增 ID 輸入框 */}
      {creating && (
        <div className="mb-4 p-4 bg-bg-dark border border-accent-orange/40 rounded-xl">
          <p className="text-xs text-text-dim mb-2 font-medium">輸入新模組 ID（格式如 <span className="text-accent-cyan">mod_123</span>，儲存後不可更改）</p>
          <div className="flex gap-2">
            <input
              autoFocus
              type="text"
              value={newId}
              onChange={(e) => { setNewId(e.target.value); setNewIdError('') }}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreateConfirm() }}
              placeholder="mod_"
              className="flex-1 px-3 py-2 rounded-lg bg-bg-card border border-border text-text-primary text-sm focus:outline-none focus:border-accent-orange"
            />
            <button
              onClick={handleCreateConfirm}
              className="px-4 py-2 bg-accent-orange text-black text-sm font-bold rounded-lg hover:opacity-90"
            >
              建立
            </button>
            <button
              onClick={() => setCreating(false)}
              className="px-3 py-2 border border-border text-text-secondary text-sm rounded-lg hover:bg-bg-card"
            >
              取消
            </button>
          </div>
          {newIdError && <p className="text-xs text-accent-red mt-1.5">⚠ {newIdError}</p>}
        </div>
      )}

      {/* 模組列表 */}
      <div className="space-y-1.5 max-h-[600px] overflow-y-auto pr-1">
        {filtered.map((mod) => (
          <div
            key={mod.id}
            className="bg-bg-dark border border-border rounded-lg px-3 py-2.5 flex items-center gap-3 hover:border-border-accent transition-colors cursor-pointer"
            onClick={() => setEditing(mod)}
          >
            {mod.icon && (
              <img
                src={mod.icon}
                alt=""
                className="w-8 h-8 rounded shrink-0"
                onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
              />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-sm text-text-primary truncate">{mod.name || <span className="text-text-dim font-normal">（未命名）</span>}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-bg-card border border-border text-text-dim shrink-0">
                  {SLOT_LABEL[mod.slot] ?? mod.slot}
                </span>
                {mod.managedBy === ModuleDataSource.AUTO && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent-cyan/10 text-accent-cyan border border-accent-cyan/30 shrink-0">
                    自動
                  </span>
                )}
                {Array.isArray(mod.source) && mod.source.length > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-bg-card border border-border text-text-dim shrink-0">
                    {mod.source.join('・')}
                  </span>
                )}
                {moduleHasStats(mod) && (
                  <span className="text-[10px] text-accent-green shrink-0">
                    {mod.dmg > 0 && `傷+${mod.dmg}%`}
                    {(mod.crit_rate ?? 0) > 0 && ` 暴+${mod.crit_rate}`}
                    {mod.critDmg > 0 && ` 爆傷+${mod.critDmg}%`}
                    {(mod.acc_rate ?? 0) > 0 && ` 命+${mod.acc_rate}`}
                    {(mod.firepower_rate ?? 0) > 0 && ` 火力+${mod.firepower_rate}%`}
                    {(mod.output_bonus ?? 0) > 0 && ` 出力+${mod.output_bonus}`}
                  </span>
                )}
              </div>
              <p className="text-xs text-text-dim truncate mt-0.5">{mod.description || '（無描述）'}</p>
            </div>
            <div className="text-right shrink-0 ml-2">
              {mod.boundMechId ? (
                <span className="text-[11px] text-accent-orange">
                  {mechs.find((m) => m.id === mod.boundMechId)?.name ?? mod.boundMechId}
                </span>
              ) : (
                <span className="text-[11px] text-text-dim">通用</span>
              )}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="text-text-dim text-sm text-center py-8">找不到符合條件的模組</p>
        )}
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
type EditTab = 'basic' | 'stats' | 'weapon' | 'levels' | 'conditional'

const EDIT_TABS: { id: EditTab; label: string }[] = [
  { id: 'basic',       label: '基本資訊' },
  { id: 'stats',       label: '基本屬性' },
  { id: 'weapon',      label: '武器增傷' },
  { id: 'levels',      label: '等級資料' },
  { id: 'conditional', label: '條件效果' },
]

function ModuleEditPanel({
  module: mod,
  mechs,
  onSave,
  onCancel,
}: {
  module: Module
  mechs: Mech[]
  onSave: (m: Module) => Promise<void>
  onCancel: () => void
}) {
  const [form, setForm] = useState<Module>({ ...mod })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editTab, setEditTab] = useState<EditTab>('basic')

  useEffect(() => {
    setForm({ ...mod })
    setEditTab('basic')
  }, [mod])

  function update<K extends keyof Module>(key: K, value: Module[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSubmit() {
    setSaving(true)
    setError(null)
    try {
      await onSave(form)
    } catch (e) {
      setError(e instanceof Error ? e.message : '儲存失敗，請重試')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-bg-card border border-border rounded-xl p-6 w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* 標題 */}
        <h3 className="text-lg font-bold mb-3 flex items-center gap-2 shrink-0">
          <span className="text-accent-orange">✎</span> 編輯模組
          <span className="text-text-dim text-sm font-normal ml-1">{form.id}</span>
        </h3>

        {/* Tab 列 */}
        <div className="flex gap-1 mb-4 shrink-0 flex-wrap">
          {EDIT_TABS.map((t) => {
            const hasBadge =
              (t.id === 'levels' && (form.levels ?? []).length > 0) ||
              (t.id === 'conditional' && (form.conditionalEffects ?? []).length > 0)
            return (
              <button
                key={t.id}
                onClick={() => setEditTab(t.id)}
                className={`relative px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  editTab === t.id
                    ? 'bg-accent-orange text-black'
                    : 'bg-bg-dark border border-border text-text-secondary hover:text-text-primary'
                }`}
              >
                {t.label}
                {hasBadge && (
                  <span className={`ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold ${editTab === t.id ? 'bg-black/20 text-black' : 'bg-accent-cyan/20 text-accent-cyan'}`}>
                    {t.id === 'levels' ? (form.levels ?? []).length : (form.conditionalEffects ?? []).length}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Tab 內容（可捲動） */}
        <div className="overflow-y-auto flex-1 pr-1">

          {/* ── 基本資訊 ── */}
          {editTab === 'basic' && (
            <div className="space-y-3">
              <Field label="名稱">
                <input
                  value={form.name}
                  onChange={(e) => update('name', e.target.value)}
                  className="input-field"
                />
              </Field>

              <Field label="效果描述">
                <textarea
                  value={form.description}
                  onChange={(e) => update('description', e.target.value)}
                  className="input-field min-h-[80px] resize-y"
                />
              </Field>

              <Field label="模組增加等級 moduleAddLevel（配裝模擬器用，預設 1）">
                <input
                  type="number"
                  min={0}
                  value={form.moduleAddLevel ?? 1}
                  onChange={(e) => update('moduleAddLevel', Number(e.target.value))}
                  className="input-field"
                />
              </Field>

              <Field label="槽位">
                <select
                  value={form.slot}
                  onChange={(e) => update('slot', e.target.value)}
                  className="input-field"
                >
                  {SLOT_OPTIONS.map(({ value, label }) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </Field>

              <Field label="品質">
                <select
                  value={form.rarity}
                  onChange={(e) => update('rarity', e.target.value)}
                  className="input-field"
                >
                  {Object.values(ModuleRarity).map((r) => (
                    <option key={r} value={r}>{r} 級</option>
                  ))}
                </select>
              </Field>

              <Field label="綁定機甲">
                <select
                  value={form.boundMechId ?? ''}
                  onChange={(e) => update('boundMechId', e.target.value || null)}
                  className="input-field"
                >
                  <option value="">不綁定（通用模組）</option>
                  {mechs.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </Field>

              <Field label="綁定部位（複選，空白=不限）">
                <div className="flex flex-wrap gap-4 mt-1">
                  {PART_OPTIONS.map(({ value, label }) => {
                    const parts = Array.isArray(form.boundPart) ? form.boundPart : (form.boundPart ? [form.boundPart as string] : [])
                    const checked = parts.includes(value)
                    return (
                      <label key={value} className="flex items-center gap-1.5 text-sm cursor-pointer hover:text-text-primary">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            const next = checked ? parts.filter((p) => p !== value) : [...parts, value]
                            update('boundPart', next.length > 0 ? next : null)
                          }}
                          className="accent-accent-orange w-3.5 h-3.5"
                        />
                        {label}
                      </label>
                    )
                  })}
                </div>
                {(!form.boundPart || (Array.isArray(form.boundPart) && form.boundPart.length === 0)) && (
                  <p className="text-[11px] text-text-dim mt-1">不限部位</p>
                )}
              </Field>

              <Field label="遊戲取得途徑（複選）">
                <div className="flex flex-wrap gap-4 mt-1">
                  {Object.values(ModuleSource).map((v) => {
                    const sources = Array.isArray(form.source) ? form.source : (form.source ? [form.source as string] : [])
                    const checked = sources.includes(v)
                    return (
                      <label key={v} className="flex items-center gap-1.5 text-sm cursor-pointer hover:text-text-primary">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            let next = checked ? sources.filter((s) => s !== v) : [...sources, v]
                            if (next.some((s) => s !== ModuleSource.UNKNOWN)) {
                              next = next.filter((s) => s !== ModuleSource.UNKNOWN)
                            }
                            update('source', next)
                          }}
                          className="accent-accent-orange w-3.5 h-3.5"
                        />
                        {v}
                      </label>
                    )
                  })}
                </div>
              </Field>

              <Field label="拆解來源機甲（可拆哪些機甲取得此模組）">
                <div className="mt-1 border border-border rounded-lg max-h-44 overflow-y-auto divide-y divide-border/40">
                  {mechs.length === 0 ? (
                    <p className="text-xs text-text-dim p-2">載入機甲中...</p>
                  ) : (
                    mechs.map((m) => {
                      const ids = form.dismantleMechIds ?? []
                      const checked = ids.includes(m.id)
                      return (
                        <label key={m.id} className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-bg-dark/60">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              const next = checked ? ids.filter((id) => id !== m.id) : [...ids, m.id]
                              update('dismantleMechIds', next)
                            }}
                            className="accent-accent-orange w-3.5 h-3.5 shrink-0"
                          />
                          <span className="text-sm text-text-secondary flex-1">{m.name}</span>
                          <span className="text-[10px] text-text-dim shrink-0">{m.id}</span>
                        </label>
                      )
                    })
                  )}
                </div>
                {(form.dismantleMechIds ?? []).length > 0 && (
                  <p className="text-[11px] text-accent-cyan mt-1">
                    已選：{(form.dismantleMechIds ?? []).map((id) => mechs.find((m) => m.id === id)?.name ?? id).join('、')}
                  </p>
                )}
              </Field>

              <Field label="資料維護標記">
                <select
                  value={form.managedBy ?? ModuleDataSource.MANUAL}
                  onChange={(e) => update('managedBy', e.target.value)}
                  className="input-field"
                >
                  <option value={ModuleDataSource.MANUAL}>手動新增 (manual)</option>
                  <option value={ModuleDataSource.AUTO}>腳本自動擷取 (auto)</option>
                </select>
              </Field>
            </div>
          )}

          {/* ── 基本屬性 ── */}
          {editTab === 'stats' && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="增傷 (%)">
                <input type="number" value={form.dmg} onChange={(e) => update('dmg', Number(e.target.value))} className="input-field" />
              </Field>
              <Field label="暴擊率">
                <input type="number" value={form.crit_rate ?? 0} onChange={(e) => update('crit_rate', Number(e.target.value))} className="input-field" />
              </Field>
              <Field label="暴擊傷害 (%)">
                <input type="number" value={form.critDmg} onChange={(e) => update('critDmg', Number(e.target.value))} className="input-field" />
              </Field>
              <Field label="命中率">
                <input type="number" value={form.acc_rate ?? 0} onChange={(e) => update('acc_rate', Number(e.target.value))} className="input-field" />
              </Field>
              <Field label="火力提升 (%)">
                <input type="number" value={form.firepower_rate ?? 0} onChange={(e) => update('firepower_rate', Number(e.target.value))} className="input-field" />
              </Field>
              <Field label="護甲提升 (%)">
                <input type="number" value={form.armor_rate ?? 0} onChange={(e) => update('armor_rate', Number(e.target.value))} className="input-field" />
              </Field>
              <Field label="機甲出力增加">
                <input type="number" value={form.output_bonus ?? 0} onChange={(e) => update('output_bonus', Number(e.target.value))} className="input-field" />
              </Field>
              <Field label="被暴擊率降低 (%)">
                <input type="number" value={form.crit_resist_rate ?? 0} onChange={(e) => update('crit_resist_rate', Number(e.target.value))} className="input-field" />
              </Field>
              <Field label="回避率 (%)">
                <input type="number" value={form.dodge_rate ?? 0} onChange={(e) => update('dodge_rate', Number(e.target.value))} className="input-field" />
              </Field>
              <Field label="耐久值提升 (%)">
                <input type="number" value={form.durable_rate ?? 0} onChange={(e) => update('durable_rate', Number(e.target.value))} className="input-field" />
              </Field>
              <Field label="遭受傷害降低 (%)">
                <input type="number" value={form.dmg_resist_rate ?? 0} onChange={(e) => update('dmg_resist_rate', Number(e.target.value))} className="input-field" />
              </Field>
            </div>
          )}

          {/* ── 武器增傷 ── */}
          {editTab === 'weapon' && (
            <div className="space-y-4">
              <div>
                <p className="text-xs text-text-dim font-medium tracking-wider uppercase mb-2">大分類增傷 (%)</p>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="突擊武器增傷"><input type="number" value={form.dmg_assault ?? 0} onChange={(e) => update('dmg_assault', Number(e.target.value))} className="input-field" /></Field>
                  <Field label="格鬥武器增傷"><input type="number" value={form.dmg_melee ?? 0} onChange={(e) => update('dmg_melee', Number(e.target.value))} className="input-field" /></Field>
                  <Field label="射擊武器增傷"><input type="number" value={form.dmg_shooting ?? 0} onChange={(e) => update('dmg_shooting', Number(e.target.value))} className="input-field" /></Field>
                  <Field label="戰術武器增傷"><input type="number" value={form.dmg_tactical ?? 0} onChange={(e) => update('dmg_tactical', Number(e.target.value))} className="input-field" /></Field>
                </div>
              </div>
              <div className="pt-2 border-t border-border/60">
                <p className="text-xs text-text-dim font-medium tracking-wider uppercase mb-2">突擊細分 (%)</p>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="機槍增傷"><input type="number" value={form.dmg_machinegun ?? 0} onChange={(e) => update('dmg_machinegun', Number(e.target.value))} className="input-field" /></Field>
                  <Field label="重機槍增傷"><input type="number" value={form.dmg_heavy_machinegun ?? 0} onChange={(e) => update('dmg_heavy_machinegun', Number(e.target.value))} className="input-field" /></Field>
                  <Field label="霰彈增傷"><input type="number" value={form.dmg_shotgun ?? 0} onChange={(e) => update('dmg_shotgun', Number(e.target.value))} className="input-field" /></Field>
                  <Field label="噴火器增傷"><input type="number" value={form.dmg_flamethrower ?? 0} onChange={(e) => update('dmg_flamethrower', Number(e.target.value))} className="input-field" /></Field>
                </div>
              </div>
              <div className="pt-2 border-t border-border/60">
                <p className="text-xs text-text-dim font-medium tracking-wider uppercase mb-2">格鬥細分 (%)</p>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="刀劍增傷"><input type="number" value={form.dmg_blade ?? 0} onChange={(e) => update('dmg_blade', Number(e.target.value))} className="input-field" /></Field>
                  <Field label="長柄增傷"><input type="number" value={form.dmg_polearm ?? 0} onChange={(e) => update('dmg_polearm', Number(e.target.value))} className="input-field" /></Field>
                  <Field label="拳套增傷"><input type="number" value={form.dmg_fist ?? 0} onChange={(e) => update('dmg_fist', Number(e.target.value))} className="input-field" /></Field>
                  <Field label="打樁機增傷"><input type="number" value={form.dmg_pile ?? 0} onChange={(e) => update('dmg_pile', Number(e.target.value))} className="input-field" /></Field>
                  <Field label="電鋸增傷"><input type="number" value={form.dmg_chainsaw ?? 0} onChange={(e) => update('dmg_chainsaw', Number(e.target.value))} className="input-field" /></Field>
                </div>
              </div>
              <div className="pt-2 border-t border-border/60">
                <p className="text-xs text-text-dim font-medium tracking-wider uppercase mb-2">射擊細分 (%)</p>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="輕型狙擊步槍增傷"><input type="number" value={form.dmg_sniper_light ?? 0} onChange={(e) => update('dmg_sniper_light', Number(e.target.value))} className="input-field" /></Field>
                  <Field label="狙擊步槍增傷"><input type="number" value={form.dmg_sniper ?? 0} onChange={(e) => update('dmg_sniper', Number(e.target.value))} className="input-field" /></Field>
                </div>
              </div>
              <div className="pt-2 border-t border-border/60">
                <p className="text-xs text-text-dim font-medium tracking-wider uppercase mb-2">戰術細分 (%)</p>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="導彈增傷"><input type="number" value={form.dmg_missile ?? 0} onChange={(e) => update('dmg_missile', Number(e.target.value))} className="input-field" /></Field>
                  <Field label="火箭增傷"><input type="number" value={form.dmg_rocket ?? 0} onChange={(e) => update('dmg_rocket', Number(e.target.value))} className="input-field" /></Field>
                  <Field label="電磁炮增傷"><input type="number" value={form.dmg_railgun ?? 0} onChange={(e) => update('dmg_railgun', Number(e.target.value))} className="input-field" /></Field>
                  <Field label="浮游炮增傷"><input type="number" value={form.dmg_funnel ?? 0} onChange={(e) => update('dmg_funnel', Number(e.target.value))} className="input-field" /></Field>
                </div>
              </div>
              <div className="pt-2 border-t border-border/60">
                <p className="text-xs text-text-dim font-medium tracking-wider uppercase mb-2">其他觸發增傷 (%)</p>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="反擊增傷"><input type="number" value={form.dmg_counter ?? 0} onChange={(e) => update('dmg_counter', Number(e.target.value))} className="input-field" /></Field>
                  <Field label="敵方階段增傷"><input type="number" value={form.dmg_enemy_phase ?? 0} onChange={(e) => update('dmg_enemy_phase', Number(e.target.value))} className="input-field" /></Field>
                </div>
              </div>
            </div>
          )}

          {/* ── 等級資料 ── */}
          {editTab === 'levels' && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-text-dim font-medium tracking-wider uppercase">
                  模組等級 levels
                </span>
                <button
                  onClick={() =>
                    update('levels', [
                      ...(form.levels ?? []),
                      {
                        level: (form.levels?.length ?? 0) + 1,
                        description: '',
                        dmg: 0, crit_rate: 0, critDmg: 0, acc_rate: 0,
                        firepower_rate: 0, armor_rate: 0, crit_resist_rate: 0,
                        output_bonus: 0, dodge_rate: 0, durable_rate: 0, dmg_resist_rate: 0,
                      },
                    ])
                  }
                  className="text-xs text-accent-cyan hover:text-accent-cyan/80 transition-colors"
                >
                  + 新增等級
                </button>
              </div>
              {(form.levels ?? []).length === 0 ? (
                <p className="text-xs text-text-dim py-4 text-center">無等級資料</p>
              ) : (
                <div className="space-y-2">
                  {(form.levels ?? []).map((lv, idx) => (
                    <ModuleLevelItem
                      key={idx}
                      levelData={lv}
                      index={idx}
                      onChange={(updated) => {
                        const arr = [...(form.levels ?? [])]
                        arr[idx] = updated
                        update('levels', arr)
                      }}
                      onRemove={() =>
                        update('levels', (form.levels ?? []).filter((_, i) => i !== idx))
                      }
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── 條件效果 ── */}
          {editTab === 'conditional' && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-text-dim font-medium tracking-wider uppercase">
                  條件效果 conditionalEffects
                </span>
                <button
                  onClick={() =>
                    update('conditionalEffects', [
                      ...(form.conditionalEffects ?? []),
                      { trigger: ConditionalTrigger.PER_BUFF_HELD, stats: [] },
                    ])
                  }
                  className="text-xs text-accent-cyan hover:text-accent-cyan/80 transition-colors"
                >
                  + 新增條件效果
                </button>
              </div>
              {(form.conditionalEffects ?? []).length === 0 ? (
                <p className="text-xs text-text-dim py-4 text-center">無條件效果</p>
              ) : (
                <div className="space-y-3">
                  {(form.conditionalEffects ?? []).map((ce, idx) => (
                    <ConditionalEffectItem
                      key={idx}
                      effect={ce}
                      index={idx}
                      onChange={(updated) => {
                        const arr = [...(form.conditionalEffects ?? [])]
                        arr[idx] = updated
                        update('conditionalEffects', arr)
                      }}
                      onRemove={() =>
                        update('conditionalEffects', (form.conditionalEffects ?? []).filter((_, i) => i !== idx))
                      }
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {error && (
          <p className="text-xs text-accent-red mt-3 shrink-0">⚠ {error}</p>
        )}

        <div className="flex gap-3 mt-4 shrink-0">
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex-1 px-4 py-2 bg-accent-orange text-black font-bold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {saving ? '儲存中...' : '儲存變更'}
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

// ─── 條件效果項目（ConditionalEffect 編輯）────────────────────────────────
function ConditionalEffectItem({
  effect,
  index,
  onChange,
  onRemove,
}: {
  effect: ConditionalEffect
  index: number
  onChange: (updated: ConditionalEffect) => void
  onRemove: () => void
}) {
  function upd<K extends keyof ConditionalEffect>(key: K, value: ConditionalEffect[K]) {
    onChange({ ...effect, [key]: value })
  }

  function toggleStat(stat: string) {
    const next = effect.stats.includes(stat)
      ? effect.stats.filter((s) => s !== stat)
      : [...effect.stats, stat]
    upd('stats', next)
  }

  return (
    <div className="border border-border/60 rounded-lg p-3 space-y-2.5 bg-bg-dark/50">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-text-dim font-medium">條件效果 #{index + 1}</span>
        <button
          onClick={onRemove}
          className="text-[10px] px-1.5 py-0.5 text-accent-red border border-accent-red/30 rounded hover:bg-accent-red/10"
        >
          ✕ 移除
        </button>
      </div>

      <Field label="觸發類型 trigger">
        <select
          value={effect.trigger}
          onChange={(e) => upd('trigger', e.target.value)}
          className="input-field"
        >
          {Object.values(ConditionalTrigger).map((v) => (
            <option key={v} value={v}>{TRIGGER_LABEL[v] ?? v}</option>
          ))}
        </select>
      </Field>

      <div className="grid grid-cols-2 gap-2">
        <Field label="觸發門檻 minCount（選填）">
          <input
            type="number"
            value={effect.minCount ?? ''}
            onChange={(e) => upd('minCount', e.target.value === '' ? undefined : Number(e.target.value))}
            className="input-field"
            placeholder="—"
          />
        </Field>
        <Field label="重置時機 resetOn">
          <select
            value={effect.resetOn ?? ''}
            onChange={(e) => upd('resetOn', (e.target.value || null) as ConditionalEffect['resetOn'])}
            className="input-field"
          >
            <option value="">不重置 (null)</option>
            <option value="attack">每次攻擊後 (attack)</option>
            <option value="turn">回合結束 (turn)</option>
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Field label="基礎加成 base（選填）">
          <input
            type="number"
            value={effect.base ?? ''}
            onChange={(e) => upd('base', e.target.value === '' ? undefined : Number(e.target.value))}
            className="input-field"
            placeholder="—"
          />
        </Field>
        <Field label="每單位追加 scale（選填）">
          <input
            type="number"
            value={effect.scale ?? ''}
            onChange={(e) => upd('scale', e.target.value === '' ? undefined : Number(e.target.value))}
            className="input-field"
            placeholder="—"
          />
        </Field>
        <Field label="總加成上限 max（選填）">
          <input
            type="number"
            value={effect.max ?? ''}
            onChange={(e) => upd('max', e.target.value === '' ? undefined : Number(e.target.value))}
            className="input-field"
            placeholder="—"
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Field label="最大疊加 maxStacks（選填）">
          <input
            type="number"
            value={effect.maxStacks ?? ''}
            onChange={(e) => upd('maxStacks', e.target.value === '' ? undefined : Number(e.target.value))}
            className="input-field"
            placeholder="—"
          />
        </Field>
        <Field label="持續回合 duration（選填，null=永久）">
          <input
            type="number"
            value={effect.duration ?? ''}
            onChange={(e) => upd('duration', e.target.value === '' ? undefined : Number(e.target.value))}
            className="input-field"
            placeholder="— (永久)"
          />
        </Field>
      </div>

      <Field label="影響屬性 stats">
        <div className="grid grid-cols-2 gap-y-1 gap-x-2 mt-1">
          {STAT_OPTIONS.map(({ key, label }) => (
            <label
              key={key}
              className="flex items-center gap-1.5 text-[11px] text-text-secondary cursor-pointer hover:text-text-primary"
            >
              <input
                type="checkbox"
                checked={effect.stats.includes(key)}
                onChange={() => toggleStat(key)}
                className="accent-accent-orange w-3 h-3"
              />
              {label}
            </label>
          ))}
        </div>
      </Field>
    </div>
  )
}

// ─── 模組等級項目（ModuleLevel 編輯）─────────────────────────────────────
function ModuleLevelItem({
  levelData,
  index,
  onChange,
  onRemove,
}: {
  levelData: ModuleLevel
  index: number
  onChange: (updated: ModuleLevel) => void
  onRemove: () => void
}) {
  const [collapsed, setCollapsed] = useState(index > 0)

  function upd<K extends keyof ModuleLevel>(key: K, value: ModuleLevel[K]) {
    onChange({ ...levelData, [key]: value })
  }

  return (
    <div className="border border-border/60 rounded-lg bg-bg-dark/50">
      <div
        className="flex items-center gap-2 px-3 py-2 cursor-pointer select-none"
        onClick={() => setCollapsed(!collapsed)}
      >
        <span className="text-[10px] text-text-dim w-3">{collapsed ? '▶' : '▼'}</span>
        <span className="text-[11px] text-text-dim font-medium flex-1 truncate">
          Lv.{levelData.level}
          {levelData.description && (
            <span className="ml-2 text-text-secondary font-normal">
              {levelData.description.slice(0, 40)}
            </span>
          )}
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); onRemove() }}
          className="text-[10px] px-1.5 py-0.5 text-accent-red border border-accent-red/30 rounded hover:bg-accent-red/10 shrink-0"
        >
          ✕ 移除
        </button>
      </div>

      {!collapsed && (
        <div className="px-3 pb-3 border-t border-border/40 pt-2.5 space-y-2.5">
          <div className="grid grid-cols-2 gap-2">
            <Field label="等級 level">
              <input
                type="number"
                value={levelData.level}
                onChange={(e) => upd('level', Number(e.target.value))}
                className="input-field"
              />
            </Field>
            <Field label="效果描述 description">
              <input
                type="text"
                value={levelData.description}
                onChange={(e) => upd('description', e.target.value)}
                className="input-field"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Field label="增傷 (%)">
              <input type="number" value={levelData.dmg} onChange={(e) => upd('dmg', Number(e.target.value))} className="input-field" />
            </Field>
            <Field label="暴擊率">
              <input type="number" value={levelData.crit_rate} onChange={(e) => upd('crit_rate', Number(e.target.value))} className="input-field" />
            </Field>
            <Field label="暴擊傷害 (%)">
              <input type="number" value={levelData.critDmg} onChange={(e) => upd('critDmg', Number(e.target.value))} className="input-field" />
            </Field>
            <Field label="命中率">
              <input type="number" value={levelData.acc_rate} onChange={(e) => upd('acc_rate', Number(e.target.value))} className="input-field" />
            </Field>
            <Field label="火力 (%)">
              <input type="number" value={levelData.firepower_rate} onChange={(e) => upd('firepower_rate', Number(e.target.value))} className="input-field" />
            </Field>
            <Field label="護甲 (%)">
              <input type="number" value={levelData.armor_rate} onChange={(e) => upd('armor_rate', Number(e.target.value))} className="input-field" />
            </Field>
            <Field label="機甲出力">
              <input type="number" value={levelData.output_bonus} onChange={(e) => upd('output_bonus', Number(e.target.value))} className="input-field" />
            </Field>
            <Field label="被暴擊降低">
              <input type="number" value={levelData.crit_resist_rate} onChange={(e) => upd('crit_resist_rate', Number(e.target.value))} className="input-field" />
            </Field>
            <Field label="回避率 (%)">
              <input type="number" value={levelData.dodge_rate} onChange={(e) => upd('dodge_rate', Number(e.target.value))} className="input-field" />
            </Field>
            <Field label="耐久 (%)">
              <input type="number" value={levelData.durable_rate} onChange={(e) => upd('durable_rate', Number(e.target.value))} className="input-field" />
            </Field>
            <Field label="傷害降低 (%)">
              <input type="number" value={levelData.dmg_resist_rate} onChange={(e) => upd('dmg_resist_rate', Number(e.target.value))} className="input-field" />
            </Field>
          </div>

          <div className="pt-2 border-t border-border/40">
            <p className="text-[10px] text-text-dim font-medium tracking-wider uppercase mb-2">武器專屬增傷 (%)</p>
            <div className="grid grid-cols-2 gap-2">
              <Field label="突擊"><input type="number" value={levelData.dmg_assault ?? 0} onChange={(e) => upd('dmg_assault', Number(e.target.value))} className="input-field" /></Field>
              <Field label="格鬥"><input type="number" value={levelData.dmg_melee ?? 0} onChange={(e) => upd('dmg_melee', Number(e.target.value))} className="input-field" /></Field>
              <Field label="射擊"><input type="number" value={levelData.dmg_shooting ?? 0} onChange={(e) => upd('dmg_shooting', Number(e.target.value))} className="input-field" /></Field>
              <Field label="戰術"><input type="number" value={levelData.dmg_tactical ?? 0} onChange={(e) => upd('dmg_tactical', Number(e.target.value))} className="input-field" /></Field>
              <Field label="刀劍"><input type="number" value={levelData.dmg_blade ?? 0} onChange={(e) => upd('dmg_blade', Number(e.target.value))} className="input-field" /></Field>
              <Field label="長柄"><input type="number" value={levelData.dmg_polearm ?? 0} onChange={(e) => upd('dmg_polearm', Number(e.target.value))} className="input-field" /></Field>
              <Field label="導彈"><input type="number" value={levelData.dmg_missile ?? 0} onChange={(e) => upd('dmg_missile', Number(e.target.value))} className="input-field" /></Field>
              <Field label="火箭"><input type="number" value={levelData.dmg_rocket ?? 0} onChange={(e) => upd('dmg_rocket', Number(e.target.value))} className="input-field" /></Field>
              <Field label="霰彈"><input type="number" value={levelData.dmg_shotgun ?? 0} onChange={(e) => upd('dmg_shotgun', Number(e.target.value))} className="input-field" /></Field>
              <Field label="機槍"><input type="number" value={levelData.dmg_machinegun ?? 0} onChange={(e) => upd('dmg_machinegun', Number(e.target.value))} className="input-field" /></Field>
              <Field label="重機槍"><input type="number" value={levelData.dmg_heavy_machinegun ?? 0} onChange={(e) => upd('dmg_heavy_machinegun', Number(e.target.value))} className="input-field" /></Field>
              <Field label="電磁炮"><input type="number" value={levelData.dmg_railgun ?? 0} onChange={(e) => upd('dmg_railgun', Number(e.target.value))} className="input-field" /></Field>
              <Field label="浮游炮"><input type="number" value={levelData.dmg_funnel ?? 0} onChange={(e) => upd('dmg_funnel', Number(e.target.value))} className="input-field" /></Field>
              <Field label="輕狙"><input type="number" value={levelData.dmg_sniper_light ?? 0} onChange={(e) => upd('dmg_sniper_light', Number(e.target.value))} className="input-field" /></Field>
              <Field label="狙擊步槍"><input type="number" value={levelData.dmg_sniper ?? 0} onChange={(e) => upd('dmg_sniper', Number(e.target.value))} className="input-field" /></Field>
              <Field label="拳套"><input type="number" value={levelData.dmg_fist ?? 0} onChange={(e) => upd('dmg_fist', Number(e.target.value))} className="input-field" /></Field>
              <Field label="打樁機"><input type="number" value={levelData.dmg_pile ?? 0} onChange={(e) => upd('dmg_pile', Number(e.target.value))} className="input-field" /></Field>
              <Field label="電鋸"><input type="number" value={levelData.dmg_chainsaw ?? 0} onChange={(e) => upd('dmg_chainsaw', Number(e.target.value))} className="input-field" /></Field>
              <Field label="噴火器"><input type="number" value={levelData.dmg_flamethrower ?? 0} onChange={(e) => upd('dmg_flamethrower', Number(e.target.value))} className="input-field" /></Field>
              <Field label="反擊"><input type="number" value={levelData.dmg_counter ?? 0} onChange={(e) => upd('dmg_counter', Number(e.target.value))} className="input-field" /></Field>
              <Field label="敵方階段"><input type="number" value={levelData.dmg_enemy_phase ?? 0} onChange={(e) => upd('dmg_enemy_phase', Number(e.target.value))} className="input-field" /></Field>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── 機甲管理分頁 ──────────────────────────────────────────────────────
function MechAdmin({
  mechs,
  modules,
  onMechSave,
}: {
  mechs: Mech[]
  modules: Module[]
  onMechSave: (updated: Mech) => Promise<void>
}) {
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [editing, setEditing] = useState<Mech | null>(null)

  const armorTypes = useMemo(
    () => ['all', ...Array.from(new Set(mechs.map((m) => m.armorType)))],
    [mechs]
  )

  const filtered = useMemo(() => {
    return mechs.filter((m) => {
      const matchSearch = !search || m.name.includes(search) || m.id.includes(search)
      const matchType = filterType === 'all' || m.armorType === filterType
      return matchSearch && matchType
    })
  }, [mechs, search, filterType])

  async function handleSave(updated: Mech) {
    await onMechSave(updated)
    setEditing(null)
  }

  return (
    <div>
      <div className="flex flex-wrap gap-3 mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜尋機甲名稱..."
          className="flex-1 min-w-[200px] px-3 py-2 rounded-lg bg-bg-dark border border-border text-text-primary text-sm focus:outline-none focus:border-accent-orange"
        />
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="px-3 py-2 rounded-lg bg-bg-dark border border-border text-text-primary text-sm"
        >
          {armorTypes.map((t) => (
            <option key={t} value={t}>
              {t === 'all' ? '全部類型' : t}
            </option>
          ))}
        </select>
      </div>

      <p className="text-text-dim text-xs mb-3">
        共 {filtered.length} / {mechs.length} 台機甲
      </p>

      <div className="space-y-1.5 max-h-[600px] overflow-y-auto pr-1">
        {filtered.map((mech) => {
          const mod4 = modules.find((m) => m.id === mech.module4Id)
          const mod8 = modules.find((m) => m.id === mech.module8Id)
          const fixedMods = (mech.moduleFixedIds ?? [])
            .map((id) => modules.find((m) => m.id === id))
            .filter(Boolean)

          const hasMissingModule =
            (mech.module4Id && !mod4) ||
            (mech.module8Id && !mod8) ||
            (mech.moduleFixedIds ?? []).some((id) => !modules.find((m) => m.id === id))

          return (
            <div
              key={mech.id}
              className={`bg-bg-dark border rounded-lg px-3 py-2.5 hover:border-border-accent transition-colors cursor-pointer ${hasMissingModule ? 'border-accent-red/40' : 'border-border'}`}
              onClick={() => setEditing(mech)}
            >
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm">{mech.name}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded border border-border text-text-dim shrink-0">
                      {mech.armorType}
                    </span>
                    {hasMissingModule && (
                      <span className="text-[10px] text-accent-red shrink-0">⚠ 模組未對應</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                    <span className="text-[11px] text-accent-cyan">
                      四模: {mod4 ? mod4.name : <span className="text-text-dim">（未設定）</span>}
                    </span>
                    <span className="text-[11px] text-accent-orange">
                      八模: {mod8 ? mod8.name : <span className="text-text-dim">（未設定）</span>}
                    </span>
                    {fixedMods.length > 0 && (
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
        {filtered.length === 0 && (
          <p className="text-text-dim text-sm text-center py-8">找不到符合條件的機甲</p>
        )}
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
  onSave: (m: Mech) => Promise<void>
  onCancel: () => void
}) {
  const [form, setForm] = useState<Mech>({ ...mech })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setForm({ ...mech })
  }, [mech])

  const availableModules = useMemo(
    () => modules.filter((m) => m.boundMechId === form.id || !m.boundMechId),
    [modules, form.id]
  )

  const mod4Options = availableModules.filter((m) => m.slot === ModuleSlot.SLOT_4)
  const mod8Options = availableModules.filter((m) => m.slot === ModuleSlot.SLOT_8)
  const fixedOptions = availableModules.filter((m) => m.slot === ModuleSlot.BUILT_IN)

  async function handleSubmit() {
    setSaving(true)
    setError(null)
    try {
      await onSave(form)
    } catch (e) {
      setError(e instanceof Error ? e.message : '儲存失敗，請重試')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-bg-card border border-border rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
          <span className="text-accent-orange">⚙</span> 機甲模組配置
          <span className="text-text-secondary text-sm font-normal ml-1">{form.name}</span>
        </h3>

        <div className="space-y-4">
          <Field label="四格模組 (4mod)">
            <select
              value={form.module4Id ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, module4Id: e.target.value }))}
              className="input-field"
            >
              <option value="">（未設定）</option>
              {mod4Options.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            {form.module4Id && !mod4Options.find((m) => m.id === form.module4Id) && (
              <p className="text-xs text-accent-red mt-1">⚠ 目前設定的模組 ID 不在列表中：{form.module4Id}</p>
            )}
          </Field>

          <Field label="八格模組 (8mod)">
            <select
              value={form.module8Id ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, module8Id: e.target.value }))}
              className="input-field"
            >
              <option value="">（未設定）</option>
              {mod8Options.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            {form.module8Id && !mod8Options.find((m) => m.id === form.module8Id) && (
              <p className="text-xs text-accent-red mt-1">⚠ 目前設定的模組 ID 不在列表中：{form.module8Id}</p>
            )}
          </Field>

          <Field label="固定模組">
            <div className="space-y-2">
              {(form.moduleFixedIds ?? []).map((fixedId, idx) => (
                <div key={idx} className="flex gap-2">
                  <select
                    value={fixedId}
                    onChange={(e) => {
                      const newIds = [...(form.moduleFixedIds ?? [])]
                      newIds[idx] = e.target.value
                      setForm((f) => ({ ...f, moduleFixedIds: newIds }))
                    }}
                    className="input-field flex-1"
                  >
                    <option value="">（未設定）</option>
                    {fixedOptions.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => {
                      const newIds = (form.moduleFixedIds ?? []).filter((_, i) => i !== idx)
                      setForm((f) => ({ ...f, moduleFixedIds: newIds }))
                    }}
                    className="px-2 py-1 text-accent-red border border-accent-red/30 rounded hover:bg-accent-red/10 text-xs shrink-0"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    moduleFixedIds: [...(f.moduleFixedIds ?? []), ''],
                  }))
                }
                className="text-xs text-accent-cyan hover:text-accent-cyan/80 transition-colors"
              >
                + 新增固定模組欄位
              </button>
            </div>
          </Field>
        </div>

        {error && (
          <p className="text-xs text-accent-red mt-3">⚠ {error}</p>
        )}

        <div className="flex gap-3 mt-6">
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex-1 px-4 py-2 bg-accent-orange text-black font-bold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {saving ? '儲存中...' : '儲存變更'}
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

// ─── 共用元件 ──────────────────────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs text-text-dim mb-1 block">{label}</label>
      {children}
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

// ─── 用戶管理分頁 ──────────────────────────────────────────────────────────
function UserAdmin({ currentUid }: { currentUid: string }) {
  const [users, setUsers] = useState<UserProfile[]>([])
  const [usersLoading, setUsersLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updatingUid, setUpdatingUid] = useState<string | null>(null)

  useEffect(() => {
    getAllUsers()
      .then(setUsers)
      .catch((e: unknown) =>
        setError(
          e instanceof Error
            ? e.message
            : '載入用戶失敗（請確認 Firestore 規則允許管理者讀取 users 集合群組）'
        )
      )
      .finally(() => setUsersLoading(false))
  }, [])

  async function handleToggleRole(uid: string, current: 'USER' | 'ADMIN') {
    if (uid === currentUid) return
    const next: 'USER' | 'ADMIN' = current === 'ADMIN' ? 'USER' : 'ADMIN'
    setUpdatingUid(uid)
    try {
      await updateUserRole(uid, next)
      setUsers((prev) => prev.map((u) => (u.uid === uid ? { ...u, role: next } : u)))
    } catch (e) {
      setError(e instanceof Error ? e.message : '更新失敗')
    } finally {
      setUpdatingUid(null)
    }
  }

  if (usersLoading) return <p className="text-text-dim text-sm">載入用戶列表...</p>
  if (error) return <p className="text-accent-red text-sm">⚠ {error}</p>

  return (
    <div>
      <p className="text-text-dim text-xs mb-4">共 {users.length} 位用戶</p>
      <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
        {users.map((u) => (
          <div
            key={u.uid}
            className="bg-bg-dark border border-border rounded-lg px-4 py-3 flex items-center gap-3"
          >
            <div className="w-9 h-9 rounded-full bg-accent-orange/20 border border-accent-orange/30 flex items-center justify-center text-sm font-bold text-accent-orange shrink-0">
              {(u.displayName?.[0] ?? u.email?.[0] ?? '?').toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-text-primary truncate">
                  {u.displayName || '（未設定）'}
                </span>
                {u.uid === currentUid && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent-cyan/10 text-accent-cyan border border-accent-cyan/30 shrink-0">
                    你
                  </span>
                )}
              </div>
              <p className="text-xs text-text-dim truncate">{u.email}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span
                className={`text-[11px] px-2 py-0.5 rounded border font-medium ${
                  u.role === 'ADMIN'
                    ? 'text-accent-orange bg-accent-orange/10 border-accent-orange/30'
                    : 'text-text-dim bg-bg-card border-border'
                }`}
              >
                {u.role}
              </span>
              {u.uid !== currentUid && (
                <button
                  onClick={() => handleToggleRole(u.uid, u.role)}
                  disabled={updatingUid === u.uid}
                  className="text-xs px-2 py-1 rounded border border-border text-text-secondary hover:border-border-accent hover:text-text-primary transition-colors disabled:opacity-40"
                >
                  {updatingUid === u.uid ? '...' : u.role === 'ADMIN' ? '降為 USER' : '升為 ADMIN'}
                </button>
              )}
            </div>
          </div>
        ))}
        {users.length === 0 && (
          <p className="text-text-dim text-sm text-center py-8">找不到用戶資料</p>
        )}
      </div>
    </div>
  )
}

// ─── 主頁面 ──────────────────────────────────────────────────────────────
export default function AdminPage() {
  const { user, userProfile, loading: authLoading } = useAuth()
  const [tab, setTab] = useState<'modules' | 'mechs' | 'users'>('modules')
  const [modules, setModules] = useState<Module[]>([])
  const [mechs, setMechs] = useState<Mech[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([getModules(), getMechs()])
      .then(([mods, m]) => {
        setModules(mods)
        setMechs(m)
      })
      .catch((e: unknown) => setLoadError(e instanceof Error ? e.message : '載入失敗'))
      .finally(() => setLoading(false))
  }, [])

  async function handleModuleSave(updated: Module) {
    await updateModule(updated)
    setModules((prev) => {
      const exists = prev.some((m) => m.id === updated.id)
      return exists ? prev.map((m) => (m.id === updated.id ? updated : m)) : [...prev, updated]
    })
  }

  async function handleMechSave(updated: Mech) {
    await updateMech(updated)
    setMechs((prev) => prev.map((m) => (m.id === updated.id ? updated : m)))
  }

  if (authLoading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-12">
        <p className="text-text-dim">驗證中...</p>
      </div>
    )
  }

  if (!user || userProfile?.role !== 'ADMIN') {
    return (
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="bg-bg-card border border-border rounded-xl p-10 text-center">
          <div className="text-5xl mb-4">🔒</div>
          <h2 className="text-xl font-bold mb-2">無存取權限</h2>
          <p className="text-text-dim text-sm">此頁面僅限管理者使用。</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-12">
        <p className="text-text-dim">載入中...</p>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-12">
        <p className="text-accent-red">載入失敗：{loadError}</p>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <div className="mb-8">
        <span className="text-xs text-accent-orange tracking-[3px] uppercase font-[Orbitron,sans-serif]">
          Admin
        </span>
        <h1 className="text-3xl font-bold mt-2">管理後台</h1>
        <p className="text-text-secondary mt-2 text-sm">
          維護模組數值、機甲模組綁定、用戶權限。儲存後直接更新 Firestore，無需手動匯出。
        </p>
      </div>

      {/* 分頁標籤 */}
      <div className="flex gap-2 mb-6 flex-wrap">
        <TabButton active={tab === 'modules'} onClick={() => setTab('modules')}>
          模組管理
        </TabButton>
        <TabButton active={tab === 'mechs'} onClick={() => setTab('mechs')}>
          機甲管理
        </TabButton>
        <TabButton active={tab === 'users'} onClick={() => setTab('users')}>
          用戶管理
        </TabButton>
      </div>

      {/* 分頁內容 */}
      <div className="bg-bg-card border border-border rounded-xl p-6">
        {tab === 'modules' && (
          <ModuleAdmin
            modules={modules}
            mechs={mechs}
            onModuleSave={handleModuleSave}
          />
        )}
        {tab === 'mechs' && (
          <MechAdmin
            mechs={mechs}
            modules={modules}
            onMechSave={handleMechSave}
          />
        )}
        {tab === 'users' && <UserAdmin currentUid={user.uid} />}
      </div>

      {/* 統計資訊 */}
      {tab !== 'users' && (
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: '模組總數', value: modules.length, color: 'text-accent-cyan' },
            { label: '已綁定', value: modules.filter((m) => m.boundMechId).length, color: 'text-accent-orange' },
            { label: '已填數值', value: modules.filter((m) => m.dmg > 0 || (m.crit_rate ?? 0) > 0 || m.critDmg > 0 || (m.acc_rate ?? 0) > 0 || (m.firepower_rate ?? 0) > 0 || (m.output_bonus ?? 0) > 0).length, color: 'text-accent-green' },
            { label: '機甲總數', value: mechs.length, color: 'text-accent-purple' },
          ].map((stat) => (
            <div key={stat.label} className="bg-bg-card border border-border rounded-lg p-3 text-center">
              <div className={`text-2xl font-bold font-[Orbitron,sans-serif] ${stat.color}`}>
                {stat.value}
              </div>
              <div className="text-xs text-text-dim mt-1">{stat.label}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

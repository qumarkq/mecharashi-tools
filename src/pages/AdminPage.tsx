import { useState, useEffect, useMemo } from 'react'
import type { Module, Mech, ConditionalEffect, ModuleLevel, UserProfile, Pilot, PilotSkill, SkillEffect, SkillCondition, Weapon, WeaponSkill } from '../types'
import { formatWeaponReq } from '../types'
import { ModuleRarity, MechPartPosition, ModuleSlot, ModuleSource, ModuleDataSource, ConditionalTrigger, PilotClass, MechLicense, ItemRarity, SkillType, WeaponType, WeaponKind, WeaponEquipSlot, RangeType, WeaponRarity, MechRestriction, SkillActivation } from '../types/enums'
import { getModules, getMechs, updateModule, updateMech, getPilots, updatePilot, getWeapons, updateWeapon } from '../lib/firestoreApi'
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

const PILOT_RARITY_CLASS: Record<string, string> = {
  EX: 'text-accent-purple bg-accent-purple/10 border-accent-purple/30',
  S:  'text-accent-orange bg-accent-orange/10 border-accent-orange/30',
  A:  'text-accent-cyan bg-accent-cyan/10 border-accent-cyan/30',
  B:  'text-text-secondary bg-bg-card border-border',
}

const TRIGGER_DISPLAY: Record<string, string> = {
  always:         '無條件（always）',
  onAttack:       '攻擊時（onAttack）',
  onCounter:      '反擊時（onCounter）',
  onApSkill:      '使用 AP 技能（onApSkill）',
  weaponType: '指定武器類型（weaponType）',
  dualWield:      '雙持武器（dualWield）',
  hpBelow:        'HP 低於門檻（hpBelow）',
  firstAttack:    '先手攻擊（firstAttack）',
  enemyPhase:     '敵方回合（enemyPhase）',
  allyHasBuff:    '隊友持有增益（allyHasBuff）',
}

const WEAPON_RARITY_CLASS: Record<string, string> = {
  SS:   'text-accent-purple bg-accent-purple/10 border-accent-purple/30',
  'S+': 'text-accent-orange bg-accent-orange/10 border-accent-orange/30',
  S:    'text-accent-cyan bg-accent-cyan/10 border-accent-cyan/30',
  A:    'text-text-secondary bg-bg-card border-border',
  B:    'text-text-dim bg-bg-dark border-border',
}

const WEAPON_KIND_BY_TYPE: Record<string, { value: string; label: string }[]> = {
  [WeaponType.Melee]: [
    { value: WeaponKind.Shield,         label: `大盾（${WeaponKind.Shield}）` },
    { value: WeaponKind.Buckler,        label: `手盾（${WeaponKind.Buckler}）` },
    { value: WeaponKind.Blade,          label: `刀劍（${WeaponKind.Blade}）` },
    { value: WeaponKind.Knuckle,        label: `拳套（${WeaponKind.Knuckle}）` },
    { value: WeaponKind.PileBunker,     label: `打樁機（${WeaponKind.PileBunker}）` },
    { value: WeaponKind.Saw,            label: `電鋸（${WeaponKind.Saw}）` },
    { value: WeaponKind.Rod,            label: `長柄（${WeaponKind.Rod}）` },
  ],
  [WeaponType.Heavy]: [
    { value: WeaponKind.RailGun,  label: `電磁炮（${WeaponKind.RailGun}）` },
    { value: WeaponKind.Funnel,   label: `浮游炮（${WeaponKind.Funnel}）` },
    { value: WeaponKind.Missile,  label: `導彈（${WeaponKind.Missile}）` },
    { value: WeaponKind.Rocket,   label: `火箭（${WeaponKind.Rocket}）` },
  ],
  [WeaponType.Assault]: [
    { value: WeaponKind.ShotGun,         label: `霰彈槍（${WeaponKind.ShotGun}）` },
    { value: WeaponKind.MachineGun,      label: `機槍（${WeaponKind.MachineGun}）` },
    { value: WeaponKind.HeavyMachineGun, label: `重機槍（${WeaponKind.HeavyMachineGun}）` },
    { value: WeaponKind.Flamethrower,    label: `噴火器（${WeaponKind.Flamethrower}）` },
  ],
  [WeaponType.Sniper]: [
    { value: WeaponKind.LightSniper, label: `輕型狙擊步槍（${WeaponKind.LightSniper}）` },
    { value: WeaponKind.HeavySniper, label: `狙擊步槍（${WeaponKind.HeavySniper}）` },
  ],
}

const ALL_WEAPON_KINDS: { value: string; label: string }[] = [
  ...(WEAPON_KIND_BY_TYPE[WeaponType.Melee] ?? []),
  ...(WEAPON_KIND_BY_TYPE[WeaponType.Heavy] ?? []),
  ...(WEAPON_KIND_BY_TYPE[WeaponType.Assault] ?? []),
  ...(WEAPON_KIND_BY_TYPE[WeaponType.Sniper] ?? []),
]

function makeDefaultWeapon(id: string): Weapon {
  return {
    id,
    name: '',
    type: WeaponType.Sniper,
    kind: WeaponKind.HeavySniper,
    kindCoefficient: 0,
    attack: '0×1',
    accuracy: 0,
    critValue: 0,
    rangeType: RangeType.LINEAR,
    minRange: 1,
    maxRange: 1,
    weight: 0,
    ammoCount: 0,
    hitCount: 1,
    rarity: WeaponRarity.S,
    mechRestriction: MechRestriction.NONE,
    equipSlot: WeaponEquipSlot.SINGLE_HAND,
    isExclusive: false,
    triggerSlots: 0,
    effectSlots: 0,
    componentLimit: 0,
    fixedMod: { planName: '', maxLevel: 70, effects: [] },
    floatingMod: { planName: '', slots: 0, possibleEffects: [] },
    skills: [],
  }
}

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
              onChange={(e) => setForm((f) => ({ ...f, module4Id: e.target.value || undefined }))}
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
              onChange={(e) => setForm((f) => ({ ...f, module8Id: e.target.value || undefined }))}
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

// ─── 技能效果編輯（機師用）────────────────────────────────────────────────────

function SkillConditionEditor({
  condition,
  onChange,
}: {
  condition: SkillCondition
  onChange: (updated: SkillCondition) => void
}) {
  return (
    <div className="p-2 bg-bg-dark/60 rounded border border-border/40 space-y-2 mt-1.5">
      <Field label="觸發條件 trigger">
        <select
          value={condition.trigger}
          onChange={(e) => onChange({ ...condition, trigger: e.target.value })}
          className="input-field"
        >
          {Object.entries(TRIGGER_DISPLAY).map(([k, label]) => (
            <option key={k} value={k}>{label}</option>
          ))}
        </select>
      </Field>
      {condition.trigger === 'weaponType' && (
        <Field label="武器類型 weaponType">
          <select
            value={condition.weaponType ?? ''}
            onChange={(e) => onChange({ ...condition, weaponType: e.target.value || undefined })}
            className="input-field"
          >
            <option value="">不限</option>
            {Object.values(WeaponType).map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </Field>
      )}
      {condition.trigger === 'hpBelow' && (
        <Field label="HP 門檻 (%) hpThreshold">
          <input
            type="number"
            value={condition.hpThreshold ?? ''}
            onChange={(e) => onChange({ ...condition, hpThreshold: e.target.value !== '' ? Number(e.target.value) : undefined })}
            className="input-field"
            placeholder="如：50 代表 HP < 50%"
          />
        </Field>
      )}
      {condition.trigger === 'onApSkill' && (
        <Field label="最低 AP 消耗 minApCost">
          <input
            type="number"
            value={condition.minApCost ?? ''}
            onChange={(e) => onChange({ ...condition, minApCost: e.target.value !== '' ? Number(e.target.value) : undefined })}
            className="input-field"
          />
        </Field>
      )}
      <Field label="目標職業 targetClass（選填）">
        <input
          type="text"
          value={condition.targetClass ?? ''}
          onChange={(e) => onChange({ ...condition, targetClass: e.target.value || undefined })}
          className="input-field"
          placeholder="如：突擊手（留空 = 不限）"
        />
      </Field>
    </div>
  )
}

function SkillEffectItem({
  effect,
  index,
  onChange,
  onRemove,
}: {
  effect: SkillEffect
  index: number
  onChange: (updated: SkillEffect) => void
  onRemove: () => void
}) {
  const hasCondition = effect.condition !== null

  return (
    <div className="border border-border/50 rounded-lg p-2.5 space-y-2 bg-bg-card/30">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-text-dim">效果 #{index + 1}</span>
        <button
          onClick={onRemove}
          className="text-[10px] px-1.5 py-0.5 text-accent-red border border-accent-red/30 rounded hover:bg-accent-red/10"
        >
          ✕ 移除
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Field label="屬性 stat">
          <select
            value={effect.stat}
            onChange={(e) => onChange({ ...effect, stat: e.target.value })}
            className="input-field text-xs"
          >
            {STAT_OPTIONS.map(({ key, label }) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </Field>
        <Field label="數值 value">
          <input
            type="number"
            value={effect.value}
            onChange={(e) => onChange({ ...effect, value: Number(e.target.value) })}
            className="input-field"
          />
        </Field>
        <Field label="對象 scope">
          <select
            value={effect.scope}
            onChange={(e) => onChange({ ...effect, scope: e.target.value })}
            className="input-field"
          >
            <option value="self">自身 (self)</option>
            <option value="ally">隊友 (ally)</option>
            <option value="team">全隊 (team)</option>
          </select>
        </Field>
      </div>
      <label className="flex items-center gap-2 text-[11px] text-text-dim cursor-pointer">
        <input
          type="checkbox"
          checked={hasCondition}
          onChange={() =>
            onChange({ ...effect, condition: hasCondition ? null : { trigger: 'always' } })
          }
          className="accent-accent-orange w-3.5 h-3.5"
        />
        有條件觸發
      </label>
      {hasCondition && effect.condition && (
        <SkillConditionEditor
          condition={effect.condition}
          onChange={(cond) => onChange({ ...effect, condition: cond })}
        />
      )}
    </div>
  )
}

function PilotSkillItem({
  skill,
  expanded,
  onToggle,
  onChange,
}: {
  skill: PilotSkill
  expanded: boolean
  onToggle: () => void
  onChange: (updated: PilotSkill) => void
}) {
  const effects = skill.effects ?? []
  const buffIds = skill.buffIds ?? []

  function updateEffects(next: SkillEffect[]) {
    onChange({ ...skill, effects: next })
  }

  function updateBuffIds(val: string) {
    const ids = val.split(/[,\n]/).map((s) => s.trim()).filter(Boolean)
    onChange({ ...skill, buffIds: ids })
  }

  const typeColor =
    skill.type === SkillType.PASSIVE ? 'text-text-dim border-border bg-bg-card' :
    skill.type === SkillType.ACTIVE  ? 'text-accent-cyan border-accent-cyan/30 bg-accent-cyan/10' :
                                       'text-accent-orange border-accent-orange/30 bg-accent-orange/10'

  return (
    <div className="border border-border/60 rounded-lg bg-bg-dark/50">
      <div
        className="flex items-center gap-2 px-3 py-2 cursor-pointer select-none"
        onClick={onToggle}
      >
        {skill.iconLocal && (
          <img
            src={skill.iconLocal}
            alt=""
            className="w-6 h-6 rounded shrink-0"
            onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
          />
        )}
        <span className="text-[10px] text-text-dim w-3 shrink-0">{expanded ? '▼' : '▶'}</span>
        <span className="text-sm font-medium flex-1 truncate">{skill.name}</span>
        <span className={`text-[10px] px-1.5 py-0.5 rounded border shrink-0 ${typeColor}`}>
          {skill.type}
        </span>
        {skill.ap && (
          <span className="text-[10px] text-accent-green shrink-0">AP {skill.ap}</span>
        )}
        {skill.cd && (
          <span className="text-[10px] text-accent-orange shrink-0">CD {skill.cd}</span>
        )}
        {skill.weapon && (
          <span className="text-[10px] text-accent-purple shrink-0">{formatWeaponReq(skill.weapon)}</span>
        )}
        <span className={`text-[10px] shrink-0 ml-1 ${effects.length > 0 ? 'text-accent-cyan' : 'text-text-dim'}`}>
          效果 {effects.length}
        </span>
      </div>

      {expanded && (
        <div className="px-3 pb-3 border-t border-border/40 pt-2.5 space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <Field label="技能類型 type">
              <select
                value={skill.type}
                onChange={(e) => onChange({ ...skill, type: e.target.value })}
                className="input-field"
              >
                <option value={SkillType.PASSIVE}>{SkillType.PASSIVE}</option>
                <option value={SkillType.ACTIVE}>{SkillType.ACTIVE}</option>
                <option value={SkillType.COMMAND}>{SkillType.COMMAND}</option>
              </select>
            </Field>
            <Field label="AP 消耗 ap">
              <input
                type="text"
                value={skill.ap ?? ''}
                onChange={(e) => onChange({ ...skill, ap: e.target.value || undefined })}
                className="input-field"
                placeholder="—"
              />
            </Field>
            <Field label="冷卻回合 cd">
              <input
                type="text"
                value={skill.cd ?? ''}
                onChange={(e) => onChange({ ...skill, cd: e.target.value || undefined })}
                className="input-field"
                placeholder="—"
              />
            </Field>
          </div>
          <div className="p-2 bg-bg-card/40 rounded border border-border/40">
            <p className="text-[10px] text-text-dim font-medium uppercase mb-1">效果說明（唯讀，由腳本管理）</p>
            <p className="text-xs text-text-secondary leading-relaxed">{skill.description || '—'}</p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] text-text-dim font-medium uppercase tracking-wider">可計算效果 effects</span>
              <button
                onClick={() =>
                  updateEffects([...effects, { stat: 'dmg', value: 0, scope: 'self', condition: null }])
                }
                className="text-[10px] text-accent-cyan hover:text-accent-cyan/80 transition-colors"
              >
                + 新增效果
              </button>
            </div>
            {effects.length === 0 ? (
              <p className="text-xs text-text-dim py-2 text-center">尚未填入（計算器不計此技能）</p>
            ) : (
              <div className="space-y-2">
                {effects.map((eff, effIdx) => (
                  <SkillEffectItem
                    key={effIdx}
                    effect={eff}
                    index={effIdx}
                    onChange={(updated) => {
                      const next = [...effects]
                      next[effIdx] = updated
                      updateEffects(next)
                    }}
                    onRemove={() => updateEffects(effects.filter((_, i) => i !== effIdx))}
                  />
                ))}
              </div>
            )}
          </div>

          <Field label="觸發 Buff ID buffIds（逗號分隔）">
            <textarea
              value={buffIds.join(', ')}
              onChange={(e) => updateBuffIds(e.target.value)}
              className="input-field min-h-[44px] resize-none text-xs"
              placeholder="buff_001, buff_002"
            />
          </Field>
        </div>
      )}
    </div>
  )
}

function PilotSkillsTab({
  skills,
  onChange,
}: {
  skills: PilotSkill[]
  onChange: (updated: PilotSkill[]) => void
}) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null)

  function updateSkill(idx: number, updated: PilotSkill) {
    const next = [...skills]
    next[idx] = updated
    onChange(next)
  }

  if (skills.length === 0) {
    return (
      <p className="text-text-dim text-sm text-center py-8">
        無技能資料（技能由爬蟲腳本寫入，效果欄位可在此填入）
      </p>
    )
  }

  return (
    <div className="space-y-1.5">
      {skills.map((skill, idx) => (
        <PilotSkillItem
          key={idx}
          skill={skill}
          expanded={expandedIdx === idx}
          onToggle={() => setExpandedIdx(expandedIdx === idx ? null : idx)}
          onChange={(updated) => updateSkill(idx, updated)}
        />
      ))}
    </div>
  )
}

// ─── 機師管理分頁 ──────────────────────────────────────────────────────────────
function PilotAdmin({
  pilots,
  onPilotSave,
}: {
  pilots: Pilot[]
  onPilotSave: (updated: Pilot) => Promise<void>
}) {
  const [search, setSearch] = useState('')
  const [filterRarity, setFilterRarity] = useState('all')
  const [filterClass, setFilterClass] = useState('all')
  const [editing, setEditing] = useState<Pilot | null>(null)

  const filtered = useMemo(() => {
    return pilots.filter((p) => {
      const matchSearch =
        !search ||
        p.name.includes(search) ||
        p.id.includes(search) ||
        (p.fullName ?? '').includes(search)
      const matchRarity = filterRarity === 'all' || p.rarity === filterRarity
      const matchClass = filterClass === 'all' || p.class === filterClass
      return matchSearch && matchRarity && matchClass
    })
  }, [pilots, search, filterRarity, filterClass])

  async function handleSave(updated: Pilot) {
    await onPilotSave(updated)
    setEditing(null)
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜尋名稱 / ID..."
          className="flex-1 min-w-[180px] px-3 py-2 rounded-lg bg-bg-dark border border-border text-text-primary text-sm focus:outline-none focus:border-accent-orange"
        />
        <select
          value={filterRarity}
          onChange={(e) => setFilterRarity(e.target.value)}
          className="px-3 py-2 rounded-lg bg-bg-dark border border-border text-text-primary text-sm"
        >
          <option value="all">全部稀有度</option>
          {Object.values(ItemRarity).map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <select
          value={filterClass}
          onChange={(e) => setFilterClass(e.target.value)}
          className="px-3 py-2 rounded-lg bg-bg-dark border border-border text-text-primary text-sm"
        >
          <option value="all">全部職業</option>
          {Object.values(PilotClass).map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      <p className="text-text-dim text-xs mb-3">共 {filtered.length} / {pilots.length} 位機師</p>

      <div className="space-y-1.5 max-h-[600px] overflow-y-auto pr-1">
        {filtered.map((pilot) => (
          <div
            key={pilot.id}
            className="bg-bg-dark border border-border rounded-lg px-3 py-2.5 flex items-center gap-3 hover:border-border-accent transition-colors cursor-pointer"
            onClick={() => setEditing(pilot)}
          >
            {pilot.portrait && (
              <img
                src={pilot.portrait}
                alt=""
                className="w-10 h-10 rounded-lg object-cover shrink-0"
                onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
              />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-sm text-text-primary">{pilot.name}</span>
                {pilot.fullName && pilot.fullName !== pilot.name && (
                  <span className="text-xs text-text-dim truncate">{pilot.fullName}</span>
                )}
                <span className={`text-[10px] px-1.5 py-0.5 rounded border font-bold shrink-0 ${PILOT_RARITY_CLASS[pilot.rarity] ?? 'text-text-dim border-border bg-bg-card'}`}>
                  {pilot.rarity}
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-bg-card border border-border text-text-dim shrink-0">
                  {pilot.class}
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-bg-card border border-border text-text-dim shrink-0">
                  {pilot.license}
                </span>
              </div>
              <div className="text-[11px] text-text-dim mt-0.5">
                格{pilot.stats.melee} · 突{pilot.stats.assault} · 射{pilot.stats.shooting} · 術{pilot.stats.tactics} · 防{pilot.stats.defense} · 工{pilot.stats.engineering}
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="text-text-dim text-sm text-center py-8">找不到符合條件的機師</p>
        )}
      </div>

      {editing && (
        <PilotEditPanel
          pilot={editing}
          onSave={handleSave}
          onCancel={() => setEditing(null)}
        />
      )}
    </div>
  )
}

// ─── 機師編輯面板 ──────────────────────────────────────────────────────────────
type PilotEditTab = 'basic' | 'stats' | 'ap' | 'profile' | 'skills'

const PILOT_EDIT_TABS: { id: PilotEditTab; label: string }[] = [
  { id: 'basic',   label: '基本資訊' },
  { id: 'stats',   label: '屬性數值' },
  { id: 'ap',      label: 'AP 系統' },
  { id: 'profile', label: '個人資料' },
  { id: 'skills',  label: '技能效果' },
]

function PilotEditPanel({
  pilot,
  onSave,
  onCancel,
}: {
  pilot: Pilot
  onSave: (p: Pilot) => Promise<void>
  onCancel: () => void
}) {
  const [form, setForm] = useState<Pilot>({ ...pilot })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editTab, setEditTab] = useState<PilotEditTab>('basic')

  useEffect(() => {
    setForm({ ...pilot })
    setEditTab('basic')
  }, [pilot])

  function update<K extends keyof Pilot>(key: K, value: Pilot[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function updateStats(key: keyof Pilot['stats'], value: number) {
    setForm((f) => ({ ...f, stats: { ...f.stats, [key]: value } }))
  }

  function updateAp(key: 'init' | 'max' | 'recovery', value: number) {
    setForm((f) => ({ ...f, ap: { ...f.ap, [key]: value } }))
  }

  function updateProfile(key: 'gender' | 'bloodType' | 'height', value: string) {
    setForm((f) => ({ ...f, profile: { ...f.profile, [key]: value } }))
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
        <div className="flex items-start gap-3 mb-3 shrink-0">
          {form.portrait && (
            <img
              src={form.portrait}
              alt=""
              className="w-12 h-12 rounded-lg object-cover shrink-0"
              onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
            />
          )}
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <span className="text-accent-orange">✎</span> 編輯機師
              <span className="text-text-dim text-sm font-normal ml-1">{form.id}</span>
            </h3>
            <p className="text-[11px] text-text-dim mt-0.5">
              技能 {form.skills?.length ?? 0}（效果可在「技能效果」分頁填入）· 天賦 {form.talents?.length ?? 0} · 神經驅動 {form.neuralDrive?.length ?? 0}（由爬蟲腳本管理）
            </p>
          </div>
        </div>

        {/* Tab 列 */}
        <div className="flex gap-1 mb-4 shrink-0 flex-wrap">
          {PILOT_EDIT_TABS.map((t) => {
            const filledSkills = t.id === 'skills'
              ? (form.skills ?? []).filter((s) => (s.effects ?? []).length > 0).length
              : 0
            const hasBadge = t.id === 'skills' && filledSkills > 0
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
                    {filledSkills}
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
              <div className="grid grid-cols-2 gap-3">
                <Field label="顯示名稱 name">
                  <input value={form.name} onChange={(e) => update('name', e.target.value)} className="input-field" />
                </Field>
                <Field label="全名 fullName">
                  <input value={form.fullName || ''} onChange={(e) => update('fullName', e.target.value)} className="input-field" />
                </Field>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Field label="稀有度 rarity">
                  <select value={form.rarity} onChange={(e) => update('rarity', e.target.value)} className="input-field">
                    {Object.values(ItemRarity).map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </Field>
                <Field label="職業 class">
                  <select value={form.class} onChange={(e) => update('class', e.target.value)} className="input-field">
                    {Object.values(PilotClass).map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </Field>
                <Field label="駕駛許可 license">
                  <select value={form.license} onChange={(e) => update('license', e.target.value)} className="input-field">
                    {Object.values(MechLicense).map((l) => (
                      <option key={l} value={l}>{l}</option>
                    ))}
                  </select>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="陣營 faction">
                  <input value={form.faction || ''} onChange={(e) => update('faction', e.target.value)} className="input-field" />
                </Field>
                <Field label="駕駛等級 masterLevel">
                  <input value={form.masterLevel || ''} onChange={(e) => update('masterLevel', e.target.value)} className="input-field" />
                </Field>
              </div>
              <Field label="立繪路徑 portrait">
                <input value={form.portrait || ''} onChange={(e) => update('portrait', e.target.value)} className="input-field" />
              </Field>
              <Field label="故事 lore（Markdown）">
                <textarea
                  value={form.lore || ''}
                  onChange={(e) => update('lore', e.target.value)}
                  className="input-field min-h-[100px] resize-y"
                />
              </Field>
            </div>
          )}

          {/* ── 屬性數值 ── */}
          {editTab === 'stats' && (
            <div>
              <p className="text-xs text-text-dim font-medium tracking-wider uppercase mb-3">六維屬性 stats</p>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <Field label="格鬥 melee">
                  <input type="number" value={form.stats.melee} onChange={(e) => updateStats('melee', Number(e.target.value))} className="input-field" />
                </Field>
                <Field label="突擊 assault">
                  <input type="number" value={form.stats.assault} onChange={(e) => updateStats('assault', Number(e.target.value))} className="input-field" />
                </Field>
                <Field label="射擊 shooting">
                  <input type="number" value={form.stats.shooting} onChange={(e) => updateStats('shooting', Number(e.target.value))} className="input-field" />
                </Field>
                <Field label="戰術 tactics">
                  <input type="number" value={form.stats.tactics} onChange={(e) => updateStats('tactics', Number(e.target.value))} className="input-field" />
                </Field>
                <Field label="防禦 defense">
                  <input type="number" value={form.stats.defense} onChange={(e) => updateStats('defense', Number(e.target.value))} className="input-field" />
                </Field>
                <Field label="工程 engineering">
                  <input type="number" value={form.stats.engineering} onChange={(e) => updateStats('engineering', Number(e.target.value))} className="input-field" />
                </Field>
              </div>
              <div className="pt-3 border-t border-border/60">
                <p className="text-xs text-text-dim font-medium tracking-wider uppercase mb-3">素質</p>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="攻擊素質 attack">
                    <input type="number" value={form.attack ?? 0} onChange={(e) => update('attack', Number(e.target.value))} className="input-field" />
                  </Field>
                  <Field label="防禦素質 defense (pilot)">
                    <input type="number" value={form.defense ?? 0} onChange={(e) => update('defense', Number(e.target.value))} className="input-field" />
                  </Field>
                </div>
              </div>
            </div>
          )}

          {/* ── AP 系統 ── */}
          {editTab === 'ap' && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <Field label="初始 AP init">
                  <input type="number" value={form.ap.init} onChange={(e) => updateAp('init', Number(e.target.value))} className="input-field" />
                </Field>
                <Field label="AP 上限 max">
                  <input type="number" value={form.ap.max} onChange={(e) => updateAp('max', Number(e.target.value))} className="input-field" />
                </Field>
                <Field label="AP 回復 recovery">
                  <input type="number" value={form.ap.recovery} onChange={(e) => updateAp('recovery', Number(e.target.value))} className="input-field" />
                </Field>
              </div>
              {form.apBase && (
                <div className="p-3 bg-bg-dark rounded-lg border border-border/60">
                  <p className="text-[10px] text-text-dim font-medium tracking-wider uppercase mb-2">基礎值 apBase（參考，由爬蟲腳本管理）</p>
                  <div className="grid grid-cols-3 gap-2 text-xs text-text-dim">
                    <div>初始：{form.apBase.init}</div>
                    <div>上限：{form.apBase.max}</div>
                    <div>回復：{form.apBase.recovery}</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── 個人資料 ── */}
          {editTab === 'profile' && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <Field label="性別 gender">
                  <input value={form.profile?.gender || ''} onChange={(e) => updateProfile('gender', e.target.value)} className="input-field" />
                </Field>
                <Field label="血型 bloodType">
                  <input value={form.profile?.bloodType || ''} onChange={(e) => updateProfile('bloodType', e.target.value)} className="input-field" />
                </Field>
                <Field label="身高 height">
                  <input value={form.profile?.height || ''} onChange={(e) => updateProfile('height', e.target.value)} className="input-field" />
                </Field>
              </div>
              {Object.keys(form.profile?.additionalInfo ?? {}).length > 0 && (
                <div className="p-3 bg-bg-dark rounded-lg border border-border/60">
                  <p className="text-[10px] text-text-dim font-medium tracking-wider uppercase mb-2">其他資料 additionalInfo（由爬蟲腳本管理）</p>
                  <div className="space-y-1">
                    {Object.entries(form.profile?.additionalInfo ?? {}).map(([k, v]) => (
                      <div key={k} className="flex gap-2 text-xs text-text-dim">
                        <span className="text-text-secondary shrink-0">{k}：</span>
                        <span>{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="p-3 bg-bg-dark/60 border border-border/40 rounded-lg">
                <p className="text-[11px] text-text-dim">
                  天賦、神經驅動等複雜欄位由爬蟲腳本管理，請透過 <code className="text-accent-cyan">npm run migrate</code> 更新至 Firestore。<br />
                  技能的名稱與描述同樣由腳本管理，但可在「技能效果」分頁填入 effects 供計算器使用。
                </p>
              </div>
            </div>
          )}

          {/* ── 技能效果 ── */}
          {editTab === 'skills' && (
            <PilotSkillsTab
              skills={form.skills ?? []}
              onChange={(updated) => update('skills', updated)}
            />
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

// ─── 武器技能項目（WeaponSkill 編輯）──────────────────────────────────────────
function WeaponSkillItem({
  skill,
  index,
  expanded,
  onToggle,
  onChange,
  onRemove,
}: {
  skill: WeaponSkill
  index: number
  expanded: boolean
  onToggle: () => void
  onChange: (updated: WeaponSkill) => void
  onRemove: () => void
}) {
  const effects = skill.effects ?? []
  const buffIds = skill.buffIds ?? []

  const activationColor =
    skill.activation === SkillActivation.CARRY ? 'text-accent-green border-accent-green/30 bg-accent-green/10' :
    skill.activation === SkillActivation.EQUIP  ? 'text-accent-cyan border-accent-cyan/30 bg-accent-cyan/10' :
                                                   'text-accent-orange border-accent-orange/30 bg-accent-orange/10'

  return (
    <div className="border border-border/60 rounded-lg bg-bg-dark/50">
      <div className="flex items-center gap-2 px-3 py-2 cursor-pointer select-none" onClick={onToggle}>
        <span className="text-[10px] text-text-dim w-3 shrink-0">{expanded ? '▼' : '▶'}</span>
        <span className="text-sm font-medium flex-1 truncate">
          {skill.name || <span className="text-text-dim font-normal">（未命名）#{index + 1}</span>}
        </span>
        <span className={`text-[10px] px-1.5 py-0.5 rounded border shrink-0 ${activationColor}`}>
          {skill.activation}
        </span>
        <span className={`text-[10px] shrink-0 ${effects.length > 0 ? 'text-accent-cyan' : 'text-text-dim'}`}>
          效果 {effects.length}
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); onRemove() }}
          className="text-[10px] px-1.5 py-0.5 text-accent-red border border-accent-red/30 rounded hover:bg-accent-red/10 shrink-0"
        >✕</button>
      </div>

      {expanded && (
        <div className="px-3 pb-3 border-t border-border/40 pt-2.5 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Field label="技能名稱 name">
              <input value={skill.name} onChange={(e) => onChange({ ...skill, name: e.target.value })} className="input-field" />
            </Field>
            <Field label="技能類型 type">
              <select value={skill.type} onChange={(e) => onChange({ ...skill, type: e.target.value })} className="input-field">
                <option value={SkillType.PASSIVE}>{SkillType.PASSIVE}</option>
                <option value={SkillType.ACTIVE}>{SkillType.ACTIVE}</option>
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="生效方式 activation">
              <select
                value={skill.activation}
                onChange={(e) => onChange({ ...skill, activation: e.target.value as WeaponSkill['activation'] })}
                className="input-field"
              >
                <option value={SkillActivation.CARRY}>carry — 攜帶即生效</option>
                <option value={SkillActivation.EQUIP}>equip — 裝備中生效</option>
                <option value={SkillActivation.USE}>use — 僅使用時生效</option>
              </select>
            </Field>
            <Field label="加強天賦 enhancesTalentName（選填）">
              <input
                value={skill.enhancesTalentName ?? ''}
                onChange={(e) => onChange({ ...skill, enhancesTalentName: e.target.value || undefined })}
                className="input-field"
                placeholder="專武加強天賦名稱"
              />
            </Field>
          </div>
          <Field label="技能描述 description">
            <textarea
              value={skill.description}
              onChange={(e) => onChange({ ...skill, description: e.target.value })}
              className="input-field min-h-[72px] resize-y"
            />
          </Field>
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] text-text-dim font-medium uppercase tracking-wider">可計算效果 effects</span>
              <button
                onClick={() => onChange({ ...skill, effects: [...effects, { stat: 'dmg', value: 0, scope: 'self', condition: null }] })}
                className="text-[10px] text-accent-cyan hover:text-accent-cyan/80 transition-colors"
              >+ 新增效果</button>
            </div>
            {effects.length === 0 ? (
              <p className="text-xs text-text-dim py-2 text-center">尚未填入（計算器不計此技能）</p>
            ) : (
              <div className="space-y-2">
                {effects.map((eff, effIdx) => (
                  <SkillEffectItem
                    key={effIdx}
                    effect={eff}
                    index={effIdx}
                    onChange={(updated) => {
                      const next = [...effects]; next[effIdx] = updated
                      onChange({ ...skill, effects: next })
                    }}
                    onRemove={() => onChange({ ...skill, effects: effects.filter((_, i) => i !== effIdx) })}
                  />
                ))}
              </div>
            )}
          </div>
          <Field label="觸發 Buff ID buffIds（逗號分隔）">
            <textarea
              value={buffIds.join(', ')}
              onChange={(e) => {
                const ids = e.target.value.split(/[,\n]/).map((s) => s.trim()).filter(Boolean)
                onChange({ ...skill, buffIds: ids })
              }}
              className="input-field min-h-[48px] resize-y font-mono text-xs"
              placeholder="buff_001, buff_002"
            />
          </Field>
        </div>
      )}
    </div>
  )
}

// ─── 武器管理分頁 ──────────────────────────────────────────────────────────────
function WeaponAdmin({
  weapons,
  pilots,
  onWeaponSave,
}: {
  weapons: Weapon[]
  pilots: Pilot[]
  onWeaponSave: (updated: Weapon) => Promise<void>
}) {
  const [search, setSearch] = useState('')
  const [filterRarity, setFilterRarity] = useState<'all' | string>('all')
  const [filterType, setFilterType] = useState<'all' | string>('all')
  const [filterExclusive, setFilterExclusive] = useState<'all' | 'yes' | 'no'>('all')
  const [editing, setEditing] = useState<Weapon | null>(null)
  const [creating, setCreating] = useState(false)
  const [newId, setNewId] = useState('')
  const [newIdError, setNewIdError] = useState('')

  const filtered = useMemo(() => {
    return weapons.filter((w) => {
      const matchSearch = !search || w.name.includes(search) || w.id.includes(search)
      const matchRarity = filterRarity === 'all' || w.rarity === filterRarity
      const matchType = filterType === 'all' || w.type === filterType
      const matchExclusive =
        filterExclusive === 'all' ||
        (filterExclusive === 'yes' && w.isExclusive) ||
        (filterExclusive === 'no' && !w.isExclusive)
      return matchSearch && matchRarity && matchType && matchExclusive
    })
  }, [weapons, search, filterRarity, filterType, filterExclusive])

  async function handleSave(updated: Weapon) {
    await onWeaponSave(updated)
    setEditing(null)
  }

  function handleCreateConfirm() {
    const trimmed = newId.trim()
    if (!trimmed) { setNewIdError('請輸入 ID'); return }
    if (weapons.some((w) => w.id === trimmed)) { setNewIdError(`ID「${trimmed}」已存在`); return }
    setCreating(false); setNewId(''); setNewIdError('')
    setEditing(makeDefaultWeapon(trimmed))
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜尋武器名稱 / ID..."
          className="flex-1 min-w-[180px] px-3 py-2 rounded-lg bg-bg-dark border border-border text-text-primary text-sm focus:outline-none focus:border-accent-orange"
        />
        <select value={filterRarity} onChange={(e) => setFilterRarity(e.target.value)} className="px-3 py-2 rounded-lg bg-bg-dark border border-border text-text-primary text-sm">
          <option value="all">全部稀有度</option>
          {Object.values(WeaponRarity).map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="px-3 py-2 rounded-lg bg-bg-dark border border-border text-text-primary text-sm">
          <option value="all">全部類型</option>
          {Object.values(WeaponType).map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={filterExclusive} onChange={(e) => setFilterExclusive(e.target.value as typeof filterExclusive)} className="px-3 py-2 rounded-lg bg-bg-dark border border-border text-text-primary text-sm">
          <option value="all">全部武器</option>
          <option value="yes">專屬武器</option>
          <option value="no">通用武器</option>
        </select>
      </div>

      <div className="flex items-center justify-between mb-3">
        <p className="text-text-dim text-xs">共 {filtered.length} / {weapons.length} 把武器</p>
        <button
          onClick={() => { setCreating(true); setNewId(''); setNewIdError('') }}
          className="text-xs px-3 py-1.5 bg-accent-orange text-black font-bold rounded-lg hover:opacity-90 transition-opacity"
        >+ 新增武器</button>
      </div>

      {creating && (
        <div className="mb-4 p-4 bg-bg-dark border border-accent-orange/40 rounded-xl">
          <p className="text-xs text-text-dim mb-2 font-medium">輸入新武器 ID（格式如 <span className="text-accent-cyan">weapon_10001</span>，儲存後不可更改）</p>
          <div className="flex gap-2">
            <input
              autoFocus type="text" value={newId}
              onChange={(e) => { setNewId(e.target.value); setNewIdError('') }}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreateConfirm() }}
              placeholder="weapon_"
              className="flex-1 px-3 py-2 rounded-lg bg-bg-card border border-border text-text-primary text-sm focus:outline-none focus:border-accent-orange"
            />
            <button onClick={handleCreateConfirm} className="px-4 py-2 bg-accent-orange text-black text-sm font-bold rounded-lg hover:opacity-90">建立</button>
            <button onClick={() => setCreating(false)} className="px-3 py-2 border border-border text-text-secondary text-sm rounded-lg hover:bg-bg-card">取消</button>
          </div>
          {newIdError && <p className="text-xs text-accent-red mt-1.5">⚠ {newIdError}</p>}
        </div>
      )}

      <div className="space-y-1.5 max-h-[600px] overflow-y-auto pr-1">
        {filtered.map((w) => {
          const pilot = pilots.find((p) => p.id === w.exclusiveFor)
          return (
            <div
              key={w.id}
              className="bg-bg-dark border border-border rounded-lg px-3 py-2.5 flex items-center gap-3 hover:border-border-accent transition-colors cursor-pointer"
              onClick={() => setEditing(w)}
            >
              {w.icon && (
                <img src={w.icon} alt="" className="w-8 h-8 rounded shrink-0" onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')} />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-sm text-text-primary truncate">{w.name || <span className="text-text-dim font-normal">（未命名）</span>}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border font-bold shrink-0 ${WEAPON_RARITY_CLASS[w.rarity] ?? 'text-text-dim border-border bg-bg-card'}`}>{w.rarity}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-bg-card border border-border text-text-dim shrink-0">{w.type}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-bg-card border border-border text-text-dim shrink-0">{w.kind}</span>
                  {w.isExclusive && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent-purple/10 text-accent-purple border border-accent-purple/30 shrink-0">
                      專屬{pilot ? `・${pilot.name}` : '（未綁定）'}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-text-dim mt-0.5">
                  {w.equipSlot} · 重量 {w.weight} · 攻擊 {w.attack} · 射程 {w.rangeType === RangeType.RING ? `${w.maxRange}+` : `${w.minRange}-${w.maxRange}`}
                </p>
              </div>
            </div>
          )
        })}
        {filtered.length === 0 && (
          <p className="text-text-dim text-sm text-center py-8">找不到符合條件的武器</p>
        )}
      </div>

      {editing && (
        <WeaponEditPanel weapon={editing} pilots={pilots} onSave={handleSave} onCancel={() => setEditing(null)} />
      )}
    </div>
  )
}

// ─── 武器編輯面板 ──────────────────────────────────────────────────────────────
type WeaponEditTab = 'basic' | 'stats' | 'range' | 'slots' | 'mods' | 'skills'

const WEAPON_EDIT_TABS: { id: WeaponEditTab; label: string }[] = [
  { id: 'basic',  label: '基本資訊' },
  { id: 'stats',  label: '戰鬥屬性' },
  { id: 'range',  label: '射程' },
  { id: 'slots',  label: '元件・專武' },
  { id: 'mods',   label: '改裝方案' },
  { id: 'skills', label: '武器技能' },
]

function WeaponEditPanel({
  weapon,
  pilots,
  onSave,
  onCancel,
}: {
  weapon: Weapon
  pilots: Pilot[]
  onSave: (w: Weapon) => Promise<void>
  onCancel: () => void
}) {
  const [form, setForm] = useState<Weapon>({ ...weapon })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editTab, setEditTab] = useState<WeaponEditTab>('basic')
  const [expandedSkillIdx, setExpandedSkillIdx] = useState<number | null>(null)

  useEffect(() => {
    setForm({ ...weapon })
    setEditTab('basic')
    setExpandedSkillIdx(null)
  }, [weapon])

  function update<K extends keyof Weapon>(key: K, value: Weapon[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function updateFixedMod<K extends keyof Weapon['fixedMod']>(key: K, value: Weapon['fixedMod'][K]) {
    setForm((f) => ({ ...f, fixedMod: { ...f.fixedMod, [key]: value } }))
  }

  function updateFloatingMod<K extends keyof Weapon['floatingMod']>(key: K, value: Weapon['floatingMod'][K]) {
    setForm((f) => ({ ...f, floatingMod: { ...f.floatingMod, [key]: value } }))
  }

  async function handleSubmit() {
    setSaving(true); setError(null)
    try {
      await onSave(form)
    } catch (e) {
      setError(e instanceof Error ? e.message : '儲存失敗，請重試')
      setSaving(false)
    }
  }

  const currentKindOptions = WEAPON_KIND_BY_TYPE[form.type] ?? ALL_WEAPON_KINDS

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-bg-card border border-border rounded-xl p-6 w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* 標題 */}
        <div className="flex items-start gap-3 mb-3 shrink-0">
          {form.icon && (
            <img src={form.icon} alt="" className="w-10 h-10 rounded shrink-0" onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')} />
          )}
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <span className="text-accent-purple">⚔</span> 編輯武器
              <span className="text-text-dim text-sm font-normal ml-1">{form.id}</span>
            </h3>
            <p className="text-[11px] text-text-dim mt-0.5">
              {form.type} · {form.kind} · {form.rarity} · 技能 {(form.skills ?? []).length}
            </p>
          </div>
        </div>

        {/* Tab 列 */}
        <div className="flex gap-1 mb-4 shrink-0 flex-wrap">
          {WEAPON_EDIT_TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setEditTab(t.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                editTab === t.id
                  ? 'bg-accent-orange text-black'
                  : 'bg-bg-dark border border-border text-text-secondary hover:text-text-primary'
              }`}
            >{t.label}</button>
          ))}
        </div>

        {/* Tab 內容 */}
        <div className="overflow-y-auto flex-1 pr-1">

          {/* ── 基本資訊 ── */}
          {editTab === 'basic' && (
            <div className="space-y-3">
              <Field label="武器名稱 name">
                <input value={form.name} onChange={(e) => update('name', e.target.value)} className="input-field" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="武器類型 type">
                  <select value={form.type} onChange={(e) => update('type', e.target.value)} className="input-field">
                    {Object.values(WeaponType).map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                </Field>
                <Field label="武器種類 kind">
                  <select value={form.kind} onChange={(e) => update('kind', e.target.value)} className="input-field">
                    {currentKindOptions.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </Field>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Field label="種類係數 kindCoefficient">
                  <input type="number" step="0.01" value={form.kindCoefficient} onChange={(e) => update('kindCoefficient', Number(e.target.value))} className="input-field" />
                </Field>
                <Field label="稀有度 rarity">
                  <select value={form.rarity} onChange={(e) => update('rarity', e.target.value)} className="input-field">
                    {Object.values(WeaponRarity).map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </Field>
                <Field label="裝備部位 equipSlot">
                  <select value={form.equipSlot} onChange={(e) => update('equipSlot', e.target.value)} className="input-field">
                    <option value={WeaponEquipSlot.SINGLE_HAND}>singleHand — 單手</option>
                    <option value={WeaponEquipSlot.DUAL_HAND}>dualHand — 雙手</option>
                    <option value={WeaponEquipSlot.SHOULDER}>shoulder — 肩膀</option>
                    <option value={WeaponEquipSlot.BACK}>back — 背後</option>
                  </select>
                </Field>
              </div>
              <Field label="機甲限制 mechRestriction">
                <select value={form.mechRestriction} onChange={(e) => update('mechRestriction', e.target.value)} className="input-field">
                  <option value={MechRestriction.NONE}>none — 無限制</option>
                  <option value={MechRestriction.LIGHT_ONLY}>light — 僅輕型機甲</option>
                  <option value={MechRestriction.MEDIUM_ONLY}>medium — 僅中型機甲</option>
                  <option value={MechRestriction.HEAVY_ONLY}>heavy — 僅重型機甲</option>
                </select>
              </Field>
              <Field label="圖示路徑 icon（選填）">
                <input value={form.icon ?? ''} onChange={(e) => update('icon', e.target.value || undefined)} className="input-field" placeholder="/images/weapons/..." />
              </Field>
            </div>
          )}

          {/* ── 戰鬥屬性 ── */}
          {editTab === 'stats' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="攻擊力 attack（含子彈數）">
                  <input value={form.attack} onChange={(e) => update('attack', e.target.value)} className="input-field" placeholder="如 766×1" />
                </Field>
                <Field label="命中值 accuracy">
                  <input type="number" value={form.accuracy} onChange={(e) => update('accuracy', Number(e.target.value))} className="input-field" />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="暴擊值 critValue">
                  <input type="number" value={form.critValue} onChange={(e) => update('critValue', Number(e.target.value))} className="input-field" />
                </Field>
                <Field label="重量 weight">
                  <input type="number" value={form.weight} onChange={(e) => update('weight', Number(e.target.value))} className="input-field" />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="彈藥量 ammoCount（0 = 無限彈藥）">
                  <input type="number" value={form.ammoCount} onChange={(e) => update('ammoCount', Number(e.target.value))} className="input-field" />
                </Field>
                <Field label="連擊數 hitCount">
                  <input type="number" value={form.hitCount} onChange={(e) => update('hitCount', Number(e.target.value))} className="input-field" />
                </Field>
              </div>
              <div className="p-3 bg-bg-dark rounded-lg border border-border/60">
                <p className="text-[10px] text-text-dim font-medium uppercase mb-1">連擊數參考</p>
                <p className="text-[11px] text-text-secondary">霰彈槍=12 · 機槍/重機槍/電鋸=10 · 噴火器=8 · 浮游炮=6 · 其他=1</p>
              </div>
            </div>
          )}

          {/* ── 射程 ── */}
          {editTab === 'range' && (
            <div className="space-y-4">
              <Field label="射程型態 rangeType">
                <select value={form.rangeType} onChange={(e) => {
                  const rt = e.target.value
                  update('rangeType', rt)
                  if (rt === RangeType.RING) update('minRange', 0)
                }} className="input-field">
                  <option value={RangeType.LINEAR}>linear — 線性射程（有最小射程限制）</option>
                  <option value={RangeType.RING}>ring — 環形N圈（含自身格，無最小限制）</option>
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label={form.rangeType === RangeType.RING ? 'minRange（ring 型固定為 0）' : '最小射程 minRange'}>
                  <input
                    type="number" value={form.minRange}
                    onChange={(e) => update('minRange', Number(e.target.value))}
                    className="input-field" disabled={form.rangeType === RangeType.RING}
                  />
                </Field>
                <Field label={form.rangeType === RangeType.RING ? '圈數 maxRange（N圈）' : '最大射程 maxRange'}>
                  <input type="number" value={form.maxRange} onChange={(e) => update('maxRange', Number(e.target.value))} className="input-field" />
                </Field>
              </div>
              <div className="p-3 bg-bg-dark rounded-lg border border-border/60 space-y-1.5">
                <p className="text-[10px] text-text-dim font-medium uppercase">射程顯示預覽</p>
                <p className="font-mono text-sm text-accent-cyan">
                  {form.rangeType === RangeType.RING
                    ? `${form.maxRange}+（${(2 * form.maxRange + 1) ** 2} 格覆蓋）`
                    : `${form.minRange}-${form.maxRange}`}
                </p>
                <p className="text-[11px] text-text-dim">
                  {form.rangeType === RangeType.RING
                    ? `ring：以持有者為中心，Chebyshev 距離 ≤ ${form.maxRange} 的 ${2 * form.maxRange + 1}×${2 * form.maxRange + 1} 方格`
                    : `linear：攻擊目標須在 [${form.minRange}, ${form.maxRange}] 格距內`}
                </p>
              </div>
            </div>
          )}

          {/* ── 元件・專武 ── */}
          {editTab === 'slots' && (
            <div className="space-y-4">
              <div className="p-3 bg-bg-dark rounded-lg border border-border/60 space-y-3">
                <p className="text-xs text-text-dim font-medium uppercase tracking-wider">元件插槽</p>
                <div className="grid grid-cols-3 gap-3">
                  <Field label="觸元件槽 triggerSlots">
                    <input type="number" value={form.triggerSlots} onChange={(e) => update('triggerSlots', Number(e.target.value))} className="input-field" />
                  </Field>
                  <Field label="應元件槽 effectSlots">
                    <input type="number" value={form.effectSlots} onChange={(e) => update('effectSlots', Number(e.target.value))} className="input-field" />
                  </Field>
                  <Field label="元件上限 componentLimit">
                    <input type="number" value={form.componentLimit} onChange={(e) => update('componentLimit', Number(e.target.value))} className="input-field" />
                  </Field>
                </div>
                <p className="text-[11px] text-text-dim">SS / S+ = 4；S = 3；其他 = 0</p>
              </div>
              <div className="p-3 bg-bg-dark rounded-lg border border-border/60 space-y-3">
                <p className="text-xs text-text-dim font-medium uppercase tracking-wider">專屬武器設定</p>
                <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
                  <input
                    type="checkbox" checked={form.isExclusive}
                    onChange={(e) => update('isExclusive', e.target.checked)}
                    className="accent-accent-orange w-4 h-4"
                  />
                  <span>isExclusive — 此武器為專屬武器（SS 稀有度）</span>
                </label>
                {form.isExclusive && (
                  <Field label="綁定機師 exclusiveFor（機師 ID）">
                    <select
                      value={form.exclusiveFor ?? ''}
                      onChange={(e) => update('exclusiveFor', e.target.value || undefined)}
                      className="input-field"
                    >
                      <option value="">（未指定）</option>
                      {pilots.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}（{p.id}）</option>
                      ))}
                    </select>
                  </Field>
                )}
              </div>
            </div>
          )}

          {/* ── 改裝方案 ── */}
          {editTab === 'mods' && (
            <div className="space-y-5">
              {/* 固定改裝 */}
              <div>
                <p className="text-xs text-text-dim font-medium uppercase tracking-wider mb-2">固定改裝 fixedMod（效果固定，依等級解鎖）</p>
                <div className="space-y-3 p-3 bg-bg-dark rounded-lg border border-border/60">
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="方案名稱 planName">
                      <input value={form.fixedMod.planName} onChange={(e) => updateFixedMod('planName', e.target.value)} className="input-field" placeholder="如 機槍VIII" />
                    </Field>
                    <Field label="最高等級 maxLevel">
                      <input type="number" value={form.fixedMod.maxLevel} onChange={(e) => updateFixedMod('maxLevel', Number(e.target.value))} className="input-field" />
                    </Field>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] text-text-dim uppercase">效果列表 effects</span>
                      <button
                        onClick={() => updateFixedMod('effects', [...form.fixedMod.effects, { stat: 'attack', value: 0 }])}
                        className="text-[10px] text-accent-cyan hover:text-accent-cyan/80 transition-colors"
                      >+ 新增效果</button>
                    </div>
                    {form.fixedMod.effects.length === 0 ? (
                      <p className="text-xs text-text-dim py-2 text-center">無固定效果</p>
                    ) : (
                      <div className="space-y-2">
                        {form.fixedMod.effects.map((eff, idx) => (
                          <div key={idx} className="flex gap-2 items-end">
                            <Field label="效果類型 stat">
                              <select
                                value={eff.stat}
                                onChange={(e) => { const next = [...form.fixedMod.effects]; next[idx] = { ...next[idx], stat: e.target.value }; updateFixedMod('effects', next) }}
                                className="input-field"
                              >
                                <option value="attack">attack — 攻擊力</option>
                                <option value="crit">crit — 暴擊值</option>
                                <option value="accuracy">accuracy — 命中值</option>
                              </select>
                            </Field>
                            <Field label="數值 value">
                              <input type="number" value={eff.value}
                                onChange={(e) => { const next = [...form.fixedMod.effects]; next[idx] = { ...next[idx], value: Number(e.target.value) }; updateFixedMod('effects', next) }}
                                className="input-field" />
                            </Field>
                            <button
                              onClick={() => updateFixedMod('effects', form.fixedMod.effects.filter((_, i) => i !== idx))}
                              className="px-2 py-1.5 mb-0.5 text-accent-red border border-accent-red/30 rounded hover:bg-accent-red/10 text-xs shrink-0"
                            >✕</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 浮動改裝 */}
              <div>
                <p className="text-xs text-text-dim font-medium uppercase tracking-wider mb-2">浮動改裝 floatingMod（效果隨機，有範圍）</p>
                <div className="space-y-3 p-3 bg-bg-dark rounded-lg border border-border/60">
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="方案名稱 planName">
                      <input value={form.floatingMod.planName} onChange={(e) => updateFloatingMod('planName', e.target.value)} className="input-field" placeholder="如 機槍IV" />
                    </Field>
                    <Field label="效果欄位數 slots">
                      <input type="number" value={form.floatingMod.slots} onChange={(e) => updateFloatingMod('slots', Number(e.target.value))} className="input-field" />
                    </Field>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] text-text-dim uppercase">可能效果 possibleEffects</span>
                      <button
                        onClick={() => updateFloatingMod('possibleEffects', [...form.floatingMod.possibleEffects, { stat: 'attack', condition: null, min: 0, max: 0 }])}
                        className="text-[10px] text-accent-cyan hover:text-accent-cyan/80 transition-colors"
                      >+ 新增</button>
                    </div>
                    {form.floatingMod.possibleEffects.length === 0 ? (
                      <p className="text-xs text-text-dim py-2 text-center">無浮動效果</p>
                    ) : (
                      <div className="space-y-2">
                        {form.floatingMod.possibleEffects.map((eff, idx) => (
                          <div key={idx} className="border border-border/40 rounded-lg p-2.5 space-y-2">
                            <div className="flex items-end gap-2">
                              <Field label="效果類型 stat">
                                <select
                                  value={eff.stat}
                                  onChange={(e) => { const next = [...form.floatingMod.possibleEffects]; next[idx] = { ...next[idx], stat: e.target.value }; updateFloatingMod('possibleEffects', next) }}
                                  className="input-field text-xs"
                                >
                                  <option value="attack">attack — 攻擊力</option>
                                  <option value="crit">crit — 暴擊值</option>
                                  <option value="accuracy">accuracy — 命中值</option>
                                  <option value="firepower">firepower — 火力</option>
                                </select>
                              </Field>
                              <button
                                onClick={() => updateFloatingMod('possibleEffects', form.floatingMod.possibleEffects.filter((_, i) => i !== idx))}
                                className="px-2 py-1.5 mb-0.5 text-accent-red border border-accent-red/30 rounded hover:bg-accent-red/10 text-xs shrink-0"
                              >✕</button>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <Field label="最小值 min">
                                <input type="number" value={eff.min}
                                  onChange={(e) => { const next = [...form.floatingMod.possibleEffects]; next[idx] = { ...next[idx], min: Number(e.target.value) }; updateFloatingMod('possibleEffects', next) }}
                                  className="input-field" />
                              </Field>
                              <Field label="最大值 max">
                                <input type="number" value={eff.max}
                                  onChange={(e) => { const next = [...form.floatingMod.possibleEffects]; next[idx] = { ...next[idx], max: Number(e.target.value) }; updateFloatingMod('possibleEffects', next) }}
                                  className="input-field" />
                              </Field>
                            </div>
                            <Field label="觸發條件 condition（留空 = null 無條件）">
                              <input
                                value={eff.condition ?? ''}
                                onChange={(e) => { const next = [...form.floatingMod.possibleEffects]; next[idx] = { ...next[idx], condition: e.target.value || null }; updateFloatingMod('possibleEffects', next) }}
                                className="input-field text-xs" placeholder="留空 = null（無條件）"
                              />
                            </Field>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── 武器技能 ── */}
          {editTab === 'skills' && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-text-dim font-medium uppercase tracking-wider">武器技能 skills</span>
                <button
                  onClick={() => {
                    const next = [...(form.skills ?? []), {
                      name: '', type: SkillType.PASSIVE,
                      activation: SkillActivation.CARRY as WeaponSkill['activation'],
                      description: '', effects: [], buffIds: [],
                    }]
                    update('skills', next)
                    setExpandedSkillIdx(next.length - 1)
                  }}
                  className="text-xs text-accent-cyan hover:text-accent-cyan/80 transition-colors"
                >+ 新增技能</button>
              </div>
              {(form.skills ?? []).length === 0 ? (
                <p className="text-xs text-text-dim py-4 text-center">無武器技能</p>
              ) : (
                <div className="space-y-2">
                  {(form.skills ?? []).map((skill, idx) => (
                    <WeaponSkillItem
                      key={idx}
                      skill={skill}
                      index={idx}
                      expanded={expandedSkillIdx === idx}
                      onToggle={() => setExpandedSkillIdx(expandedSkillIdx === idx ? null : idx)}
                      onChange={(updated) => {
                        const next = [...(form.skills ?? [])]; next[idx] = updated
                        update('skills', next)
                      }}
                      onRemove={() => {
                        update('skills', (form.skills ?? []).filter((_, i) => i !== idx))
                        if (expandedSkillIdx === idx) setExpandedSkillIdx(null)
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {error && <p className="text-xs text-accent-red mt-3 shrink-0">⚠ {error}</p>}

        <div className="flex gap-3 mt-4 shrink-0">
          <button onClick={handleSubmit} disabled={saving} className="flex-1 px-4 py-2 bg-accent-orange text-black font-bold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50">
            {saving ? '儲存中...' : '儲存變更'}
          </button>
          <button onClick={onCancel} disabled={saving} className="px-4 py-2 border border-border text-text-secondary rounded-lg hover:bg-bg-dark transition-colors disabled:opacity-50">
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
  const [tab, setTab] = useState<'modules' | 'mechs' | 'pilots' | 'weapons' | 'users'>('modules')
  const [modules, setModules] = useState<Module[]>([])
  const [mechs, setMechs] = useState<Mech[]>([])
  const [pilots, setPilots] = useState<Pilot[]>([])
  const [weapons, setWeapons] = useState<Weapon[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([getModules(), getMechs(), getPilots(), getWeapons()])
      .then(([mods, m, ps, ws]) => {
        setModules(mods)
        setMechs(m)
        setPilots(ps)
        setWeapons(ws)
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

  async function handlePilotSave(updated: Pilot) {
    await updatePilot(updated)
    setPilots((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
  }

  async function handleWeaponSave(updated: Weapon) {
    await updateWeapon(updated)
    setWeapons((prev) => {
      const exists = prev.some((w) => w.id === updated.id)
      return exists ? prev.map((w) => (w.id === updated.id ? updated : w)) : [...prev, updated]
    })
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
          維護模組數值、機甲模組綁定、機師基本資料、用戶權限。儲存後直接更新 Firestore，無需手動匯出。
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
        <TabButton active={tab === 'pilots'} onClick={() => setTab('pilots')}>
          機師管理
        </TabButton>
        <TabButton active={tab === 'weapons'} onClick={() => setTab('weapons')}>
          武器管理
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
        {tab === 'pilots' && (
          <PilotAdmin
            pilots={pilots}
            onPilotSave={handlePilotSave}
          />
        )}
        {tab === 'weapons' && (
          <WeaponAdmin
            weapons={weapons}
            pilots={pilots}
            onWeaponSave={handleWeaponSave}
          />
        )}
        {tab === 'users' && <UserAdmin currentUid={user.uid} />}
      </div>

      {/* 統計資訊 */}
      {tab !== 'users' && (
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {(tab === 'pilots' ? [
            { label: '機師總數', value: pilots.length, color: 'text-accent-cyan' },
            { label: 'S 稀有度', value: pilots.filter((p) => p.rarity === 'S').length, color: 'text-accent-orange' },
            { label: 'A 稀有度', value: pilots.filter((p) => p.rarity === 'A').length, color: 'text-accent-green' },
            { label: 'EX 稀有度', value: pilots.filter((p) => p.rarity === 'EX').length, color: 'text-accent-purple' },
          ] : tab === 'weapons' ? [
            { label: '武器總數', value: weapons.length, color: 'text-accent-cyan' },
            { label: '專屬武器', value: weapons.filter((w) => w.isExclusive).length, color: 'text-accent-purple' },
            { label: 'SS 稀有度', value: weapons.filter((w) => w.rarity === 'SS').length, color: 'text-accent-orange' },
            { label: '有技能', value: weapons.filter((w) => (w.skills ?? []).length > 0).length, color: 'text-accent-green' },
          ] : [
            { label: '模組總數', value: modules.length, color: 'text-accent-cyan' },
            { label: '已綁定', value: modules.filter((m) => m.boundMechId).length, color: 'text-accent-orange' },
            { label: '已填數值', value: modules.filter((m) => m.dmg > 0 || (m.crit_rate ?? 0) > 0 || m.critDmg > 0 || (m.acc_rate ?? 0) > 0 || (m.firepower_rate ?? 0) > 0 || (m.output_bonus ?? 0) > 0).length, color: 'text-accent-green' },
            { label: '機甲總數', value: mechs.length, color: 'text-accent-purple' },
          ]).map((stat) => (
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

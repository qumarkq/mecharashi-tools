import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import type { Module, Mech, Pilot, Weapon, Component, GrayOpsRoster } from '../../types'
import { ComponentType, ComponentsWType } from '../../types/enums'
import { updateModule, updateMech, updatePilot, updateWeapon, updateComponent, updateGrayOpsRoster } from '../../lib/firestoreApi'
import { useAuth } from '../../contexts/AuthContext'
import { useGameData } from '../../contexts/GameDataContext'
import { TabButton } from './admin/shared'
import ModuleAdmin from './admin/ModuleAdmin'
import MechAdmin from './admin/MechAdmin'
import PilotAdmin from './admin/PilotAdmin'
import WeaponAdmin from './admin/WeaponAdmin'
import ComponentAdmin from './admin/ComponentAdmin'
import UserAdmin from './admin/UserAdmin'
import GrayOpsAdmin from './admin/GrayOpsAdmin'
import BackpackAdmin from './admin/BackpackAdmin'

export default function AdminPage() {
  const { user, userProfile, loading: authLoading } = useAuth()
  const {
    modules: ctxModules,
    mechs: ctxMechs,
    pilots: ctxPilots,
    weapons: ctxWeapons,
    components: ctxComponents,
    grayOpsRoster: ctxGrayOpsRoster,
    loadedKeys,
    errorMap,
    ensureLoaded,
    reloadTick,
  } = useGameData()

  const ADMIN_KEYS = ['modules', 'mechs', 'pilots', 'weapons', 'components', 'grayOpsRoster'] as const
  useEffect(() => { void ensureLoaded([...ADMIN_KEYS]) }, [ensureLoaded, reloadTick])

  const loading   = !ADMIN_KEYS.every(k => loadedKeys.has(k))
  const loadError = ADMIN_KEYS.map(k => errorMap[k]).find(Boolean)?.message ?? null

  const [tab, setTab] = useState<'modules' | 'mechs' | 'pilots' | 'weapons' | 'components' | 'backpacks' | 'users' | 'grayops'>('modules')
  const [modules, setModules]       = useState<Module[]>([])
  const [mechs, setMechs]           = useState<Mech[]>([])
  const [pilots, setPilots]         = useState<Pilot[]>([])
  const [weapons, setWeapons]       = useState<Weapon[]>([])
  const [components, setComponents] = useState<Component[]>([])

  // Sync local editable copies from context once loaded (or after context reload).
  // Intentionally excludes ctx* from deps — we only want to reset on loading state change,
  // not on every context reference update, to preserve in-progress optimistic edits.
  useEffect(() => {
    if (!loading) {
      setModules(ctxModules)
      setMechs(ctxMechs)
      setPilots(ctxPilots)
      setWeapons(ctxWeapons)
      setComponents(ctxComponents)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading])

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

  async function handleComponentSave(updated: Component) {
    await updateComponent(updated)
    setComponents((prev) => {
      const exists = prev.some((c) => c.id === updated.id)
      return exists ? prev.map((c) => (c.id === updated.id ? updated : c)) : [...prev, updated]
    })
  }

  async function handleGrayOpsSave(updated: GrayOpsRoster) {
    await updateGrayOpsRoster(updated)
  }

  if (authLoading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-12">
        <p className="text-text-dim">驗證中...</p>
      </div>
    )
  }

  if (!user || (userProfile?.role !== 'ADMIN' && userProfile?.role !== 'OWNER')) {
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

      {/* 版本管理入口 */}
      <div className="mb-6">
        <Link
          to="/admin/versions"
          className="inline-flex items-center gap-3 px-5 py-3 bg-accent-purple/10 border border-accent-purple/30 rounded-xl hover:bg-accent-purple/20 hover:border-accent-purple/50 transition-colors no-underline"
        >
          <span className="text-accent-purple text-xl">📋</span>
          <div>
            <div className="text-sm font-bold text-accent-purple">版本管理</div>
            <div className="text-xs text-text-dim">管理遊戲版本與活動資料</div>
          </div>
          <span className="text-accent-purple/50 ml-2 text-lg">›</span>
        </Link>
      </div>

      {/* 分頁標籤 */}
      <div className="flex gap-2 mb-6 flex-wrap">
        <TabButton active={tab === 'modules'}    onClick={() => setTab('modules')}>模組管理</TabButton>
        <TabButton active={tab === 'mechs'}      onClick={() => setTab('mechs')}>機甲管理</TabButton>
        <TabButton active={tab === 'pilots'}     onClick={() => setTab('pilots')}>機師管理</TabButton>
        <TabButton active={tab === 'weapons'}    onClick={() => setTab('weapons')}>武器管理</TabButton>
        <TabButton active={tab === 'components'} onClick={() => setTab('components')}>元件管理</TabButton>
        <TabButton active={tab === 'backpacks'}  onClick={() => setTab('backpacks')}>背包管理</TabButton>
        <TabButton active={tab === 'users'}      onClick={() => setTab('users')}>用戶管理</TabButton>
        <TabButton active={tab === 'grayops'}    onClick={() => setTab('grayops')}>灰燼行動</TabButton>
      </div>

      {/* 分頁內容 */}
      <div className="bg-bg-card border border-border rounded-xl p-6">
        {tab === 'modules' && (
          <ModuleAdmin modules={modules} mechs={mechs} onModuleSave={handleModuleSave} />
        )}
        {tab === 'mechs' && (
          <MechAdmin mechs={mechs} modules={modules} onMechSave={handleMechSave} />
        )}
        {tab === 'pilots' && (
          <PilotAdmin pilots={pilots} onPilotSave={handlePilotSave} />
        )}
        {tab === 'weapons' && (
          <WeaponAdmin weapons={weapons} pilots={pilots} onWeaponSave={handleWeaponSave} />
        )}
        {tab === 'components' && (
          <ComponentAdmin components={components} onComponentSave={handleComponentSave} />
        )}
        {tab === 'backpacks' && <BackpackAdmin />}
        {tab === 'users' && <UserAdmin currentUid={user.uid} />}
        {tab === 'grayops' && (
          <GrayOpsAdmin roster={ctxGrayOpsRoster} onSave={handleGrayOpsSave} />
        )}
      </div>

      {/* 統計資訊 */}
      {tab !== 'users' && tab !== 'backpacks' && (
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {(tab === 'components' ? [
            { label: '元件總數',  value: components.length, color: 'text-accent-cyan' },
            { label: '觸元件',    value: components.filter((c) => c.componentType === ComponentType.CONDITION).length, color: 'text-accent-purple' },
            { label: '應元件',    value: components.filter((c) => c.componentType === ComponentType.FUNCTION).length, color: 'text-accent-cyan' },
            { label: 'W型元件',   value: components.filter((c) => c.componentsWType === ComponentsWType.W).length, color: 'text-accent-orange' },
          ] : tab === 'pilots' ? [
            { label: '機師總數',  value: pilots.length, color: 'text-accent-cyan' },
            { label: 'S 稀有度',  value: pilots.filter((p) => p.rarity === 'S').length, color: 'text-accent-orange' },
            { label: 'A 稀有度',  value: pilots.filter((p) => p.rarity === 'A').length, color: 'text-accent-green' },
            { label: 'EX 稀有度', value: pilots.filter((p) => p.rarity === 'EX').length, color: 'text-accent-purple' },
          ] : tab === 'weapons' ? [
            { label: '武器總數',  value: weapons.length, color: 'text-accent-cyan' },
            { label: '專屬武器',  value: weapons.filter((w) => w.isExclusive).length, color: 'text-accent-purple' },
            { label: 'SS 稀有度', value: weapons.filter((w) => w.rarity === 'SS').length, color: 'text-accent-orange' },
            { label: '有技能',    value: weapons.filter((w) => (w.skills ?? []).length > 0).length, color: 'text-accent-green' },
          ] : [
            { label: '模組總數', value: modules.length, color: 'text-accent-cyan' },
            { label: '已綁定',   value: modules.filter((m) => m.boundMechId).length, color: 'text-accent-orange' },
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

import { useMemo } from 'react'
import type {
  Pilot, Mech, Module, Weapon, Backpack, Component,
  PilotResearch, GlobalResearch,
} from '../types'
import { ModuleSlot } from '../types/enums'
import { useGameData, EMPTY_GLOBAL_RESEARCH } from '../contexts/GameDataContext'

// ── 通用型別 ──────────────────────────────────────────────────────────────────

export interface HookResult<T> {
  data: T
  loading: boolean
  error: Error | null
}

// ── 機師 ──────────────────────────────────────────────────────────────────────

export function usePilots(): HookResult<Pilot[]> {
  const { pilots, loading, error } = useGameData()
  return { data: pilots, loading, error }
}

export function usePilotNameMap(): HookResult<Record<string, string>> {
  const { pilots, loading, error } = useGameData()
  const data = useMemo(
    () => Object.fromEntries(pilots.map((p) => [p.id, p.name])),
    [pilots],
  )
  return { data, loading, error }
}

export function usePilot(id: string | undefined): HookResult<Pilot | null> {
  const { pilots, loading, error } = useGameData()
  const data = useMemo(
    () => (id ? (pilots.find((p) => p.id === id) ?? null) : null),
    [id, pilots],
  )
  return { data, loading, error }
}

// ── 機甲 ──────────────────────────────────────────────────────────────────────

export function useMechs(): HookResult<Mech[]> {
  const { mechs, loading, error } = useGameData()
  return { data: mechs, loading, error }
}

export function useMech(id: string | undefined): HookResult<Mech | null> {
  const { mechs, loading, error } = useGameData()
  const data = useMemo(
    () => (id ? (mechs.find((m) => m.id === id) ?? null) : null),
    [id, mechs],
  )
  return { data, loading, error }
}

export function useMechNameMap(): HookResult<Record<string, string>> {
  const { mechs, loading, error } = useGameData()
  const data = useMemo(
    () => Object.fromEntries(mechs.map((m) => [m.id, m.name])),
    [mechs],
  )
  return { data, loading, error }
}

export interface MechWithModules {
  mech: Mech
  mod4: Module | null
  mod8: Module | null
  fixedMods: Module[]
  exclusiveMods: Module[]
}

export function useMechWithModules(id: string | undefined): HookResult<MechWithModules | null> {
  const { mechs, modules, loading, error } = useGameData()

  const data = useMemo<MechWithModules | null>(() => {
    if (!id) return null
    const mech = mechs.find((m) => m.id === id) ?? null
    if (!mech) return null
    const find = (mid: string) => modules.find((m) => m.id === mid) ?? null
    const exclusiveMods = modules.filter(
      (m) => m.boundMechId === mech.id && m.slot === ModuleSlot.EXCLUSIVE,
    )
    const exclusiveIds = new Set(exclusiveMods.map((m) => m.id))
    const mod4Candidate = mech.module4Id ? find(mech.module4Id) : null
    const mod8Candidate = mech.module8Id ? find(mech.module8Id) : null
    return {
      mech,
      mod4: mod4Candidate?.slot === ModuleSlot.SLOT_4 ? mod4Candidate : null,
      mod8: mod8Candidate?.slot === ModuleSlot.SLOT_8 ? mod8Candidate : null,
      fixedMods: (mech.moduleFixedIds ?? [])
        .map(find)
        .filter((m): m is Module => m !== null && m.slot === ModuleSlot.BUILT_IN && !exclusiveIds.has(m.id)),
      exclusiveMods,
    }
  }, [id, mechs, modules])

  return { data, loading, error }
}

// ── 模組 ──────────────────────────────────────────────────────────────────────

export function useModules(): HookResult<Module[]> {
  const { modules, loading, error } = useGameData()
  return { data: modules, loading, error }
}

// ── 武器 ──────────────────────────────────────────────────────────────────────

export function useWeapons(): HookResult<Weapon[]> {
  const { weapons, loading, error } = useGameData()
  return { data: weapons, loading, error }
}

export function useWeapon(id: string | undefined): HookResult<Weapon | null> {
  const { weapons, loading, error } = useGameData()
  const data = useMemo(
    () => (id ? (weapons.find((w) => w.id === id) ?? null) : null),
    [id, weapons],
  )
  return { data, loading, error }
}

export function usePilotExclusiveWeapon(pilotId: string | undefined): HookResult<Weapon | null> {
  const { weapons, loading, error } = useGameData()
  const data = useMemo(
    () => (pilotId ? (weapons.find((w) => w.isExclusive && w.exclusiveFor === pilotId) ?? null) : null),
    [pilotId, weapons],
  )
  return { data, loading, error }
}

export function usePilotExclusiveWeapons(pilotId: string | undefined): HookResult<Weapon[]> {
  const { weapons, loading, error } = useGameData()
  const data = useMemo(
    () => (pilotId ? weapons.filter((w) => w.isExclusive && w.exclusiveFor === pilotId) : []),
    [pilotId, weapons],
  )
  return { data, loading, error }
}

// ── 背包 ──────────────────────────────────────────────────────────────────────

export function useBackpacks(): HookResult<Backpack[]> {
  const { backpacks, loading, error } = useGameData()
  return { data: backpacks, loading, error }
}

// ── 元件 ──────────────────────────────────────────────────────────────────────

export function useComponents(): HookResult<Component[]> {
  const { components, loading, error } = useGameData()
  return { data: components, loading, error }
}

// ── 全域科研 ──────────────────────────────────────────────────────────────────

export function useGlobalResearch(): HookResult<GlobalResearch> {
  const { globalResearch, loading, error } = useGameData()
  return { data: globalResearch, loading, error }
}

// ── SimulatorPage 全量資料 ────────────────────────────────────────────────────

export interface AllGameData {
  pilots: Pilot[]
  mechs: Mech[]
  weapons: Weapon[]
  backpacks: Backpack[]
  modules: Module[]
  components: Component[]
  pilotResearch: PilotResearch[]
  globalResearch: GlobalResearch
}

export function useAllGameData(): HookResult<AllGameData | null> {
  const { pilots, mechs, weapons, backpacks, modules, components, pilotResearch, globalResearch, loading, error } = useGameData()

  const data = useMemo<AllGameData | null>(() => {
    if (loading) return null
    return { pilots, mechs, weapons, backpacks, modules, components, pilotResearch, globalResearch }
  }, [loading, pilots, mechs, weapons, backpacks, modules, components, pilotResearch, globalResearch])

  return { data, loading, error }
}

// ── 便利重新整理 ─────────────────────────────────────────────────────────────

export { EMPTY_GLOBAL_RESEARCH }

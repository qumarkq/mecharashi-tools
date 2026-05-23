import { useState, useEffect } from 'react'
import type {
  Pilot, Mech, Module, Weapon, Backpack, Component,
  PilotResearch, GlobalResearch,
} from '../types'
import { ModuleSlot } from '../types/enums'
import {
  getPilots, getPilot,
  getMechs, getMech,
  getModules,
  getWeapons, getWeapon,
  getBackpacks,
  getComponents,
  getAllPilotResearch,
  getGlobalResearch,
} from '../lib/firestoreApi'

// ── 通用型別 ──────────────────────────────────────────────────────────────────

export interface HookResult<T> {
  data: T
  loading: boolean
  error: Error | null
}

// ── 機師 ──────────────────────────────────────────────────────────────────────

export function usePilots(): HookResult<Pilot[]> {
  const [data, setData] = useState<Pilot[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    getPilots()
      .then(setData)
      .catch((e: unknown) => setError(e instanceof Error ? e : new Error(String(e))))
      .finally(() => setLoading(false))
  }, [])

  return { data, loading, error }
}

export function usePilotNameMap(): HookResult<Record<string, string>> {
  const [data, setData] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    getPilots()
      .then((pilots) => setData(Object.fromEntries(pilots.map((p) => [p.id, p.name]))))
      .catch((e: unknown) => setError(e instanceof Error ? e : new Error(String(e))))
      .finally(() => setLoading(false))
  }, [])

  return { data, loading, error }
}

export function usePilot(id: string | undefined): HookResult<Pilot | null> {
  const [data, setData] = useState<Pilot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!id) { setLoading(false); return }
    setLoading(true)
    getPilot(id)
      .then(setData)
      .catch((e: unknown) => setError(e instanceof Error ? e : new Error(String(e))))
      .finally(() => setLoading(false))
  }, [id])

  return { data, loading, error }
}

// ── 機甲 ──────────────────────────────────────────────────────────────────────

export function useMechs(): HookResult<Mech[]> {
  const [data, setData] = useState<Mech[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    getMechs()
      .then(setData)
      .catch((e: unknown) => setError(e instanceof Error ? e : new Error(String(e))))
      .finally(() => setLoading(false))
  }, [])

  return { data, loading, error }
}

export function useMech(id: string | undefined): HookResult<Mech | null> {
  const [data, setData] = useState<Mech | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!id) { setLoading(false); return }
    setLoading(true)
    getMech(id)
      .then(setData)
      .catch((e: unknown) => setError(e instanceof Error ? e : new Error(String(e))))
      .finally(() => setLoading(false))
  }, [id])

  return { data, loading, error }
}

export function useMechNameMap(): HookResult<Record<string, string>> {
  const [data, setData] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    getMechs()
      .then((mechs) => setData(Object.fromEntries(mechs.map((m) => [m.id, m.name]))))
      .catch((e: unknown) => setError(e instanceof Error ? e : new Error(String(e))))
      .finally(() => setLoading(false))
  }, [])

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
  const [data, setData] = useState<MechWithModules | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!id) { setLoading(false); return }
    setLoading(true)
    Promise.all([getMech(id), getModules()])
      .then(([mech, modules]) => {
        if (!mech) { setData(null); return }
        const find = (mid: string) => modules.find((m) => m.id === mid) ?? null
        const exclusiveMods = modules.filter(
          (m) => m.boundMechId === mech.id && m.slot === ModuleSlot.EXCLUSIVE
        )
        const exclusiveIds = new Set(exclusiveMods.map((m) => m.id))
        const mod4Candidate = mech.module4Id ? find(mech.module4Id) : null
        const mod8Candidate = mech.module8Id ? find(mech.module8Id) : null
        setData({
          mech,
          mod4: mod4Candidate?.slot === ModuleSlot.SLOT_4 ? mod4Candidate : null,
          mod8: mod8Candidate?.slot === ModuleSlot.SLOT_8 ? mod8Candidate : null,
          fixedMods: (mech.moduleFixedIds ?? [])
            .map(find)
            .filter((m): m is Module => m !== null && m.slot === ModuleSlot.BUILT_IN && !exclusiveIds.has(m.id)),
          exclusiveMods,
        })
      })
      .catch((e: unknown) => setError(e instanceof Error ? e : new Error(String(e))))
      .finally(() => setLoading(false))
  }, [id])

  return { data, loading, error }
}

// ── 模組 ──────────────────────────────────────────────────────────────────────

export function useModules(): HookResult<Module[]> {
  const [data, setData] = useState<Module[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    getModules()
      .then(setData)
      .catch((e: unknown) => setError(e instanceof Error ? e : new Error(String(e))))
      .finally(() => setLoading(false))
  }, [])

  return { data, loading, error }
}

// ── 武器 ──────────────────────────────────────────────────────────────────────

export function useWeapons(): HookResult<Weapon[]> {
  const [data, setData] = useState<Weapon[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    getWeapons()
      .then(setData)
      .catch((e: unknown) => setError(e instanceof Error ? e : new Error(String(e))))
      .finally(() => setLoading(false))
  }, [])

  return { data, loading, error }
}

export function useWeapon(id: string | undefined): HookResult<Weapon | null> {
  const [data, setData] = useState<Weapon | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!id) { setLoading(false); return }
    setLoading(true)
    getWeapon(id)
      .then(setData)
      .catch((e: unknown) => setError(e instanceof Error ? e : new Error(String(e))))
      .finally(() => setLoading(false))
  }, [id])

  return { data, loading, error }
}

export function usePilotExclusiveWeapon(pilotId: string | undefined): HookResult<Weapon | null> {
  const [data, setData] = useState<Weapon | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!pilotId) { setLoading(false); return }
    setLoading(true)
    getWeapons()
      .then((weapons) => {
        setData(weapons.find((w) => w.isExclusive && w.exclusiveFor === pilotId) ?? null)
      })
      .catch((e: unknown) => setError(e instanceof Error ? e : new Error(String(e))))
      .finally(() => setLoading(false))
  }, [pilotId])

  return { data, loading, error }
}

export function usePilotExclusiveWeapons(pilotId: string | undefined): HookResult<Weapon[]> {
  const [data, setData] = useState<Weapon[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!pilotId) { setLoading(false); return }
    setLoading(true)
    getWeapons()
      .then((weapons) => {
        setData(weapons.filter((w) => w.isExclusive && w.exclusiveFor === pilotId))
      })
      .catch((e: unknown) => setError(e instanceof Error ? e : new Error(String(e))))
      .finally(() => setLoading(false))
  }, [pilotId])

  return { data, loading, error }
}

// ── 背包 ──────────────────────────────────────────────────────────────────────

export function useBackpacks(): HookResult<Backpack[]> {
  const [data, setData] = useState<Backpack[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    getBackpacks()
      .then(setData)
      .catch((e: unknown) => setError(e instanceof Error ? e : new Error(String(e))))
      .finally(() => setLoading(false))
  }, [])

  return { data, loading, error }
}

// ── 元件 ──────────────────────────────────────────────────────────────────────

export function useComponents(): HookResult<Component[]> {
  const [data, setData] = useState<Component[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    getComponents()
      .then(setData)
      .catch((e: unknown) => setError(e instanceof Error ? e : new Error(String(e))))
      .finally(() => setLoading(false))
  }, [])

  return { data, loading, error }
}

// ── 全域科研 ──────────────────────────────────────────────────────────────────

const EMPTY_GLOBAL_RESEARCH: GlobalResearch = {
  pilotResearchByClass: {},
  mechResearchByType:   {},
  weaponResearchByType: {},
}

export function useGlobalResearch(): HookResult<GlobalResearch> {
  const [data, setData] = useState<GlobalResearch>(EMPTY_GLOBAL_RESEARCH)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    getGlobalResearch()
      .then((res) => setData(res ?? EMPTY_GLOBAL_RESEARCH))
      .catch((e: unknown) => setError(e instanceof Error ? e : new Error(String(e))))
      .finally(() => setLoading(false))
  }, [])

  return { data, loading, error }
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
  const [data, setData] = useState<AllGameData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    Promise.all([
      getPilots(),
      getMechs(),
      getWeapons(),
      getBackpacks(),
      getModules(),
      getComponents(),
      getAllPilotResearch(),
      getGlobalResearch(),
    ])
      .then(([pilots, mechs, weapons, backpacks, modules, components, pilotResearch, globalResearch]) => {
        setData({
          pilots,
          mechs,
          weapons,
          backpacks,
          modules,
          components,
          pilotResearch,
          globalResearch: globalResearch ?? EMPTY_GLOBAL_RESEARCH,
        })
      })
      .catch((e: unknown) => setError(e instanceof Error ? e : new Error(String(e))))
      .finally(() => setLoading(false))
  }, [])

  return { data, loading, error }
}

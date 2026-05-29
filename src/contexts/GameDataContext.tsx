import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from 'react'
import type { Pilot, Mech, Module, Weapon, Backpack, Component, GlobalResearch, GrayOpsRoster } from '../types'
import {
  getPilots, getMechs, getModules, getWeapons, getBackpacks, getComponents,
  getGlobalResearch, getGrayOpsRoster,
} from '../lib/firestoreApi'

export const EMPTY_GLOBAL_RESEARCH: GlobalResearch = {
  pilotResearchByClass: {},
  mechResearchByType:   {},
  weaponResearchByType: {},
}

export type CollectionKey =
  | 'pilots' | 'mechs' | 'modules' | 'weapons'
  | 'backpacks' | 'components' | 'globalResearch' | 'grayOpsRoster'

export const ALL_COLLECTION_KEYS: CollectionKey[] = [
  'pilots', 'mechs', 'modules', 'weapons',
  'backpacks', 'components', 'globalResearch', 'grayOpsRoster',
]

export interface GameDataState {
  pilots:         Pilot[]
  mechs:          Mech[]
  weapons:        Weapon[]
  backpacks:      Backpack[]
  modules:        Module[]
  components:     Component[]
  globalResearch: GlobalResearch
  grayOpsRoster:  GrayOpsRoster | null
  loadedKeys:     ReadonlySet<CollectionKey>
  errorMap:       Readonly<Partial<Record<CollectionKey, Error>>>
  reloadTick:     number
  ensureLoaded:   (keys: CollectionKey[]) => void
  reload:         () => void
}

const GameDataContext = createContext<GameDataState | null>(null)

export function GameDataProvider({ children }: { children: ReactNode }) {
  const [pilots,         setPilots]         = useState<Pilot[]>([])
  const [mechs,          setMechs]          = useState<Mech[]>([])
  const [weapons,        setWeapons]        = useState<Weapon[]>([])
  const [backpacks,      setBackpacks]      = useState<Backpack[]>([])
  const [modules,        setModules]        = useState<Module[]>([])
  const [components,     setComponents]     = useState<Component[]>([])
  const [globalResearch, setGlobalResearch] = useState<GlobalResearch>(EMPTY_GLOBAL_RESEARCH)
  const [grayOpsRoster,  setGrayOpsRoster]  = useState<GrayOpsRoster | null>(null)
  const [loadedKeys,     setLoadedKeys]     = useState<Set<CollectionKey>>(new Set())
  const [errorMap,       setErrorMap]       = useState<Partial<Record<CollectionKey, Error>>>({})
  const [reloadTick,     setReloadTick]     = useState(0)

  // Tracks keys that are already in-flight or done (synchronous check, prevents double-fetch)
  const fetchedRef = useRef<Set<CollectionKey>>(new Set())

  const ensureLoaded = useCallback(async (keys: CollectionKey[]) => {
    const toFetch = keys.filter(k => !fetchedRef.current.has(k))
    if (toFetch.length === 0) return

    toFetch.forEach(k => fetchedRef.current.add(k))

    await Promise.all(toFetch.map(async (key) => {
      try {
        switch (key) {
          case 'pilots':         setPilots(await getPilots()); break
          case 'mechs':          setMechs(await getMechs()); break
          case 'modules':        setModules(await getModules()); break
          case 'weapons':        setWeapons(await getWeapons()); break
          case 'backpacks':      setBackpacks(await getBackpacks()); break
          case 'components':     setComponents(await getComponents()); break
          case 'globalResearch': {
            const gr = await getGlobalResearch()
            setGlobalResearch(gr ?? EMPTY_GLOBAL_RESEARCH)
            break
          }
          case 'grayOpsRoster':  setGrayOpsRoster(await getGrayOpsRoster()); break
        }
        setLoadedKeys(prev => new Set([...prev, key]))
      } catch (e) {
        fetchedRef.current.delete(key)
        const err = e instanceof Error ? e : new Error(String(e))
        setErrorMap(prev => ({ ...prev, [key]: err }))
      }
    }))
  }, [])

  const reload = useCallback(() => {
    fetchedRef.current.clear()
    setLoadedKeys(new Set())
    setErrorMap({})
    setReloadTick(t => t + 1)
  }, [])

  return (
    <GameDataContext.Provider value={{
      pilots, mechs, weapons, backpacks, modules, components,
      globalResearch, grayOpsRoster,
      loadedKeys, errorMap, reloadTick,
      ensureLoaded, reload,
    }}>
      {children}
    </GameDataContext.Provider>
  )
}

export function useGameData(): GameDataState {
  const ctx = useContext(GameDataContext)
  if (!ctx) throw new Error('useGameData must be used within GameDataProvider')
  return ctx
}

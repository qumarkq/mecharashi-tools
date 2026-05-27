import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
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

export interface GameDataState {
  pilots:         Pilot[]
  mechs:          Mech[]
  weapons:        Weapon[]
  backpacks:      Backpack[]
  modules:        Module[]
  components:     Component[]
  globalResearch: GlobalResearch
  grayOpsRoster:  GrayOpsRoster | null
  loading:        boolean
  error:          Error | null
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
  const [loading,        setLoading]        = useState(true)
  const [error,          setError]          = useState<Error | null>(null)
  const [tick,           setTick]           = useState(0)

  const reload = useCallback(() => setTick(t => t + 1), [])

  useEffect(() => {
    setLoading(true)
    setError(null)
    Promise.all([
      getPilots(),
      getMechs(),
      getWeapons(),
      getBackpacks(),
      getModules(),
      getComponents(),
      getGlobalResearch(),
      getGrayOpsRoster(),
    ])
      .then(([p, m, w, b, mo, co, gr, gor]) => {
        setPilots(p)
        setMechs(m)
        setWeapons(w)
        setBackpacks(b)
        setModules(mo)
        setComponents(co)
        setGlobalResearch(gr ?? EMPTY_GLOBAL_RESEARCH)
        setGrayOpsRoster(gor)
      })
      .catch((e: unknown) => setError(e instanceof Error ? e : new Error(String(e))))
      .finally(() => setLoading(false))
  }, [tick])

  return (
    <GameDataContext.Provider value={{
      pilots, mechs, weapons, backpacks, modules, components,
      globalResearch, grayOpsRoster, loading, error, reload,
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

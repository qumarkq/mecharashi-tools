import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  query,
  where,
  orderBy,
  QueryConstraint,
} from 'firebase/firestore'
import { db } from './firebase'
import type { Pilot, Mech, Module, Weapon, Backpack, Component, PilotResearch, GlobalResearch } from '../types'

// ── 通用輔助 ──────────────────────────────────────────────────────────────────

async function fetchCollection<T>(collectionName: string, constraints: QueryConstraint[] = []): Promise<T[]> {
  const ref = collection(db, collectionName)
  const q   = constraints.length > 0 ? query(ref, ...constraints) : query(ref)
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ ...d.data(), id: d.id }) as T)
}

async function fetchDocument<T>(collectionName: string, id: string): Promise<T | null> {
  const snap = await getDoc(doc(db, collectionName, id))
  return snap.exists() ? ({ ...snap.data(), id: snap.id } as T) : null
}

// ── 遊戲資料 API ──────────────────────────────────────────────────────────────

export const getPilots = () =>
  fetchCollection<Pilot>('pilots', [orderBy('rarity', 'desc')])

export const getPilot = (id: string) =>
  fetchDocument<Pilot>('pilots', id)

export const getPilotsByClass = (pilotClass: string) =>
  fetchCollection<Pilot>('pilots', [where('class', '==', pilotClass), orderBy('rarity', 'desc')])

export const getMechs = () =>
  fetchCollection<Mech>('mechs')

export const getMech = (id: string) =>
  fetchDocument<Mech>('mechs', id)

export const getModules = () =>
  fetchCollection<Module>('modules')

export const getAvailableModules = () =>
  fetchCollection<Module>('modules', [where('available', '==', true), orderBy('slot')])

export const getModulesByMech = (mechId: string) =>
  fetchCollection<Module>('modules', [where('boundMechId', '==', mechId)])

export const getWeapons = () =>
  fetchCollection<Weapon>('weapons')

export const getWeapon = (id: string) =>
  fetchDocument<Weapon>('weapons', id)

export const getBackpacks = () =>
  fetchCollection<Backpack>('backpacks')

export const getComponents = () =>
  fetchCollection<Component>('components')

export const getPilotResearch = (pilotId: string) =>
  fetchCollection<PilotResearch>('pilotResearch', [where('pilotId', '==', pilotId)])

export const getAllPilotResearch = () =>
  fetchCollection<PilotResearch>('pilotResearch')

export const getGlobalResearch = async (): Promise<GlobalResearch | null> =>
  fetchDocument<GlobalResearch>('globalResearch', 'global')

// ── 管理後台寫入 ──────────────────────────────────────────────────────────────

export const updateModule = async (module: Module): Promise<void> => {
  const { id, ...data } = module
  await setDoc(doc(db, 'modules', id), data)
}

export const updateMech = async (mech: Mech): Promise<void> => {
  const { id, ...data } = mech
  await setDoc(doc(db, 'mechs', id), data)
}

export const updatePilot = async (pilot: Pilot): Promise<void> => {
  const { id, ...data } = pilot
  await setDoc(doc(db, 'pilots', id), data)
}

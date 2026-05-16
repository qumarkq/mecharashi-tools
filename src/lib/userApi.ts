import {
  doc,
  getDoc,
  setDoc,
  collection,
  collectionGroup,
  getDocs,
  addDoc,
  deleteDoc,
  query,
  orderBy,
} from 'firebase/firestore'
import { db } from './firebase'
import type { UserProfile, UserBuild, Build, UserResearchLevels } from '../types'

const profileDoc = (uid: string) => doc(db, 'users', uid, 'profile', 'main')
const buildsCol = (uid: string) => collection(db, 'users', uid, 'builds')

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(profileDoc(uid))
  return snap.exists() ? (snap.data() as UserProfile) : null
}

export async function initUserProfile(
  uid: string,
  data: Pick<UserProfile, 'displayName' | 'email' | 'photoURL'>
): Promise<void> {
  const ref = profileDoc(uid)
  const snap = await getDoc(ref)
  if (!snap.exists()) {
    const now = new Date().toISOString()
    await setDoc(ref, {
      uid,
      ...data,
      role: 'USER',
      researchLevels: { pilotByClass: {}, mechByType: {}, weaponByType: {} },
      createdAt: now,
      updatedAt: now,
    })
  }
}

export async function patchUserProfile(uid: string, data: Partial<UserProfile>): Promise<void> {
  await setDoc(profileDoc(uid), { ...data, updatedAt: new Date().toISOString() }, { merge: true })
}

export async function getAllUsers(): Promise<UserProfile[]> {
  // 需要 Firestore 規則允許管理者讀取所有 users/{uid}/profile 子集合
  const snap = await getDocs(collectionGroup(db, 'profile'))
  return snap.docs.map((d) => d.data() as UserProfile)
}

export async function updateUserRole(uid: string, role: 'USER' | 'ADMIN'): Promise<void> {
  await setDoc(profileDoc(uid), { role, updatedAt: new Date().toISOString() }, { merge: true })
}

export async function saveResearchLevels(
  uid: string,
  levels: UserResearchLevels
): Promise<void> {
  await setDoc(
    profileDoc(uid),
    { researchLevels: levels, updatedAt: new Date().toISOString() },
    { merge: true }
  )
}

export async function getUserBuilds(uid: string): Promise<UserBuild[]> {
  const q = query(buildsCol(uid), orderBy('updatedAt', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ ...d.data(), id: d.id }) as UserBuild)
}

export async function saveBuild(uid: string, build: Build): Promise<string> {
  const now = new Date().toISOString()
  const ref = await addDoc(buildsCol(uid), {
    ...build,
    createdAt: build.createdAt ?? now,
    updatedAt: now,
  })
  return ref.id
}

export async function deleteBuild(uid: string, buildId: string): Promise<void> {
  await deleteDoc(doc(db, 'users', uid, 'builds', buildId))
}

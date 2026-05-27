import { useState, useEffect } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { PATCH_VERSIONS } from '../data/patchVersions'
import type { PatchVersion } from '../data/patchVersions'

export interface PatchVersionsResult {
  data: PatchVersion[]
  loading: boolean
  error: Error | null
}

export function usePatchVersions(): PatchVersionsResult {
  const [data, setData]       = useState<PatchVersion[]>(PATCH_VERSIONS)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<Error | null>(null)

  useEffect(() => {
    getDocs(collection(db, 'patchVersions'))
      .then((snap) => {
        if (!snap.empty) {
          const versions = snap.docs
            .map(d => d.data() as PatchVersion)
            .sort((a, b) => parseFloat(a.version) - parseFloat(b.version))
          setData(versions)
        }
        // empty collection → keep static fallback already in state
        setLoading(false)
      })
      .catch((err: unknown) => {
        console.error('[usePatchVersions] Firestore error, using static fallback:', err)
        setError(err instanceof Error ? err : new Error(String(err)))
        setLoading(false)
      })
  }, [])

  return { data, loading, error }
}

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

interface CacheEntry {
  data: PatchVersion[]
  error: Error | null
}

// Module-level singleton: one fetch per app session, shared across all mounts.
let _cache: CacheEntry | null = null
let _promise: Promise<CacheEntry> | null = null

function _fetchOnce(): Promise<CacheEntry> {
  if (_cache !== null) return Promise.resolve(_cache)
  if (_promise !== null) return _promise
  _promise = getDocs(collection(db, 'patchVersions'))
    .then(snap => {
      const data = snap.empty
        ? PATCH_VERSIONS
        : snap.docs
            .map(d => d.data() as PatchVersion)
            .sort((a, b) => parseFloat(a.version) - parseFloat(b.version))
      _cache = { data, error: null }
      return _cache
    })
    .catch(err => {
      console.error('[usePatchVersions] Firestore error, using static fallback:', err)
      _cache = {
        data: PATCH_VERSIONS,
        error: err instanceof Error ? err : new Error(String(err)),
      }
      _promise = null
      return _cache
    })
  return _promise
}

/** Call after admin saves a version so the next usePatchVersions re-fetches. */
export function invalidatePatchVersionsCache(): void {
  _cache = null
  _promise = null
}

export function usePatchVersions(): PatchVersionsResult {
  const [result, setResult] = useState<CacheEntry>(
    _cache ?? { data: PATCH_VERSIONS, error: null },
  )
  const [loading, setLoading] = useState(_cache === null)

  useEffect(() => {
    if (_cache !== null) {
      // Already resolved before mount — no async needed
      setResult(_cache)
      setLoading(false)
      return
    }
    let cancelled = false
    _fetchOnce().then(entry => {
      if (!cancelled) {
        setResult(entry)
        setLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [])

  return { data: result.data, loading, error: result.error }
}

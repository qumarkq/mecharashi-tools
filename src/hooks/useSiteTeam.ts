import { useEffect, useState } from 'react'
import { getSiteTeamProfiles } from '../lib/userApi'
import type { UserProfile } from '../types'

let _cache: UserProfile[] | null = null

export function useSiteTeam() {
  const [owners, setOwners] = useState<UserProfile[]>([])
  const [admins, setAdmins] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(_cache === null)

  useEffect(() => {
    if (_cache !== null) {
      setOwners(_cache.filter(p => p.role === 'OWNER'))
      setAdmins(_cache.filter(p => p.role === 'ADMIN'))
      return
    }
    getSiteTeamProfiles()
      .then(profiles => {
        _cache = profiles
        setOwners(profiles.filter(p => p.role === 'OWNER'))
        setAdmins(profiles.filter(p => p.role === 'ADMIN'))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return { owners, admins, loading }
}

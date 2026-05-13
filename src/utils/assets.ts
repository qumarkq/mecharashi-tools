const BASE = import.meta.env.BASE_URL

export function assetUrl(path: string): string {
  return `${BASE}${path.replace(/^\//, '')}`
}

export async function fetchData<T>(file: string): Promise<T> {
  const res = await fetch(`${BASE}data/${file}`)
  if (!res.ok) throw new Error(`Failed to load ${file}`)
  return res.json()
}

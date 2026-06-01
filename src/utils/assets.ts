const BASE = import.meta.env.BASE_URL

export function assetUrl(path: string): string {
  return `${BASE}${path.replace(/^\//, '')}`
}

/**
 * 解析 icon URL 給 <img src> 使用。
 * - 遠端 URL（http/https）原樣返回
 * - 本地路徑一律正規化為 /images/... 後套上 BASE_URL
 *   （容錯處理舊資料殘留的 mecharashi-tools/public/ 前綴）
 */
export function resolveIconSrc(url: string): string {
  if (/^https?:\/\//i.test(url)) return url
  const idx = url.indexOf('/images/')
  const path = idx >= 0 ? url.slice(idx) : url
  return assetUrl(path)
}

export async function fetchData<T>(file: string): Promise<T> {
  const res = await fetch(`${BASE}data/${file}`)
  if (!res.ok) throw new Error(`Failed to load ${file}`)
  return res.json()
}

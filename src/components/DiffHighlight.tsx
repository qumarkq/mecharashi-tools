function lcsMatched(a: string[], b: string[]): boolean[] {
  const m = a.length, n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1])
  const matched = new Array(n).fill(false)
  let i = m, j = n
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) { matched[j - 1] = true; i--; j-- }
    else if (dp[i - 1][j] >= dp[i][j - 1]) i--
    else j--
  }
  return matched
}

export function DiffHighlight({ base, enhanced }: { base: string; enhanced: string }) {
  const tokenize = (s: string) =>
    s.match(/\d+(?:\.\d+)?%?|[a-zA-Z]+|[一-鿿]+|[^\w\d一-鿿\s]|\s+/g) ?? []
  const baseTokens = tokenize(base)
  const enhTokens  = tokenize(enhanced)
  const matched    = lcsMatched(baseTokens, enhTokens)
  return (
    <>
      {enhTokens.map((token, i) => {
        if (/^\s+$/.test(token)) return <span key={i}>{token}</span>
        if (!matched[i]) return <strong key={i} className="text-accent-yellow font-bold">{token}</strong>
        if (/^\d+(?:\.\d+)?%?$/.test(token)) return <span key={i} className="text-accent-red font-bold">{token}</span>
        return <span key={i}>{token}</span>
      })}
    </>
  )
}

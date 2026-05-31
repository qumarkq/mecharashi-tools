export type ChangelogType = 'feat' | 'fix' | 'perf' | 'style' | 'refactor'

export interface ChangelogEntry {
  date: string   // YYYY-MM-DD
  type: ChangelogType
  summary: string
}

export interface ChangelogMonth {
  month: string  // YYYY-MM
  entries: ChangelogEntry[]
}

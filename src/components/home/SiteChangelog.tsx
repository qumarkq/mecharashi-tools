import { useState } from 'react'
import { SITE_CHANGELOG } from '../../data/siteChangelog'
import type { ChangelogType } from '../../data/siteChangelog'

const TYPE_META: Record<ChangelogType, { label: string; color: string }> = {
  feat:     { label: '新功能', color: 'text-accent-green' },
  fix:      { label: '修正',   color: 'text-accent-orange' },
  perf:     { label: '效能',   color: 'text-accent-cyan' },
  style:    { label: '外觀',   color: 'text-accent-purple' },
  refactor: { label: '重構',   color: 'text-accent-yellow' },
}

export default function SiteChangelog() {
  const [expanded, setExpanded] = useState(false)

  const entries = SITE_CHANGELOG
    .flatMap(m => m.entries)
    .sort((a, b) => b.date.localeCompare(a.date))

  const latest = entries[0]

  return (
    <div className="rounded-lg border border-border/40 bg-bg-dark/40 text-xs overflow-hidden">
      {/* Header row — always visible, click to toggle */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-white/5 transition-colors"
      >
        <span className="text-text-dim tracking-wider shrink-0">網站更新履歷</span>
        {!expanded && latest && (
          <>
            <span className="text-border/60 mx-0.5">｜</span>
            <span className="text-text-dim tabular-nums shrink-0">{latest.date.slice(5)}</span>
            <span className="text-text-secondary truncate flex-1 ml-1">{latest.summary}</span>
          </>
        )}
        <span className="ml-auto text-text-dim shrink-0 pl-2">
          {expanded ? '▲' : '▼'}
        </span>
      </button>

      {/* Expanded entry list */}
      {expanded && (
        <div className="border-t border-border/40 px-3 py-2 flex flex-col gap-0.5 max-h-52 overflow-y-auto">
          {entries.map((entry, i) => {
            const meta = TYPE_META[entry.type]
            return (
              <div key={i} className="flex items-baseline gap-2 leading-5">
                <span className="text-text-dim tabular-nums shrink-0">{entry.date.slice(5)}</span>
                <span className={`shrink-0 font-semibold w-10 text-right ${meta.color}`}>{meta.label}</span>
                <span className="text-text-secondary">{entry.summary}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

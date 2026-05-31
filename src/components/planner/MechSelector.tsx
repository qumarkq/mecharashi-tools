import { useState, useRef, useEffect } from 'react'
import type { Mech } from '../../types'

interface MechSelectorProps {
  mechs:    Mech[]
  loading:  boolean
  selected: Mech | null
  onSelect: (mech: Mech) => void
  disabled?: boolean       // 尚未選擇裝甲類型時鎖住
}

export function MechSelector({ mechs, loading, selected, onSelect, disabled = false }: MechSelectorProps) {
  const [open, setOpen]     = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // 鎖住時關閉下拉
  useEffect(() => { if (disabled) setOpen(false) }, [disabled])

  const filtered = mechs.filter((m) => !search || m.name.includes(search))

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => { if (!disabled) setOpen(!open) }}
        disabled={disabled}
        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-bg-card border border-border hover:border-border-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-border"
      >
        {selected ? (
          <span className="text-[14px] font-semibold text-text-primary">{selected.name}</span>
        ) : (
          <span className="text-[14px] text-text-dim">{disabled ? '請先選裝甲類型' : '選擇機甲…'}</span>
        )}
        <span className="text-text-dim text-[11px] ml-0.5">{open ? '▴' : '▾'}</span>
      </button>

      {open && !disabled && (
        <div className="absolute top-full mt-1 z-50 bg-bg-card border border-border rounded-xl shadow-xl w-72 overflow-hidden">
          <div className="p-2 border-b border-border">
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜尋機甲名稱…"
              className="w-full px-2.5 py-1.5 rounded-lg bg-bg-dark border border-border text-[13px] text-text-primary placeholder-text-dim focus:outline-none focus:border-border-accent"
            />
          </div>
          <div className="max-h-64 overflow-y-auto p-1.5 flex flex-col gap-0.5">
            {loading && (
              <div className="text-center text-text-dim text-[13px] py-4 animate-pulse">載入中…</div>
            )}
            {!loading && filtered.length === 0 && (
              <div className="text-center text-text-dim text-[13px] py-4">找不到機甲</div>
            )}
            {!loading && filtered.map((m) => (
              <button
                key={m.id}
                onClick={() => { onSelect(m); setOpen(false); setSearch('') }}
                className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-left w-full transition-colors hover:bg-bg-card-hover ${
                  selected?.id === m.id ? 'bg-bg-card-hover' : ''
                }`}
              >
                <span className="text-[13px] text-text-primary font-medium flex-1">{m.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

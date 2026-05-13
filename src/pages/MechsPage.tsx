import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import type { Mech } from '../types'
import { fetchData } from '../utils/assets'

const ARMOR_TYPES = ['輕型', '中甲', '重型']

const ARMOR_STYLES: Record<string, { text: string; border: string; bg: string }> = {
  輕型: { text: 'text-accent-cyan', border: 'border-accent-cyan/40', bg: 'bg-accent-cyan/10' },
  中甲: { text: 'text-accent-green', border: 'border-accent-green/40', bg: 'bg-accent-green/10' },
  重型: { text: 'text-accent-red', border: 'border-accent-red/40', bg: 'bg-accent-red/10' },
}

function StatBar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = Math.min((value / max) * 100, 100)
  return (
    <div>
      <div className="flex justify-between text-[11px] mb-0.5">
        <span className="text-text-dim">{label}</span>
        <span className="text-text-secondary font-[JetBrains_Mono,monospace] font-semibold">
          {value.toLocaleString()}
        </span>
      </div>
      <div className="h-1.5 bg-bg-dark rounded-full overflow-hidden">
        <div
          className="h-full bg-accent-orange rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export default function MechsPage() {
  const [mechs, setMechs] = useState<Mech[]>([])
  const [loading, setLoading] = useState(true)
  const [armorFilter, setArmorFilter] = useState('')

  useEffect(() => {
    fetchData<Mech[]>('mechs.json')
      .then(setMechs)
      .finally(() => setLoading(false))
  }, [])

  const filtered = mechs.filter((m) => !armorFilter || m.armorType === armorFilter)

  const filterBtn = (active: boolean) =>
    `px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
      active
        ? 'bg-accent-orange/15 text-accent-orange border-accent-orange/40'
        : 'bg-bg-card text-text-secondary border-border hover:border-border-accent hover:text-text-primary'
    }`

  const MAX_FP = Math.max(...mechs.map((m) => m.firepower), 1)
  const MAX_EV = Math.max(...mechs.map((m) => m.evasion), 1)
  const MAX_MB = Math.max(...mechs.map((m) => m.mobility), 1)

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <div className="mb-8">
        <span className="text-xs text-accent-orange tracking-[3px] uppercase font-[Orbitron,sans-serif]">
          Database
        </span>
        <h1 className="text-3xl font-bold mt-2">機甲圖鑑</h1>
        <p className="text-text-secondary mt-2">
          瀏覽所有機甲的部件耐久、火力、模組配置。共 {mechs.length} 架機甲。
        </p>
      </div>

      {/* Filters */}
      <div className="bg-bg-card border border-border rounded-xl p-4 mb-6 flex flex-wrap gap-2 items-center">
        <span className="text-xs text-text-dim mr-1">裝甲</span>
        <button className={filterBtn(!armorFilter)} onClick={() => setArmorFilter('')}>
          全部
        </button>
        {ARMOR_TYPES.map((a) => {
          const s = ARMOR_STYLES[a]
          const active = armorFilter === a
          return (
            <button
              key={a}
              onClick={() => setArmorFilter(active ? '' : a)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                active && s
                  ? `${s.bg} ${s.text} ${s.border}`
                  : 'bg-bg-card text-text-secondary border-border hover:border-border-accent hover:text-text-primary'
              }`}
            >
              {a}
            </button>
          )
        })}
      </div>

      {!loading && (
        <p className="text-xs text-text-dim mb-4">
          顯示 {filtered.length} / {mechs.length} 架機甲
        </p>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-bg-card border border-border rounded-xl h-48 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((mech) => {
            const s = ARMOR_STYLES[mech.armorType]
            return (
              <Link
                key={mech.id}
                to={`/mechs/${mech.id}`}
                className="group block bg-bg-card border border-border rounded-xl p-5 no-underline transition-all hover:bg-bg-card-hover hover:border-border-accent hover:-translate-y-0.5"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-base text-text-primary group-hover:text-accent-orange transition-colors">
                      {mech.name}
                    </h3>
                    {s && (
                      <span
                        className={`inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold border ${s.bg} ${s.text} ${s.border}`}
                      >
                        {mech.armorType}
                      </span>
                    )}
                  </div>
                  <div className="text-right text-xs text-text-dim">
                    <p>
                      出力{' '}
                      <span className="text-accent-cyan font-bold">
                        {mech.output.toLocaleString()}
                      </span>
                    </p>
                    <p>
                      重量{' '}
                      <span className="text-text-secondary">{mech.weight.toLocaleString()}</span>
                    </p>
                  </div>
                </div>

                {/* Stat Bars */}
                <div className="space-y-2">
                  <StatBar label="火力" value={mech.firepower} max={MAX_FP} />
                  <StatBar label="閃避" value={mech.evasion} max={MAX_EV} />
                  <StatBar label="移動" value={mech.mobility} max={MAX_MB} />
                </div>

                {/* Parts */}
                <div className="mt-4 grid grid-cols-4 gap-1 text-center">
                  {[
                    { label: '軀幹', value: mech.parts.torso },
                    { label: '左臂', value: mech.parts.leftArm },
                    { label: '右臂', value: mech.parts.rightArm },
                    { label: '腿部', value: mech.parts.legs },
                  ].map((p) => (
                    <div key={p.label} className="bg-bg-dark border border-border rounded-lg p-1.5">
                      <p className="text-[9px] text-text-dim">{p.label}</p>
                      <p className="text-[11px] font-bold text-text-secondary">
                        {p.value.toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="bg-bg-card border border-border rounded-xl p-12 text-center text-text-dim">
          沒有符合條件的機甲
        </div>
      )}
    </div>
  )
}

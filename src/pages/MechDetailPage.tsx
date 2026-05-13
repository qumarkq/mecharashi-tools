import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import type { Mech, MechModule } from '../types'
import { fetchData } from '../utils/assets'

const ARMOR_STYLES: Record<string, string> = {
  輕型: 'text-accent-cyan bg-accent-cyan/10 border-accent-cyan/40',
  中甲: 'text-accent-green bg-accent-green/10 border-accent-green/40',
  重型: 'text-accent-red bg-accent-red/10 border-accent-red/40',
}

function ModuleCard({
  mod,
  label,
  color,
}: {
  mod: MechModule
  label: string
  color: string
}) {
  return (
    <div className={`bg-bg-dark rounded-xl border ${color} p-4`}>
      <p className="text-[10px] text-text-dim uppercase tracking-widest mb-1">{label}</p>
      <p className="font-bold text-sm text-text-primary mb-2">{mod.name}</p>
      <p className="text-xs text-text-secondary leading-relaxed">{mod.description}</p>
      {(mod.dmg || mod.crit || mod.critDmg || mod.acc) ? (
        <div className="flex flex-wrap gap-2 mt-2">
          {mod.dmg ? <Stat label="增傷" value={`+${mod.dmg}%`} /> : null}
          {mod.crit ? <Stat label="爆率" value={`+${mod.crit}`} /> : null}
          {mod.critDmg ? <Stat label="爆傷" value={`+${mod.critDmg}%`} /> : null}
          {mod.acc ? <Stat label="命中" value={`+${mod.acc}`} /> : null}
        </div>
      ) : null}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <span className="text-[11px] bg-bg-card border border-border rounded px-2 py-0.5">
      <span className="text-text-dim">{label} </span>
      <span className="text-accent-orange font-bold">{value}</span>
    </span>
  )
}

function AttrRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-border last:border-0">
      <span className="text-text-dim text-sm">{label}</span>
      <span className="text-text-primary font-medium font-[JetBrains_Mono,monospace]">{value}</span>
    </div>
  )
}

export default function MechDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [mech, setMech] = useState<Mech | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData<Mech[]>('mechs.json').then((list) => {
      setMech(list.find((m) => m.id === id) ?? null)
      setLoading(false)
    })
  }, [id])

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-12">
        <div className="h-96 bg-bg-card border border-border rounded-xl animate-pulse" />
      </div>
    )
  }

  if (!mech) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-12 text-center text-text-dim">
        <p>找不到機甲資料</p>
        <Link to="/mechs" className="text-accent-orange no-underline text-sm mt-4 inline-block">
          ← 返回機甲圖鑑
        </Link>
      </div>
    )
  }

  const armorCls = ARMOR_STYLES[mech.armorType] ?? 'text-text-secondary bg-bg-card border-border'

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <Link
        to="/mechs"
        className="inline-flex items-center gap-1 text-sm text-text-dim hover:text-text-primary no-underline mb-6 transition-colors"
      >
        ← 機甲圖鑑
      </Link>

      {/* Header */}
      <div className="mb-8">
        <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold border mb-2 ${armorCls}`}>
          {mech.armorType}
        </span>
        <h1 className="text-3xl font-black">{mech.name}</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Attributes */}
        <div className="bg-bg-card border border-border rounded-xl p-5">
          <SectionLabel>機甲屬性</SectionLabel>
          <AttrRow label="火力" value={mech.firepower.toLocaleString()} />
          <AttrRow label="裝甲均值" value={mech.armor.toLocaleString()} />
          <AttrRow label="閃避" value={mech.evasion.toLocaleString()} />
          <AttrRow label="移動力" value={mech.mobility} />
          <AttrRow label="重量" value={mech.weight.toLocaleString()} />
          <AttrRow label="出力" value={mech.output.toLocaleString()} />
        </div>

        {/* Parts */}
        <div className="bg-bg-card border border-border rounded-xl p-5">
          <SectionLabel>部件耐久</SectionLabel>
          <AttrRow label="軀幹" value={mech.parts.torso.toLocaleString()} />
          <AttrRow label="左臂" value={mech.parts.leftArm.toLocaleString()} />
          <AttrRow label="右臂" value={mech.parts.rightArm.toLocaleString()} />
          <AttrRow label="腿部" value={mech.parts.legs.toLocaleString()} />
        </div>
      </div>

      {/* Modules */}
      <div>
        <SectionLabel>機甲模組</SectionLabel>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <ModuleCard mod={mech.module4} label="四模組" color="border-border" />
          <ModuleCard mod={mech.module8} label="八模組" color="border-accent-orange/30" />
          <ModuleCard mod={mech.moduleFixed} label="固定模組" color="border-accent-cyan/30" />
        </div>
      </div>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-xs text-accent-orange tracking-[3px] uppercase font-[Orbitron,sans-serif] mb-3">
      {children}
    </div>
  )
}

import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import type { Mech, MechPart, Module } from '../types'
import { fetchData, assetUrl } from '../utils/assets'

const ARMOR_STYLES: Record<string, string> = {
  輕型: 'text-accent-cyan bg-accent-cyan/10 border-accent-cyan/40',
  中甲: 'text-accent-green bg-accent-green/10 border-accent-green/40',
  重型: 'text-accent-red bg-accent-red/10 border-accent-red/40',
}

const PART_NAMES: Record<string, string> = {
  torso: '軀幹',
  leftArm: '左臂',
  rightArm: '右臂',
  legs: '腿部',
}

function ModuleCard({
  mod,
  label,
  color,
}: {
  mod: Module | null
  label: string
  color: string
}) {
  if (!mod) {
    return (
      <div className={`bg-bg-dark rounded-xl border ${color} p-4 opacity-50`}>
        <p className="text-[10px] text-text-dim uppercase tracking-widest mb-1">{label}</p>
        <p className="text-xs text-text-dim">未設定</p>
      </div>
    )
  }
  return (
    <div className={`bg-bg-dark rounded-xl border ${color} p-4`}>
      <p className="text-[10px] text-text-dim uppercase tracking-widest mb-1">{label}</p>
      <div className="flex items-center gap-2 mb-2">
        {mod.icon && (
          <img
            src={assetUrl(mod.icon)}
            alt=""
            className="w-6 h-6 rounded"
            onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
          />
        )}
        <p className="font-bold text-sm text-text-primary">{mod.name}</p>
      </div>
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

function PartCard({ part, name }: { part: MechPart; name: string }) {
  return (
    <div className="bg-bg-dark border border-border rounded-xl p-4">
      <div className="flex items-center gap-3 mb-3">
        {part.icon && (
          <img
            src={assetUrl(part.icon)}
            alt={name}
            className="w-12 h-12 rounded-lg bg-bg-card border border-border object-contain"
            onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
          />
        )}
        <div>
          <p className="font-bold text-sm text-text-primary">{name}</p>
          <p className="text-[11px] text-text-dim">{part.interface}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <AttrRow label="耐久" value={part.durable.toLocaleString()} />
        <AttrRow label="護甲" value={part.armor.toLocaleString()} />
        <AttrRow label="火力" value={part.firepower.toLocaleString()} />
        <AttrRow label="重量" value={part.weight.toLocaleString()} />
        {part.output != null && <AttrRow label="出力" value={part.output.toLocaleString()} />}
        {part.antiRiot != null && <AttrRow label="抗暴" value={part.antiRiot.toLocaleString()} />}
        {part.hit != null && <AttrRow label="命中" value={part.hit.toLocaleString()} />}
        {part.dodge != null && <AttrRow label="閃避" value={part.dodge.toLocaleString()} />}
        {part.move != null && <AttrRow label="移動力" value={part.move.toString()} />}
      </div>
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
  const [modules, setModules] = useState<Module[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetchData<Mech[]>('mechs.json'),
      fetchData<Module[]>('modules.json'),
    ]).then(([mechList, modList]) => {
      setMech(mechList.find((m) => m.id === id) ?? null)
      setModules(modList)
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

  // 從 modules.json 查找對應模組
  const mod4 = modules.find((m) => m.id === mech.module4Id) ?? null
  const mod8 = modules.find((m) => m.id === mech.module8Id) ?? null
  const fixedMods = (mech.moduleFixedIds || [])
    .map((fid) => modules.find((m) => m.id === fid) ?? null)
    .filter(Boolean) as Module[]

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

        {/* 機甲圖 */}
        <div className="bg-bg-card border border-border rounded-xl p-5 flex items-center justify-center">
          {mech.portrait && (
            <img
              src={assetUrl(mech.portrait)}
              alt={mech.name}
              className="max-h-48 object-contain"
              onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
            />
          )}
        </div>
      </div>

      {/* Parts Detail */}
      <div className="mb-6">
        <SectionLabel>部件資訊（滿級）</SectionLabel>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {(['torso', 'leftArm', 'rightArm', 'legs'] as const).map((key) => {
            const part = mech.parts?.[key]
            if (!part || typeof part === 'number') return null
            return <PartCard key={key} part={part as MechPart} name={PART_NAMES[key]} />
          })}
        </div>
      </div>

      {/* Modules */}
      <div>
        <SectionLabel>機甲模組</SectionLabel>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <ModuleCard mod={mod4} label="四模組" color="border-border" />
          <ModuleCard mod={mod8} label="八模組" color="border-accent-orange/30" />
          {fixedMods.length > 0
            ? fixedMods.map((fm, idx) => (
                <ModuleCard
                  key={fm.id}
                  mod={fm}
                  label={fixedMods.length === 1 ? '固定模組' : `固定模組 ${idx + 1}`}
                  color="border-accent-cyan/30"
                />
              ))
            : <ModuleCard mod={null} label="固定模組" color="border-accent-cyan/30" />
          }
        </div>
      </div>

      {/* Lore */}
      {mech.lore && (
        <div className="mt-6 bg-bg-card border border-border rounded-xl p-5">
          <SectionLabel>機體描述</SectionLabel>
          <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-line">{mech.lore}</p>
        </div>
      )}
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

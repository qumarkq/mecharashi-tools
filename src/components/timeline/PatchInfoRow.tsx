interface PatchInfoRowProps {
  icon?: string
  label: string
  items: string[]
  color?: 'blue' | 'orange' | 'purple' | 'green' | 'yellow' | 'cyan'
}

const badgeColors = {
  blue:   'bg-accent-blue/10 text-accent-blue border-accent-blue/30',
  orange: 'bg-accent-orange/10 text-accent-orange border-accent-orange/30',
  purple: 'bg-accent-purple/10 text-accent-purple border-accent-purple/30',
  green:  'bg-accent-green/10 text-accent-green border-accent-green/30',
  yellow: 'bg-accent-yellow/10 text-accent-yellow border-accent-yellow/30',
  cyan:   'bg-accent-cyan/10 text-accent-cyan border-accent-cyan/30',
}

export default function PatchInfoRow({ icon, label, items, color = 'blue' }: PatchInfoRowProps) {
  if (!items || items.length === 0) return null

  return (
    <div className="flex items-start gap-2 py-1">
      <div className="flex items-center gap-1 shrink-0 pt-0.5 min-w-[5rem]">
        {icon && <span className="text-xs">{icon}</span>}
        <span className="text-[10px] text-text-dim whitespace-nowrap tracking-wide">{label}</span>
      </div>
      <div className="flex flex-wrap gap-1">
        {items.map((item, i) => (
          <span
            key={i}
            className={`text-[11px] px-1.5 py-0.5 rounded border leading-tight ${badgeColors[color]}`}
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  )
}

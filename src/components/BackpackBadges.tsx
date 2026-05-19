export const TYPE_CONFIG: Record<string, string> = {
  增傷: 'text-accent-orange bg-accent-orange/10 border-accent-orange/30',
  首攻: 'text-accent-yellow bg-accent-yellow/10 border-accent-yellow/30',
  護甲: 'text-accent-blue bg-accent-blue/10 border-accent-blue/30',
  再攻擊: 'text-accent-purple bg-accent-purple/10 border-accent-purple/30',
}

export const RESTRICTION_CONFIG: Record<string, { label: string; className: string }> = {
  light:  { label: '輕甲限定', className: 'text-accent-cyan bg-accent-cyan/10 border-accent-cyan/40' },
  medium: { label: '中甲限定', className: 'text-accent-green bg-accent-green/10 border-accent-green/40' },
  heavy:  { label: '重甲限定', className: 'text-accent-red bg-accent-red/10 border-accent-red/40' },
}

export function BackpackTypeBadge({ type, className = '' }: { type: string; className?: string }) {
  const cls = TYPE_CONFIG[type] ?? 'text-text-secondary bg-bg-card border-border'
  return (
    <span className={`px-2 py-0.5 rounded text-[13px] font-bold border ${cls} ${className}`}>
      {type}
    </span>
  )
}

export function RestrictionBadge({ restriction, className = '' }: { restriction: string; className?: string }) {
  const config = RESTRICTION_CONFIG[restriction]
  if (!config) return null
  return (
    <span className={`px-2 py-0.5 rounded text-[13px] font-bold border ${config.className} ${className}`}>
      {config.label}
    </span>
  )
}

export const CLASS_CONFIG: Record<string, string> = {
  守護者: 'text-accent-green bg-accent-green/10 border-accent-green/40',
  突擊手: 'text-accent-orange bg-accent-orange/10 border-accent-orange/40',
  格鬥家: 'text-accent-red bg-accent-red/10 border-accent-red/40',
  狙擊手: 'text-accent-blue bg-accent-blue/10 border-accent-blue/40',
  戰術家: 'text-accent-purple bg-accent-purple/10 border-accent-purple/40',
  機械師: 'text-accent-cyan bg-accent-cyan/10 border-accent-cyan/40',
  調構師: 'text-accent-yellow bg-accent-yellow/10 border-accent-yellow/40',
}

export function ClassBadge({ pilotClass, className = '' }: { pilotClass: string; className?: string }) {
  const cls = CLASS_CONFIG[pilotClass] ?? 'text-text-secondary bg-bg-card border-border'
  return (
    <span className={`px-2 py-0.5 rounded text-[13px] font-bold border ${cls} ${className}`}>
      {pilotClass}
    </span>
  )
}

export function LicenseBadge({ license, className = '' }: { license: string; className?: string }) {
  return (
    <span className={`px-2 py-0.5 rounded text-[13px] font-bold bg-black/50 text-text-secondary border border-border ${className}`}>
      {license}
    </span>
  )
}

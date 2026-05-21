import { useState } from 'react'
import { assetUrl } from '../utils/assets'
import type { Backpack } from '../types'

type MainSkill = NonNullable<Backpack['mainSkill']>

function SkillIcon({ icon, name }: { icon?: string; name: string }) {
  const [err, setErr] = useState(false)
  if (err || !icon) {
    return (
      <div className="w-9 h-9 rounded-lg bg-bg-dark border border-border flex items-center justify-center text-text-dim text-[10px] flex-shrink-0">
        技
      </div>
    )
  }
  return (
    <img
      src={assetUrl(`/images/skills/${icon}.png`)}
      alt={name}
      className="w-9 h-9 rounded-lg object-cover flex-shrink-0"
      onError={() => setErr(true)}
    />
  )
}

export function BackpackSkillCard({ skill }: { skill: MainSkill }) {
  const hasStats = skill.dmg || skill.crit || skill.critDmg || skill.acc
  return (
    <div className="bg-bg-dark border border-border rounded-lg p-3">
      <div className="flex items-start gap-3">
        <SkillIcon icon={skill.icon} name={skill.name} />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-text-primary mb-1.5">{skill.name}</p>
          <p className="text-xs text-text-secondary leading-relaxed">{skill.description}</p>
          {hasStats && (
            <div className="flex flex-wrap gap-2 mt-2">
              {skill.dmg     ? <span className="text-[13px] text-accent-orange">增傷 +{skill.dmg}%</span>     : null}
              {skill.crit    ? <span className="text-[13px] text-accent-yellow">爆率 +{skill.crit}</span>     : null}
              {skill.critDmg ? <span className="text-[13px] text-accent-yellow">爆傷 +{skill.critDmg}%</span> : null}
              {skill.acc     ? <span className="text-[13px] text-accent-blue">命中 +{skill.acc}</span>        : null}
            </div>
          )}
          {skill.specialEffects && skill.specialEffects.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {skill.specialEffects.map((ef, i) => (
                <span
                  key={i}
                  className="text-[13px] text-accent-cyan bg-accent-cyan/5 border border-accent-cyan/20 rounded px-2 py-0.5"
                >
                  {ef}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

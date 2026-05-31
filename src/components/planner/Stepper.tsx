interface StepperProps {
  value:       number
  onChange:    (v: number) => void
  min?:        number
  max?:        number
  disableInc?: boolean   // 達到上限時鎖住「+」
}

export function Stepper({ value, onChange, min = 0, max = 99, disableInc = false }: StepperProps) {
  const incBlocked = disableInc || value >= max
  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={() => onChange(Math.max(min, value - 1))}
        className="w-7 h-7 rounded-lg bg-bg-dark border border-border text-text-secondary hover:text-text-primary hover:border-border-accent transition-colors text-base flex items-center justify-center leading-none"
        aria-label="減少"
      >
        −
      </button>
      <span className="w-8 text-center text-[14px] font-[JetBrains_Mono,monospace] font-semibold text-text-primary select-none">
        {value}
      </span>
      <button
        onClick={() => { if (!incBlocked) onChange(value + 1) }}
        disabled={incBlocked}
        className="w-7 h-7 rounded-lg bg-bg-dark border border-border text-text-secondary hover:text-text-primary hover:border-border-accent transition-colors text-base flex items-center justify-center leading-none disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:text-text-secondary disabled:hover:border-border"
        aria-label="增加"
      >
        +
      </button>
    </div>
  )
}

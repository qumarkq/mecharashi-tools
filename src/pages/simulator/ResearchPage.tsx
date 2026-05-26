import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { saveResearchLevels } from '../../lib/userApi'
import type { UserResearchLevels } from '../../types'
import { RESEARCH_PILOT_CLASSES, RESEARCH_MECH_TYPES, RESEARCH_WEAPON_TYPES } from '../../types/enums'

// ── 科研分類定義（來源：src/types/enums.ts）──────────────────────────────────

const LS_KEY = 'mecharashi_research'

function loadFromStorage(): UserResearchLevels {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) return JSON.parse(raw) as UserResearchLevels
  } catch {
    // ignore
  }
  return { pilotByClass: {}, mechByType: {}, weaponByType: {} }
}

function saveToStorage(levels: UserResearchLevels) {
  localStorage.setItem(LS_KEY, JSON.stringify(levels))
}

// ── Slider 元件 ───────────────────────────────────────────────────────────────

function ResearchSlider({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (v: number) => void
}) {
  return (
    <div className="flex items-center gap-3 py-2">
      <span className="w-20 text-sm text-text-secondary shrink-0">{label}</span>
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 accent-accent-orange cursor-pointer"
      />
      <span
        className={`w-12 text-right text-sm font-bold font-[JetBrains_Mono,monospace] shrink-0 ${
          value === 100 ? 'text-accent-green' : value >= 50 ? 'text-accent-orange' : 'text-text-dim'
        }`}
      >
        {value}%
      </span>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function ResearchPage() {
  const { user } = useAuth()
  const [levels, setLevels] = useState<UserResearchLevels>(loadFromStorage)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  // 若已登入，可從 Firestore 拉取（留給後續擴充；Phase 5 以 localStorage 為主）
  useEffect(() => {
    setSaved(false)
  }, [levels])

  const setVal = useCallback(
    (
      section: keyof UserResearchLevels,
      key: string,
      val: number
    ) => {
      setLevels((prev) => ({
        ...prev,
        [section]: { ...prev[section], [key]: val },
      }))
    },
    []
  )

  const handleSave = async () => {
    setSaving(true)
    try {
      saveToStorage(levels)
      if (user) {
        await saveResearchLevels(user.uid, levels)
      }
      setSaved(true)
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-12 bg-bg-dark/10 backdrop-blur-sm rounded-2xl">
      <div className="mb-8">
        <span className="text-xs text-accent-orange tracking-[3px] uppercase font-[Orbitron,sans-serif]">Settings</span>
        <h1 className="text-3xl font-bold mt-2">科研設定</h1>
        <p className="text-text-secondary mt-2">
          設定你的全域科研完成度（0–100%），系統於 Phase 8 傷害計算時套用對應加成。
        </p>
      </div>

      {/* Login notice */}
      {!user && (
        <div className="bg-accent-yellow/5 border border-accent-yellow/20 rounded-xl px-4 py-3 mb-6 text-sm text-accent-yellow">
          目前未登入，設定將存於本機瀏覽器。登入後可同步至雲端。
        </div>
      )}

      {/* Section: 機師科研 */}
      <Section label="機師科研" color="blue" description="依機師職業分類，影響六維與技能加成">
        {RESEARCH_PILOT_CLASSES.map((cls) => (
          <ResearchSlider
            key={cls}
            label={cls}
            value={levels.pilotByClass[cls] ?? 0}
            onChange={(v) => setVal('pilotByClass', cls, v)}
          />
        ))}
      </Section>

      {/* Section: 機甲科研 */}
      <Section label="機甲科研" color="cyan" description="依裝甲類型分類，影響各部件耐久、火力、閃避等屬性">
        {RESEARCH_MECH_TYPES.map((type) => (
          <ResearchSlider
            key={type}
            label={type}
            value={levels.mechByType[type] ?? 0}
            onChange={(v) => setVal('mechByType', type, v)}
          />
        ))}
      </Section>

      {/* Section: 武器科研 */}
      <Section label="武器科研" color="orange" description="依武器種類分類，影響攻擊力、命中、暴擊加成">
        {RESEARCH_WEAPON_TYPES.map((type) => (
          <ResearchSlider
            key={type}
            label={type}
            value={levels.weaponByType[type] ?? 0}
            onChange={(v) => setVal('weaponByType', type, v)}
          />
        ))}
      </Section>

      {/* Save button */}
      <div className="flex items-center gap-4 mt-8">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2.5 bg-accent-orange text-white rounded-xl font-medium hover:bg-accent-orange/80 transition-colors cursor-pointer disabled:opacity-60"
        >
          {saving ? '儲存中...' : '儲存設定'}
        </button>
        {saved && (
          <span className="text-sm text-accent-green">
            ✓ 已儲存{user ? '（本機 + 雲端）' : '（本機）'}
          </span>
        )}
      </div>

      <p className="text-xs text-text-dim mt-4">
        * 科研加成計算將於 Phase 8（傷害計算系統）完整實作，目前設定僅作記錄用途。
      </p>
    </div>
  )
}

function Section({
  label,
  color,
  description,
  children,
}: {
  label: string
  color: 'blue' | 'cyan' | 'orange'
  description: string
  children: React.ReactNode
}) {
  const colorMap = {
    blue: 'text-accent-blue border-accent-blue/20',
    cyan: 'text-accent-cyan border-accent-cyan/20',
    orange: 'text-accent-orange border-accent-orange/20',
  }
  return (
    <div className={`bg-bg-card border rounded-xl p-5 mb-4 ${colorMap[color].split(' ')[1]}`}>
      <div className={`text-xs uppercase tracking-[2px] font-[Orbitron,sans-serif] mb-1 ${colorMap[color].split(' ')[0]}`}>
        {label}
      </div>
      <p className="text-[12px] text-text-dim mb-4">{description}</p>
      {children}
    </div>
  )
}

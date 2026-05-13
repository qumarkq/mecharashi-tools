export default function BackpacksPage() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <div className="mb-8">
        <span className="text-xs text-accent-orange tracking-[3px] uppercase font-[Orbitron,sans-serif]">Database</span>
        <h1 className="text-3xl font-bold mt-2">背包圖鑑</h1>
        <p className="text-text-secondary mt-2">所有背包裝備的技能效果、重量與裝配限制。</p>
      </div>
      <div className="bg-bg-card border border-border rounded-xl p-8 text-center text-text-dim">
        資料載入中... (Phase 2 將實作完整列表與篩選功能)
      </div>
    </div>
  )
}

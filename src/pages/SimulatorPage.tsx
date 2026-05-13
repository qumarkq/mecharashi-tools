export default function SimulatorPage() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <div className="mb-8">
        <span className="text-xs text-accent-orange tracking-[3px] uppercase font-[Orbitron,sans-serif]">Core Tool</span>
        <h1 className="text-3xl font-bold mt-2">配裝模擬器</h1>
        <p className="text-text-secondary mt-2">選擇機師、機甲、武器、背包，計算傷害期望值並進行 A/B 對比。</p>
      </div>
      <div className="bg-bg-card border border-border rounded-xl p-8 text-center text-text-dim">
        模擬器開發中... (Phase 3 將實作完整配裝流程與傷害計算)
      </div>
    </div>
  )
}

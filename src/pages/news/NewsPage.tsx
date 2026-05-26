export default function NewsPage() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-12 bg-bg-dark/10 backdrop-blur-sm rounded-2xl">
      <div className="mb-8">
        <span className="text-xs text-accent-orange tracking-[3px] uppercase font-[Orbitron,sans-serif]">Content</span>
        <h1 className="text-3xl font-bold mt-2">改版資訊</h1>
        <p className="text-text-secondary mt-2">最新改版預告與更新內容。</p>
      </div>
      <div className="bg-bg-card border border-border rounded-xl p-8 text-center text-text-dim">
        改版資訊開發中... (Phase 5 將實作內容管理系統)
      </div>
    </div>
  )
}

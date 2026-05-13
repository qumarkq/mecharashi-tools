export default function ProfilePage() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <div className="mb-8">
        <span className="text-xs text-accent-orange tracking-[3px] uppercase font-[Orbitron,sans-serif]">User</span>
        <h1 className="text-3xl font-bold mt-2">個人中心</h1>
        <p className="text-text-secondary mt-2">我的配裝紀錄、科研設定與匯出管理。</p>
      </div>
      <div className="bg-bg-card border border-border rounded-xl p-8 text-center text-text-dim">
        個人中心開發中... (Phase 4 將實作用戶登入與資料管理)
      </div>
    </div>
  )
}

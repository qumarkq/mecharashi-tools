# Changelog

所有重要變更將記錄於此文件。

格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-TW/1.0.0/)，版本號遵循 [Semantic Versioning](https://semver.org/lang/zh-TW/)。

## [Unreleased] - 2026-05-14

### ✨ 新功能

- **mech**: 爬蟲 v3 — 圖片改分資料夾、修正部件圖 URL、機體詳情頁駕駛艙排版 (`42b4d7f`)
- v1.5 Phase 3 — 模組圖鑑 + 配裝模擬器 + html2canvas 匯出 (`a7fff68`)
- v1.4 模組系統 — Module 資料結構、爬蟲與管理介面 (`89ac717`)

### 🐛 修復

- **scraper**: 修正 CHANGELOG 自動 commit 過濾 regex 支援中文訊息 (`f0145d0`)

### 📊 資料更新

- **mech**: 新增機體圖片資源與更新機體/飛行員資料，重構爬蟲腳本 (`71c4860`)

### 🔧 維護

- 更新 .gitignore 並修正 pre-push hook CI 跳過問題 (`8dcddc6`)

---
## [0.1.0] - 2026-05-14

### ✨ 新功能

- 新增機體/機師詳情頁與完整資料 (`f0d43a3`)
- 初始化專案架構與開發進度表 (`77359ff`)

### 🚀 CI/CD

- 新增 GitHub Pages 自動部署工作流程 (`c172247`)
- trigger GitHub Pages deployment (`996a35e`)

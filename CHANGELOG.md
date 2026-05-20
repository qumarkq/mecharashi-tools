# Changelog

所有重要變更將記錄於此文件。

格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-TW/1.0.0/)，版本號遵循 [Semantic Versioning](https://semver.org/lang/zh-TW/)。

## [Unreleased] - 2026-05-20

### ⚠ 重大變更

- 資料層遷移至 Firestore，整合 Firebase 認證 (`eac6e87`)

### ✨ 新功能

- **weapons**: PLAN-007 武器 API 欄位映射修正；武器詳情頁 UI 優化 (`ca6477f`)
- **weapons**: 武器詳情頁（PLAN-006）完成；新增全模組 Badge 元件重構 (`d6e2485`)
- **weapons**: 武器資料模型全面重構（PLAN-003）；新增 PLAN-004 計畫文件 (`37cbee7`)
- **weapons/admin**: 武器需求結構化模型（PLAN-003）；新增機師編輯面板；移除科研設定 (`bea0e73`)
- **pilot/mech**: 機師/機甲詳情頁改版；新增專屬模組/武器、模組等級 Tooltip、技能 Buff 型別系統 (`7064fc4`)
- **layout**: 新增全域字體大小切換（小/中/大），以 localStorage 持久化；模組描述與等級彈窗數字 % 紅色標示 (`65813ae`)
- **home**: 改版首頁為吉祥物歡迎頁，移除快速入口 (`fdc7614`)
- **page**: 詳情頁新增剩餘出力顯示、重構部件卡片佈局 (`75a9471`)
- **mech**: 爬蟲 v3 — 圖片改分資料夾、修正部件圖 URL、機體詳情頁駕駛艙排版 (`42b4d7f`)
- v1.5 Phase 3 — 模組圖鑑 + 配裝模擬器 + html2canvas 匯出 (`a7fff68`)
- v1.4 模組系統 — Module 資料結構、爬蟲與管理介面 (`89ac717`)

### 🐛 修復

- **admin**: 修正武器表單 attack 欄位型別不符導致 build 失敗 (`05dc704`)
- 修正build因Weapon 的資料型別調整失敗的bug (`f863548`)
- **admin**: 移除 AdminPage 未使用的 WeaponRequirement import (`6cf5528`)
- **mech**: module4Id/module8Id 改為選填；修正部件卡佈局及左右臂順序 (`5399367`)
- **deploy**: 修正 GitHub Pages SPA 直連子路徑 404 問題 (`9ac987c`)
- **scripts**: 修正爬蟲腳本模組 schema 與文件規範不符 (`0cad3a9`)
- **page**: 機甲屬性火力與剩餘出力改從部件累加計算 (`958991d`)
- **scraper**: 修正 CHANGELOG 自動 commit 過濾 regex 支援中文訊息 (`f0145d0`)

### 📊 資料更新

- **mech**: 新增機體圖片資源與更新機體/飛行員資料，重構爬蟲腳本 (`71c4860`)

### 🔧 維護

- **layout**: 更新頁尾免責聲明文字 (`2a6abe7`)
- 更新 .gitignore 並修正 pre-push hook CI 跳過問題 (`8dcddc6`)

### 其他

- **components**: 新增武器外框和稀有度字體外框渲染效果 (`01017a8`)

---
## [0.1.0] - 2026-05-14

### ✨ 新功能

- 新增機體/機師詳情頁與完整資料 (`f0d43a3`)
- 初始化專案架構與開發進度表 (`77359ff`)

### 🚀 CI/CD

- 新增 GitHub Pages 自動部署工作流程 (`c172247`)
- trigger GitHub Pages deployment (`996a35e`)

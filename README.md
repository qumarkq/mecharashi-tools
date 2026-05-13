# 鋼嵐工具站 | Mecharashi Tools

> 鋼嵐（Mecharashi）遊戲玩家工具網站 — 傷害模擬器 · 配裝計算器 · 角色資料庫 · 攻略百科

## 專案說明

本專案為鋼嵐（Mecharashi）遊戲的輔助工具站，提供玩家各類實用工具與資料庫查詢功能。

## 技術棧

- **框架**: React 18 + TypeScript
- **建構**: Vite 8
- **樣式**: Tailwind CSS v4
- **路由**: React Router
- **部署**: GitHub Pages
- **後端**: Firebase Auth + Cloud Firestore
- **資料管理**: Google Sheets → GitHub Actions → Static JSON

## 開發指令

```bash
npm install      # 安裝依賴
npm run dev      # 啟動開發伺服器
npm run build    # 建構生產版本
npm run preview  # 預覽生產版本
```

## 資料夾結構

```
mecharashi-tools/
├── docs/
│   ├── 01_規劃書/       # 專案規劃文件
│   ├── 02_設計稿/       # UI/UX 設計稿
│   ├── 03_進度表/       # 開發進度追蹤
│   ├── 04_需求文件/     # 功能需求規格
│   ├── 05_會議記錄/     # 會議紀錄
│   └── 06_技術文件/     # 技術架構與 API 文件
├── src/                 # React 原始碼
│   ├── components/      # 共用元件
│   └── pages/           # 頁面元件
├── public/
│   └── data/            # 靜態 JSON 資料檔 (8 檔)
└── .github/             # GitHub Actions / 設定
```

## 開發進度

詳見 [docs/03_進度表/開發進度表.html](./docs/03_進度表/開發進度表.html)（含連結至規劃書對應章節）

## License

© 2026 鋼嵐工具站 All rights reserved.

import type { ChangelogMonth } from './types'

const may2026: ChangelogMonth = {
  month: '2026-05',
  entries: [
    { date: '2026-05-31', type: 'feat',    summary: '首頁新增 Discord 社群連結' },
    { date: '2026-05-31', type: 'feat',    summary: '首頁新增網站更新履歷區塊（可展開檢視所有更新記錄）' },
    { date: '2026-05-31', type: 'fix',     summary: '修正頭像上傳失敗的問題（Cloudinary 環境變數補齊）' },
    { date: '2026-05-31', type: 'style',   summary: '首頁版面微調' },
    { date: '2026-05-31', type: 'feat',    summary: '補充武器圖片資源' },
    { date: '2026-05-30', type: 'feat',    summary: '新增首頁站點團隊展示區（管理者 / 維護者頭像）' },
    { date: '2026-05-30', type: 'feat',    summary: '頭像上傳服務改用 Cloudinary，移除 Firebase Storage 依賴' },
    { date: '2026-05-29', type: 'feat',    summary: '版本表新增匯出圖片功能；首頁版面新增展開 / 收合切換' },
    { date: '2026-05-29', type: 'feat',    summary: '優化版本甘特圖顯示' },
    { date: '2026-05-29', type: 'feat',    summary: '各頁新增分頁功能；新增背包管理頁' },
    { date: '2026-05-28', type: 'refactor',summary: '後台管理頁拆分為子模組，修正活動日期計算' },
    { date: '2026-05-27', type: 'feat',    summary: '新增資料快取層，大幅降低 Firestore 讀取次數' },
    { date: '2026-05-27', type: 'perf',    summary: '啟用 Firestore IndexedDB 離線持久化，減少重複讀取' },
    { date: '2026-05-27', type: 'feat',    summary: '首頁改版為全螢幕 snap-scroll 設計' },
    { date: '2026-05-26', type: 'style',   summary: '整體容器樣式更新，新增背景圖' },
    { date: '2026-05-25', type: 'feat',    summary: '新增首頁版本時間線；後台管理基礎建設' },
    { date: '2026-05-24', type: 'feat',    summary: '元件頁新增關卡掉落資訊與篩選條件' },
    { date: '2026-05-24', type: 'feat',    summary: '新增元件圖鑑頁' },
    { date: '2026-05-24', type: 'feat',    summary: '機師詳情頁新增故事內容顯示' },
    { date: '2026-05-23', type: 'feat',    summary: '開放 Email 直接註冊，不需第三方登入' },
    { date: '2026-05-23', type: 'feat',    summary: '機師詳情頁新增專武二階段資訊' },
    { date: '2026-05-22', type: 'feat',    summary: '後台新增元件管理功能' },
    { date: '2026-05-22', type: 'style',   summary: '背包顯示樣式優化' },
    { date: '2026-05-21', type: 'style',   summary: '改善手機版操作體驗（響應式排版優化）' },
  ],
}

export default may2026

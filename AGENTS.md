# AGENTS.md - 鋼嵐工具站專案規則

本檔由 `CLAUDE.md` 轉為 Codex / agent 可讀的專案指引。若兩者內容有落差，請同步更新。

## 1. 每次 commit 前：更新網站更新履歷

每當被要求執行 `git commit` 時，必須先更新 `src/data/siteChangelog/` 的靜態資料，再執行 commit。

### 規則

1. 根據本次 commit 的日期，判斷屬於哪個月份（`YYYY-MM`）
2. 如果對應月份的檔案已存在（例如 `2026-05.ts`），在 `entries` 陣列的最前面插入新記錄
3. 如果對應月份的檔案不存在，建立新的月份檔案，並在 `src/data/siteChangelog/index.ts` 的 `SITE_CHANGELOG` 陣列最前面 import 並加入
4. 每筆記錄格式：

   ```ts
   { date: 'YYYY-MM-DD', type: 'feat' | 'fix' | 'perf' | 'style' | 'refactor', summary: '一行中文摘要' }
   ```

5. `chore` / `ci` / `docs` 類型的 commit 不需要加入履歷（這些是內部維護用，不影響使用者）
6. 一個 commit 可以對應多筆 entries（若包含多個獨立功能）
7. 摘要以使用者視角描述，例如「機師詳情頁新增專武資訊」

注意：`CHANGELOG.md` 由 `npm run changelog`（CI 腳本）自動維護，請勿手動編輯。

## 2. 每次 commit 前：檢查相關文件是否需要同步更新

當本次 commit 的變更內容涉及以下項目時，必須先更新對應文件，再一起 commit。

| 變更的來源檔案 | 需要同步的 docs 文件 |
|---|---|
| `src/types/index.ts`（新增/修改 interface/type） | `docs/02_技術文件/02_資料模型/*.html` 對應的資料模型頁 |
| `src/types/enums.ts`（新增/修改 enum） | `docs/02_技術文件/04_Firebase/資料庫設計文件/enums.html` |
| `src/lib/firestoreApi.ts`（Firestore 讀寫邏輯） | `docs/02_技術文件/04_Firebase/資料庫設計文件/` 對應的集合文件 |
| `src/lib/userApi.ts`（用戶資料結構） | `docs/02_技術文件/04_Firebase/資料庫設計文件/users.html` |
| 新增頁面或重大頁面重構 | `docs/03_頁面規劃/` 對應的頁面規劃文件 |
| PLAN 計畫進度更新 | `docs/05_階段性開發計畫/` 對應的進度表 |

### 判斷原則

- 只有結構性變更才需要更新文件（新增欄位、刪除欄位、欄位改名、型別變動）
- 純邏輯修正、樣式調整不需要更新文件
- 不確定時，快速掃一眼對應文件，看是否有明顯的落差

### docs 文件格式說明

`docs/` 下的文件皆為 HTML 格式，共用 `docs/_shared/style.css`。更新時保持現有的 HTML 結構，只修改資料內容部分。

## 3. 每次 push 前：先確認 build 可以成功

執行 `git push` 之前，必須先跑 build 確認不會壞掉：

```bash
npm run build
```

`npm run build` = `tsc -b && vite build`，同時檢查 TypeScript 型別錯誤與 Vite 打包。

- build 成功：繼續 push
- build 失敗：找出並修正錯誤，修正後重新 commit，再 push

正確的 push 流程：

```text
1. git commit（已包含 siteChangelog 更新 + docs 更新）
2. npm run build
3. git push
```

注意：commit 和 push 是兩個動作。使用者說「幫我 commit」不等於要 push；說「幫我推上去」或「push」才執行第 3 步。

import type { ChangelogMonth } from './types'

const jun2026: ChangelogMonth = {
  month: '2026-06',
  entries: [
    { date: '2026-06-01', type: 'fix', summary: '修正版本資訊頁機師／武器／背包圖示因路徑格式不一致導致無法顯示的問題' },
    { date: '2026-06-01', type: 'fix', summary: '更新首頁 Discord 社群邀請連結' },
    { date: '2026-06-01', type: 'feat', summary: 'Email 登入新增忘記密碼與重設密碼信寄送功能' },
    { date: '2026-06-01', type: 'feat', summary: '攻略專區新增「彩甲升級規劃器」工具：輸入持有零件與改進模組，自動規劃最優彩甲升級路線' },
  ],
}

export default jun2026

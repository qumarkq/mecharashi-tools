import type { PatchVersion } from './types'

const v3_3: PatchVersion = {
  version: '3.3',
  name: '黃昏紀元',
  upper: {
    cnDate: '2026/04/30',
    twDate: '約 2026/10/08',
    twIsPredicted: true,
    pilots: ['淬鋒凱登'],
    mechs: ['莫X（輕甲）'],
    specialEvents: ['限時活動「寶匿奇遇記」', '限時活動「猜口令」', '限時活動「環島物流節」'],
    skinGacha: '瑪汀妮外觀【喀耳刻之舞】',
    battlePass: { pilots: ['馬汀妮', '鄔樂萱'], mechs: ['幻惑', '霸王'] },
  },
  lower: {
    cnDate: '2026/05/14',
    twDate: '約 2026/10/29',
    twIsPredicted: true,
    pilots: ['安'],
    mechs: ['奈芙蒂斯（中甲）'],
    revivedBanners: ['業火搖光（機師: 瑪阿特）', '莉棘信仰（機兵: 殉道士）'],
    specialEvents: ['限時活動「回盤戰線」', '限時簽到活動', '角雕輪盤（末週）'],
    rouletteEvent: true,
  },
  crisisShop: ['繪梨沙', '弗雷'],
  arenaShop: '塔納托斯(10/22)',
  grayOpsUpdates: [
    { company: '武裝工坊', newMechs: ['彌造者'] },
    { company: '創新動力', newMechs: ['殉道士'] },
  ],
}

export default v3_3

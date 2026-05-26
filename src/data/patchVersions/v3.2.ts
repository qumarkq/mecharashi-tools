import type { PatchVersion } from './types'

const v3_2: PatchVersion = {
  version: '3.2',
  upper: {
    cnDate: '2026/03/26',
    twDate: '約 2026/08/27',
    twIsPredicted: true,
    pilots: ['貝爾莎'],
    mechs: ['惡兆（重甲）'],
    armamentRaids: [
      { name: '碎狼牙', weapons: ['懷亞特'] },
      { name: '鎮壓者', backpacks: ['飛行再生背包'] },
    ],
    battlePass: { pilots: ['科林', '夜天光'], mechs: ['佐伊', '赫克托'] },
  },
  lower: {
    cnDate: '2026/04/16',
    twDate: '約 2026/09/17',
    twIsPredicted: true,
    pilots: ['吉賽爾'],
    mechs: ['獵鬥士（中甲）'],
    armamentRaids: [
      { name: '導引者', weapons: ['雷達攻擊型'] },
    ],
  },
  borderShop: '赫拉克勒斯(9/3)',
  grayOpsUpdates: [
    { company: '武裝工坊', newMechs: ['君權'] },
  ],
}

export default v3_2

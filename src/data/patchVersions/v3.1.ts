import type { PatchVersion } from './types'

const v3_1: PatchVersion = {
  version: '3.1',
  upper: {
    cnDate: '2026/02/12',
    twDate: '約 2026/07/16',
    twIsPredicted: true,
    pilots: ['唐小葵'],
    mechs: ['奔賈（輕甲）'],
    armamentRaids: [
      { name: '魔彈射手', weapons: ['維'] },
      { name: '詭武者', backpacks: ['隱形再生背包'] },
    ],
    battlePass: { pilots: ['維羅妮卡', '盜賊'], mechs: ['維娜', '巨像'] },
  },
  lower: {
    cnDate: '2026/03/05',
    twDate: '約 2026/08/06',
    twIsPredicted: true,
    pilots: ['哈達威'],
    mechs: ['螢石（中甲）'],
    armamentRaids: [
      { name: '千軍', weapons: ['科林'] },
      { name: '守望者', backpacks: ['誘導攻背包'] },
    ],
  },
  crisisShop: ['羅娜', '迪拉卡'],
}

export default v3_1

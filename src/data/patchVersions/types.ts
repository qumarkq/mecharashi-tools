export interface ArmamentRaid {
  name: string
  weapons?: string[]
  backpacks?: string[]
}

export interface BattlePass {
  pilots?: string[]
  mechs?: string[]
}

export type ActivityType =
  | 'skinGacha'           // 角雕刮刮樂
  | 'roulette'            // 角雕輪盤
  | 'pilotMission'        // 角雕特遣（含複數機師）
  | 'crossShipping'       // 跨域海運（含複數機甲）
  | 'specificPilotBanner' // 特定角色池
  | 'specificMechBanner'  // 特定機甲池
  | 'limitedEvent'        // 限時活動
  | 'loginEvent'          // 限時簽到活動
  | 'battlePass'          // 版本戰令

export interface TimedActivity {
  name: string          // 活動名稱，如「角雕刮刮樂」
  startDate: string     // 起始日 YYYY/MM/DD，固定為星期四
  weeks: number         // 持續週數（1 = 當週四到下週三）
  type: ActivityType
  pilots?: string[]     // pilotMission 時的機師列表
  mechs?: string[]      // crossShipping 時的機甲列表
}

export interface PatchHalf {
  cnDate: string
  twDate?: string
  twIsPredicted?: boolean
  pilots?: string[]
  mechs?: string[]
  pilotSelection?: string[]
  mechSelection?: string[]
  armamentRaids?: ArmamentRaid[]
  battlePass?: BattlePass
  // 甘特圖活動（陸服 / 台服各自維護）
  cnActivities?: TimedActivity[]
  twActivities?: TimedActivity[]
  // 舊欄位保留，cnActivities/twActivities 優先；無新欄位時 fallback 顯示
  /** @deprecated 請改用 cnActivities / twActivities */
  skinGacha?: string
  /** @deprecated 請改用 cnActivities / twActivities */
  rouletteEvent?: boolean
  /** @deprecated 請改用 cnActivities / twActivities */
  specialEvents?: string[]
  /** @deprecated 請改用 cnActivities / twActivities */
  revivedBanners?: string[]
}

export interface GrayOpsUpdate {
  company: '武裝工坊' | '創新動力' | 'GeekX' | '火花塞'
  newMechs: string[]
}

export type GrayOpsCompany = '武裝工坊' | '創新動力' | 'GeekX' | '火花塞'

export interface PatchVersion {
  version: string
  name?: string
  bannerImage?: string
  upper: PatchHalf
  lower: PatchHalf
  crisisShop?: string[]
  memoryStorm?: string
  borderShop?: string
  arenaShop?: string
  grayOpsUpdates?: GrayOpsUpdate[]
  notes?: string
  isTwCurrent?: boolean
}

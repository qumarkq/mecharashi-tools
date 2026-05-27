export type { ArmamentRaid, BattlePass, PatchHalf, GrayOpsUpdate, GrayOpsCompany, PatchVersion, VersionIconUrls, TimedActivity, ActivityType } from './types'
export { GRAY_OPS_BASE } from './base'

import v2_8 from './v2.8'
import v3_0 from './v3.0'
import v3_1 from './v3.1'
import v3_2 from './v3.2'
import v3_3 from './v3.3'

export const PATCH_VERSIONS = [v2_8, v3_0, v3_1, v3_2, v3_3]

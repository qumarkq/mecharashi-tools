/**
 * 元件 BOSS 掉落資料表
 *
 * 結構：BOSS_DROPS[componentType][componentsWType][shortName] → StageDrop[]
 *   componentType:    'Function' | 'Condition'  (對應 ComponentType enum)
 *   componentsWType:  'Normal'   | 'W'          (對應 ComponentsWType enum)
 *   shortName:        元件名稱去掉前綴，如 "應元件-強擊" → "強擊"
 *
 * 新增關卡：在對應元件條目的陣列中加入 { stage: N, bosses: [...] }。
 * 圖片路徑規則：/images/components/Stage{N}_Boss/character_{N}_{bossNum}.png
 */

export interface StageDrop {
  stage: number
  bosses: number[]
}

type DropMap = Record<string, StageDrop[]>

export const BOSS_DROPS: {
  Function:  { Normal: DropMap; W: DropMap }
  Condition: { Normal: DropMap; W: DropMap }
} = {

  // ─── 應元件 (Function) ────────────────────────────────────────────────────

  Function: {

    Normal: {
      '強擊': [
        { stage: 11, bosses: [2, 3] },
        { stage: 12, bosses: [3] },
        { stage: 13, bosses: [3] },
        { stage: 14, bosses: [1] },
        { stage: 15, bosses: [1] },
      ],
      '破臂': [
        { stage: 11, bosses: [4] },
        { stage: 13, bosses: [1] },
      ],
      '破足': [
        { stage: 11, bosses: [1] },
        { stage: 12, bosses: [2] },
        { stage: 13, bosses: [4] },
        { stage: 14, bosses: [4] },
      ],
      '抵抗': [
        { stage: 12, bosses: [2] },
        { stage: 13, bosses: [2] },
        { stage: 14, bosses: [1] },
        { stage: 15, bosses: [4] },
        { stage: 16, bosses: [1] },
      ],
      '穿甲': [
        { stage: 11, bosses: [2] },
        { stage: 12, bosses: [4] },
        { stage: 13, bosses: [1] },
        { stage: 14, bosses: [3] },
        { stage: 15, bosses: [3] },
      ],
      '爆破': [
        { stage: 11, bosses: [3] },
        { stage: 12, bosses: [1] },
        { stage: 13, bosses: [1] },
      ],
      '濺射': [
        { stage: 11, bosses: [3, 4] },
        { stage: 12, bosses: [1] },
        { stage: 13, bosses: [3] },
        { stage: 14, bosses: [3] },
        { stage: 15, bosses: [4] },
        { stage: 16, bosses: [4] },
      ],
      '應急': [
        { stage: 12, bosses: [3] },
        { stage: 16, bosses: [1] },
      ],
      '重整': [
        { stage: 11, bosses: [1, 2] },
        { stage: 12, bosses: [2] },
        { stage: 13, bosses: [1] },
        { stage: 14, bosses: [2] },
        { stage: 15, bosses: [2] },
        { stage: 16, bosses: [3] },
      ],
      '昂揚': [
        { stage: 12, bosses: [4] },
        { stage: 13, bosses: [1] },
      ],
      '激勵': [
        { stage: 11, bosses: [1, 3] },
        { stage: 12, bosses: [3] },
        { stage: 13, bosses: [4] },
        { stage: 14, bosses: [1] },
        { stage: 15, bosses: [3] },
        { stage: 16, bosses: [3] },
      ],
      '奮發': [
        { stage: 12, bosses: [2] },
      ],
      '號令': [
        { stage: 11, bosses: [4] },
        { stage: 12, bosses: [4] },
        { stage: 13, bosses: [4] },
        { stage: 14, bosses: [2] },
        { stage: 15, bosses: [1] },
      ],
      '增幅': [
        { stage: 11, bosses: [2] },
        { stage: 12, bosses: [3] },
      ],
      '騰挪': [
        { stage: 12, bosses: [4] },
        { stage: 13, bosses: [3] },
        { stage: 14, bosses: [2] },
        { stage: 15, bosses: [2] },
        { stage: 16, bosses: [2] },
      ],
      '戰慄': [
        { stage: 12, bosses: [2] },
        { stage: 13, bosses: [2] },
        { stage: 14, bosses: [3] },
      ],
      '擴膛': [
        { stage: 13, bosses: [4] },
        { stage: 14, bosses: [1] },
      ],
      '同慨': [
        { stage: 13, bosses: [3] },
        { stage: 14, bosses: [3] },
        { stage: 15, bosses: [3] },
        { stage: 16, bosses: [2] },
      ],
      '蓬勃': [
        { stage: 13, bosses: [1] },
        { stage: 14, bosses: [4] },
        { stage: 15, bosses: [1] },
      ],
      '模糊': [
        { stage: 14, bosses: [2] },
        { stage: 15, bosses: [2] },
        { stage: 16, bosses: [1] },
      ],
      '短路': [
        { stage: 14, bosses: [3] },
        { stage: 15, bosses: [4] },
        { stage: 16, bosses: [1] },
      ],
      '消彈': [
        { stage: 14, bosses: [4] },
        { stage: 15, bosses: [3] },
        { stage: 16, bosses: [2] },
      ],
      '整葺': [
        { stage: 15, bosses: [3] },
        { stage: 16, bosses: [1] },
      ],
      '破軀': [
        { stage: 15, bosses: [2] },
        { stage: 16, bosses: [2] },
      ],
      '進發': [
        { stage: 15, bosses: [1] },
        { stage: 16, bosses: [2] },
      ],
      '挫志': [
        { stage: 16, bosses: [1] },
      ],
      '強攻': [
        { stage: 16, bosses: [4] },
      ],
      '超然': [
        { stage: 16, bosses: [2] },
      ],
    },

    W: {
      '強擊': [
        { stage: 13, bosses: [3] },
        { stage: 14, bosses: [2] },
        { stage: 15, bosses: [2] },
        { stage: 16, bosses: [3] },
      ],
      '破臂': [
        { stage: 12, bosses: [1] },
        { stage: 13, bosses: [3] },
        { stage: 14, bosses: [1] },
        { stage: 15, bosses: [1] },
        { stage: 16, bosses: [3] },
      ],
      '破足': [
        { stage: 14, bosses: [1] },
        { stage: 15, bosses: [2] },
        { stage: 16, bosses: [3] },
      ],
      '穿甲': [
        { stage: 12, bosses: [4] },
        { stage: 13, bosses: [3] },
      ],
      '爆破': [
        { stage: 12, bosses: [1] },
        { stage: 13, bosses: [2] },
        { stage: 14, bosses: [2] },
        { stage: 15, bosses: [3] },
      ],
      '濺射': [
        { stage: 13, bosses: [2] },
        { stage: 15, bosses: [4] },
        { stage: 16, bosses: [4] },
      ],
      '應急': [
        { stage: 13, bosses: [4] },
      ],
      '重整': [
        { stage: 16, bosses: [3] },
      ],
      '昂揚': [
        { stage: 12, bosses: [3] },
        { stage: 13, bosses: [2] },
        { stage: 14, bosses: [4] },
        { stage: 15, bosses: [4] },
        { stage: 16, bosses: [4] },
      ],
      '激勵': [
        { stage: 15, bosses: [2] },
        { stage: 16, bosses: [4] },
      ],
      '奮發': [
        { stage: 13, bosses: [4] },
        { stage: 14, bosses: [3] },
      ],
      '號令': [
        { stage: 13, bosses: [2] },
        { stage: 14, bosses: [4] },
        { stage: 15, bosses: [1] },
        { stage: 16, bosses: [3] },
      ],
      '增幅': [
        { stage: 12, bosses: [1] },
        { stage: 13, bosses: [4] },
        { stage: 14, bosses: [3] },
      ],
      '騰挪': [
        { stage: 15, bosses: [4] },
      ],
      '戰慄': [
        { stage: 14, bosses: [4] },
        { stage: 15, bosses: [4] },
        { stage: 16, bosses: [4] },
      ],
      '蓬勃': [
        { stage: 16, bosses: [4] },
      ],
    },
  },

  // ─── 觸元件 (Condition) ───────────────────────────────────────────────────

  Condition: {

    Normal: {
      '侵攻': [
        { stage: 11, bosses: [1, 3] },
        { stage: 12, bosses: [3] },
        { stage: 13, bosses: [1] },
        { stage: 14, bosses: [2] },
      ],
      '反擊': [
        { stage: 11, bosses: [2, 4] },
        { stage: 12, bosses: [4] },
        { stage: 13, bosses: [1] },
        { stage: 14, bosses: [1] },
        { stage: 15, bosses: [1] },
      ],
      '警戒': [
        { stage: 11, bosses: [2, 4] },
        { stage: 12, bosses: [1] },
      ],
      '連擊': [
        { stage: 12, bosses: [1] },
        { stage: 13, bosses: [4] },
        { stage: 14, bosses: [1] },
        { stage: 15, bosses: [2, 4] },
        { stage: 16, bosses: [4] },
      ],
      '合擊': [
        { stage: 11, bosses: [1, 4] },
        { stage: 12, bosses: [4] },
        { stage: 14, bosses: [4] },
        { stage: 15, bosses: [3] },
      ],
      '堅守': [
        { stage: 12, bosses: [2] },
        { stage: 13, bosses: [2, 3] },
        { stage: 14, bosses: [1] },
        { stage: 15, bosses: [4] },
        { stage: 16, bosses: [1] },
      ],
      '臨敵': [
        { stage: 12, bosses: [2] },
        { stage: 16, bosses: [1] },
      ],
      '背水': [
        { stage: 11, bosses: [1, 3] },
        { stage: 12, bosses: [3] },
        { stage: 13, bosses: [1] },
        { stage: 14, bosses: [3] },
        { stage: 15, bosses: [3] },
      ],
      '攻堅': [
        { stage: 12, bosses: [2] },
        { stage: 13, bosses: [1] },
        { stage: 14, bosses: [4] },
        { stage: 15, bosses: [2] },
        { stage: 16, bosses: [3] },
      ],
      '殲滅': [
        { stage: 11, bosses: [3] },
        { stage: 12, bosses: [4] },
        { stage: 13, bosses: [4] },
      ],
      '精準': [
        { stage: 11, bosses: [2] },
        { stage: 12, bosses: [3] },
        { stage: 13, bosses: [1] },
        { stage: 14, bosses: [2] },
        { stage: 15, bosses: [4] },
        { stage: 16, bosses: [3] },
      ],
      '釋能': [
        { stage: 11, bosses: [1] },
        { stage: 12, bosses: [2] },
      ],
      '擊破': [
        { stage: 11, bosses: [1] },
        { stage: 12, bosses: [2] },
        { stage: 13, bosses: [3] },
      ],
      '壓迫': [
        { stage: 11, bosses: [3] },
        { stage: 12, bosses: [4] },
      ],
      '沉著': [
        { stage: 13, bosses: [2] },
        { stage: 14, bosses: [1] },
      ],
      '煥發': [
        { stage: 12, bosses: [3] },
        { stage: 13, bosses: [1] },
        { stage: 14, bosses: [3] },
        { stage: 15, bosses: [1] },
        { stage: 16, bosses: [1] },
      ],
      '無患': [
        { stage: 13, bosses: [2] },
        { stage: 14, bosses: [1] },
        { stage: 15, bosses: [1] },
        { stage: 16, bosses: [2] },
      ],
      '憑逸': [
        { stage: 13, bosses: [3] },
        { stage: 14, bosses: [4] },
        { stage: 15, bosses: [1] },
        { stage: 16, bosses: [2] },
      ],
      '逼近': [
        { stage: 13, bosses: [4] },
        { stage: 14, bosses: [2] },
      ],
      '襲遠': [
        { stage: 14, bosses: [4] },
        { stage: 15, bosses: [4] },
        { stage: 16, bosses: [1] },
      ],
      '猛進': [
        { stage: 14, bosses: [2] },
        { stage: 15, bosses: [3] },
        { stage: 16, bosses: [2] },
      ],
      '摧朽': [
        { stage: 14, bosses: [1] },
        { stage: 15, bosses: [3] },
      ],
      '共力': [
        { stage: 15, bosses: [4] },
        { stage: 16, bosses: [2] },
      ],
      '破近': [
        { stage: 15, bosses: [2] },
        { stage: 16, bosses: [1] },
      ],
      '猛襲': [
        { stage: 15, bosses: [3] },
        { stage: 16, bosses: [2] },
      ],
      '決鬥': [
        { stage: 16, bosses: [2] },
      ],
      '迅擊': [
        { stage: 16, bosses: [4] },
      ],
      '激昂': [
        { stage: 16, bosses: [1] },
      ],
    },

    W: {
      '侵攻': [
        { stage: 12, bosses: [3] },
        { stage: 13, bosses: [2] },
        { stage: 14, bosses: [3] },
        { stage: 15, bosses: [2] },
        { stage: 16, bosses: [4] },
      ],
      '反擊': [
        { stage: 13, bosses: [2] },
        { stage: 14, bosses: [3] },
        { stage: 15, bosses: [2] },
        { stage: 16, bosses: [4] },
      ],
      '警戒': [
        { stage: 16, bosses: [4] },
      ],
      '連擊': [
        { stage: 12, bosses: [1] },
        { stage: 13, bosses: [4] },
        { stage: 14, bosses: [1] },
        { stage: 16, bosses: [4] },
      ],
      '合擊': [
        { stage: 12, bosses: [1] },
        { stage: 13, bosses: [3] },
        { stage: 14, bosses: [3] },
        { stage: 15, bosses: [1] },
        { stage: 16, bosses: [3] },
      ],
      '臨敵': [
        { stage: 12, bosses: [4] },
        { stage: 13, bosses: [2] },
        { stage: 14, bosses: [4] },
      ],
      '背水': [
        { stage: 13, bosses: [4] },
        { stage: 14, bosses: [2] },
        { stage: 15, bosses: [2] },
        { stage: 16, bosses: [3] },
      ],
      '攻堅': [
        { stage: 13, bosses: [3] },
      ],
      '殲滅': [
        { stage: 14, bosses: [3] },
        { stage: 15, bosses: [1] },
      ],
      '精準': [
        { stage: 15, bosses: [3] },
        { stage: 16, bosses: [4] },
      ],
      '釋能': [
        { stage: 12, bosses: [1] },
        { stage: 13, bosses: [2] },
      ],
      '擊破': [
        { stage: 15, bosses: [1] },
      ],
      '壓迫': [
        { stage: 12, bosses: [1] },
        { stage: 13, bosses: [3] },
        { stage: 14, bosses: [2] },
      ],
      '沉著': [
        { stage: 13, bosses: [3] },
        { stage: 14, bosses: [4] },
        { stage: 15, bosses: [3] },
        { stage: 16, bosses: [3] },
      ],
      '煥發': [
        { stage: 15, bosses: [4] },
        { stage: 16, bosses: [3] },
      ],
      '憑逸': [
        { stage: 14, bosses: [4] },
        { stage: 16, bosses: [3] },
      ],
    },
  },
}

// ─── 工具函式 ─────────────────────────────────────────────────────────────────

/** 取得 BOSS 頭像路徑 */
export function getBossImagePath(stage: number, bossNum: number): string {
  return `/images/components/Stage${stage}_Boss/character_${stage}_${bossNum}.png`
}

/**
 * 從完整元件名稱擷取短名稱
 * "應元件-強擊" / "應元件W-強擊" / "觸元件-強擊" / "觸元件W-強擊" → "強擊"
 */
export function extractShortName(fullName: string): string {
  return fullName.replace(/^[應觸]元件W?-/, '')
}

/** 查詢元件的所有 BOSS 掉落資料 */
export function getComponentDrops(
  componentType: string,
  componentsWType: string,
  fullName: string,
): StageDrop[] {
  const short = extractShortName(fullName)
  return (
    (BOSS_DROPS as Record<string, Record<string, Record<string, StageDrop[]>>>)
      [componentType]?.[componentsWType]?.[short] ?? []
  )
}

/** 取得資料中所有出現過的關卡編號（已排序） */
export function getAllStages(): number[] {
  const stageSet = new Set<number>()
  for (const wTypes of Object.values(BOSS_DROPS)) {
    for (const dropMap of Object.values(wTypes as Record<string, DropMap>)) {
      for (const drops of Object.values(dropMap)) {
        for (const { stage } of drops) stageSet.add(stage)
      }
    }
  }
  return [...stageSet].sort((a, b) => a - b)
}

/** 檢查元件是否有指定關卡的掉落 */
export function componentDropsFromStage(
  componentType: string,
  componentsWType: string,
  fullName: string,
  stage: number,
): boolean {
  return getComponentDrops(componentType, componentsWType, fullName)
    .some((d) => d.stage === stage)
}

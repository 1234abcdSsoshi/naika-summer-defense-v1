import type { StageId } from "./stage";

/**
 * Design reminder — 難易度は夜の湿度と蚊の気配として段階的に立ち上げる。
 * 数値をここへ集約し、調整者がコード本体を変更せずにバランスを検証できるようにする。
 */
export type DifficultyId = StageId;

export type DifficultyProfile = {
  id: DifficultyId;
  label: string;
  shortLabel: string;
  description: string;
  spawnIntervals: [number, number, number];
  activeCaps: [number, number, number];
  sturdyBias: number;
  damageMultiplier: number;
  rewardMultiplier: number;
};

export const DIFFICULTY_PROFILES: Record<DifficultyId, DifficultyProfile> = {
  morning: {
    id: "morning",
    label: "朝の猛暑",
    shortLabel: "朝",
    description: "照りつける日差しと蝉が満ちる、真夏の朝。",
    spawnIntervals: [2.15, 1.55, 1.08],
    activeCaps: [3, 5, 6],
    sturdyBias: -0.08,
    damageMultiplier: 0.78,
    rewardMultiplier: 1,
  },
  dusk: {
    id: "dusk",
    label: "夕暮れの縁側",
    shortLabel: "夕暮れ",
    description: "茜の空と蛍の光が畳を照らす、静かな宵。",
    spawnIntervals: [1.65, 1.15, 0.78],
    activeCaps: [4, 6, 8],
    sturdyBias: 0,
    damageMultiplier: 1,
    rewardMultiplier: 1,
  },
  night: {
    id: "night",
    label: "月夜の防衛",
    shortLabel: "夜",
    description: "満月と行灯に誘われ、蛾が舞い込む夜。",
    spawnIntervals: [1.28, 0.9, 0.62],
    activeCaps: [5, 7, 10],
    sturdyBias: 0.12,
    damageMultiplier: 1.18,
    rewardMultiplier: 1.15,
  },
};

export function getAdaptiveThreat(health: number, hitRate: number, elapsed: number) {
  if (elapsed < 10) return 1;
  const comfort = health > 78 && hitRate > 0.66 ? 1.14 : health < 42 || hitRate < 0.34 ? 0.82 : 1;
  const lateNight = elapsed > 75 ? 1.08 : 1;
  return Math.min(1.25, Math.max(0.75, comfort * lateNight));
}

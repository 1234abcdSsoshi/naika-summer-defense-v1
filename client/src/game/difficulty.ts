/**
 * Design reminder — 難易度は夜の湿度と蚊の気配として段階的に立ち上げる。
 * 数値をここへ集約し、調整者がコード本体を変更せずにバランスを検証できるようにする。
 */
export type DifficultyId = "quiet" | "seasonal" | "storm";

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
  quiet: {
    id: "quiet",
    label: "静かな夜",
    shortLabel: "静夜",
    description: "物語と操作をゆっくり覚える夜。",
    spawnIntervals: [2.15, 1.55, 1.08],
    activeCaps: [3, 5, 6],
    sturdyBias: -0.08,
    damageMultiplier: 0.78,
    rewardMultiplier: 1,
  },
  seasonal: {
    id: "seasonal",
    label: "夏の盛り",
    shortLabel: "夏盛",
    description: "静けさと緊張が拮抗する標準の夜。",
    spawnIntervals: [1.65, 1.15, 0.78],
    activeCaps: [4, 6, 8],
    sturdyBias: 0,
    damageMultiplier: 1,
    rewardMultiplier: 1,
  },
  storm: {
    id: "storm",
    label: "夕立のあと",
    shortLabel: "夕立",
    description: "羽音が途切れない高密度の夜。",
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

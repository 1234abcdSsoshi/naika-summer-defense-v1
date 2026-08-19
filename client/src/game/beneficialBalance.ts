import type { DifficultyId } from "./difficulty";
import type { BeneficialType } from "./stage";

export type BeneficialProgressPhase = 0 | 1 | 2;

// 序盤はゲームの基本操作へ集中させ、中盤以降は蚊の圧力に合わせて救済機会を増やす。
// 夜ほど益虫は希少だが、獲得時のスキル加算を高めて一回の発見に価値を持たせる。
export const BENEFICIAL_SPAWN_INTERVALS: Record<DifficultyId, [number, number, number]> = {
  morning: [18, 12, 8.5],
  dusk: [20, 14, 10],
  night: [22, 16, 11.5],
};

export const BENEFICIAL_INTERVAL_JITTER: Record<DifficultyId, number> = { morning: 0.7, dusk: 0.9, night: 1.1 };

export const BENEFICIAL_CAPTURE_CHARGE: Record<BeneficialType, number> = { cicada: 0.2, dragonfly: 0.23, beetle: 0.26 };

export function getBeneficialProgressPhase(elapsed: number): BeneficialProgressPhase {
  return elapsed < 30 ? 0 : elapsed < 60 ? 1 : 2;
}

export function getBeneficialSpawnInterval({ difficulty, elapsed, threat, random }: { difficulty: DifficultyId; elapsed: number; threat: number; random: number }) {
  const progressPhase = getBeneficialProgressPhase(elapsed);
  const baseInterval = BENEFICIAL_SPAWN_INTERVALS[difficulty][progressPhase];
  const threatRelief = threat > 1 ? Math.min(1.5, (threat - 1) * 6) : 0;
  const jitter = Math.max(0, Math.min(1, random)) * BENEFICIAL_INTERVAL_JITTER[difficulty];
  return Math.max(6.5, baseInterval + jitter - threatRelief);
}

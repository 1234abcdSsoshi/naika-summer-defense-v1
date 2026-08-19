import { DIFFICULTY_PROFILES, type DifficultyId } from "./difficulty";

export type MosquitoType = "small" | "fast" | "sturdy" | "striped" | "giant";

type MosquitoWave = {
  index: 0 | 1 | 2 | 3 | 4;
  activeCap: number;
  spawnInterval: number;
  availableTypes: readonly MosquitoType[];
};

const AVAILABLE_TYPES: Record<MosquitoWave["index"], readonly MosquitoType[]> = {
  0: ["small"],
  1: ["small", "fast"],
  2: ["small", "fast", "sturdy"],
  3: ["small", "fast", "sturdy", "striped"],
  4: ["small", "fast", "sturdy", "striped", "giant"],
};

const CAP_BONUS: Record<MosquitoWave["index"], number> = { 0: 0, 1: 1, 2: 2, 3: 3, 4: 4 };
const INTERVAL_MULTIPLIER: Record<MosquitoWave["index"], number> = { 0: 1, 1: 1, 2: 0.9, 3: 0.84, 4: 0.76 };

function getWaveIndex(elapsed: number): MosquitoWave["index"] {
  if (elapsed < 20) return 0;
  if (elapsed < 40) return 1;
  if (elapsed < 60) return 2;
  if (elapsed < 80) return 3;
  return 4;
}

export function getMosquitoWave({ difficulty, elapsed, threat }: { difficulty: DifficultyId; elapsed: number; threat: number }): MosquitoWave {
  const index = getWaveIndex(elapsed);
  const profile = DIFFICULTY_PROFILES[difficulty];
  const profileStage = index === 0 ? 0 : index < 3 ? 1 : 2;
  const pressureBonus = threat > 1.1 ? 1 : 0;
  return {
    index,
    activeCap: Math.max(2, profile.activeCaps[profileStage] + CAP_BONUS[index] + pressureBonus),
    spawnInterval: (profile.spawnIntervals[profileStage] * INTERVAL_MULTIPLIER[index]) / Math.max(0.75, threat),
    availableTypes: AVAILABLE_TYPES[index],
  };
}

export function chooseMosquitoType(wave: MosquitoWave, roll: number): MosquitoType {
  const normalizedRoll = Math.max(0, Math.min(0.999, roll));
  if (wave.index === 0) return "small";
  if (wave.index === 1) return normalizedRoll < 0.66 ? "small" : "fast";
  if (wave.index === 2) return normalizedRoll < 0.38 ? "small" : normalizedRoll < 0.76 ? "fast" : "sturdy";
  if (wave.index === 3) return normalizedRoll < 0.2 ? "small" : normalizedRoll < 0.5 ? "fast" : normalizedRoll < 0.78 ? "sturdy" : "striped";
  return normalizedRoll < 0.1 ? "small" : normalizedRoll < 0.28 ? "fast" : normalizedRoll < 0.55 ? "sturdy" : normalizedRoll < 0.82 ? "striped" : "giant";
}

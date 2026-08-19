import { DIFFICULTY_PROFILES, type DifficultyId } from "./difficulty";

export type MosquitoType = "small" | "fast" | "sturdy" | "striped" | "giant" | "brood" | "dart" | "tank" | "needle" | "swarm";

type MosquitoWave = {
  index: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
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
  5: ["small", "fast", "sturdy", "striped", "giant", "brood"],
  6: ["small", "fast", "sturdy", "striped", "giant", "brood", "dart"],
  7: ["small", "fast", "sturdy", "striped", "giant", "brood", "dart", "tank"],
  8: ["small", "fast", "sturdy", "striped", "giant", "brood", "dart", "tank", "needle"],
  9: ["small", "fast", "sturdy", "striped", "giant", "brood", "dart", "tank", "needle", "swarm"],
};

const CAP_BONUS: Record<MosquitoWave["index"], number> = { 0: 0, 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 5, 7: 6, 8: 6, 9: 7 };
const INTERVAL_MULTIPLIER: Record<MosquitoWave["index"], number> = { 0: 1, 1: 1, 2: 0.92, 3: 0.86, 4: 0.8, 5: 0.76, 6: 0.72, 7: 0.68, 8: 0.64, 9: 0.6 };

function getWaveIndex(elapsed: number): MosquitoWave["index"] {
  if (elapsed < 15) return 0;
  if (elapsed < 30) return 1;
  if (elapsed < 45) return 2;
  if (elapsed < 60) return 3;
  if (elapsed < 75) return 4;
  if (elapsed < 90) return 5;
  if (elapsed < 105) return 6;
  if (elapsed < 120) return 7;
  if (elapsed < 135) return 8;
  return 9;
}

export function getMosquitoWave({ difficulty, elapsed, threat }: { difficulty: DifficultyId; elapsed: number; threat: number }): MosquitoWave {
  const index = getWaveIndex(elapsed);
  const profile = DIFFICULTY_PROFILES[difficulty];
  const profileStage = index === 0 ? 0 : index < 4 ? 1 : 2;
  const pressureBonus = threat > 1.1 ? 1 : 0;
  return {
    index,
    activeCap: Math.min(12, Math.max(2, profile.activeCaps[profileStage] + CAP_BONUS[index] + pressureBonus)),
    spawnInterval: Math.max(0.32, (profile.spawnIntervals[profileStage] * INTERVAL_MULTIPLIER[index]) / Math.max(0.75, threat)),
    availableTypes: AVAILABLE_TYPES[index],
  };
}

export function chooseMosquitoType(wave: MosquitoWave, roll: number): MosquitoType {
  const normalizedRoll = Math.max(0, Math.min(0.999, roll));
  if (wave.index === 0) return "small";
  if (wave.index === 1) return normalizedRoll < 0.64 ? "small" : "fast";
  if (wave.index === 2) return normalizedRoll < 0.4 ? "small" : normalizedRoll < 0.76 ? "fast" : "sturdy";
  if (wave.index === 3) return normalizedRoll < 0.22 ? "small" : normalizedRoll < 0.5 ? "fast" : normalizedRoll < 0.78 ? "sturdy" : "striped";
  if (wave.index === 4) return normalizedRoll < 0.13 ? "small" : normalizedRoll < 0.3 ? "fast" : normalizedRoll < 0.54 ? "sturdy" : normalizedRoll < 0.78 ? "striped" : "giant";
  if (wave.index === 5) return normalizedRoll < 0.12 ? "small" : normalizedRoll < 0.27 ? "fast" : normalizedRoll < 0.48 ? "sturdy" : normalizedRoll < 0.66 ? "striped" : normalizedRoll < 0.82 ? "giant" : "brood";
  if (wave.index === 6) return normalizedRoll < 0.1 ? "small" : normalizedRoll < 0.22 ? "fast" : normalizedRoll < 0.4 ? "sturdy" : normalizedRoll < 0.55 ? "striped" : normalizedRoll < 0.68 ? "giant" : normalizedRoll < 0.82 ? "brood" : "dart";
  if (wave.index === 7) return normalizedRoll < 0.08 ? "small" : normalizedRoll < 0.18 ? "fast" : normalizedRoll < 0.34 ? "sturdy" : normalizedRoll < 0.47 ? "striped" : normalizedRoll < 0.59 ? "giant" : normalizedRoll < 0.71 ? "brood" : normalizedRoll < 0.83 ? "dart" : "tank";
  if (wave.index === 8) return normalizedRoll < 0.07 ? "small" : normalizedRoll < 0.15 ? "fast" : normalizedRoll < 0.28 ? "sturdy" : normalizedRoll < 0.4 ? "striped" : normalizedRoll < 0.51 ? "giant" : normalizedRoll < 0.62 ? "brood" : normalizedRoll < 0.73 ? "dart" : normalizedRoll < 0.84 ? "tank" : "needle";
  return normalizedRoll < 0.06 ? "small" : normalizedRoll < 0.13 ? "fast" : normalizedRoll < 0.24 ? "sturdy" : normalizedRoll < 0.34 ? "striped" : normalizedRoll < 0.44 ? "giant" : normalizedRoll < 0.54 ? "brood" : normalizedRoll < 0.64 ? "dart" : normalizedRoll < 0.74 ? "tank" : normalizedRoll < 0.87 ? "needle" : "swarm";
}

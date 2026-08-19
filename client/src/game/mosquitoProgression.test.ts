import { describe, expect, it } from "vitest";
import { chooseMosquitoType, getMosquitoWave } from "./mosquitoProgression";

describe("蚊の時間経過進行", () => {
  it("20秒ごとに種類を1つずつ解禁し、80秒以降に5種類すべてを出現候補にする", () => {
    expect(getMosquitoWave({ difficulty: "morning", elapsed: 0, threat: 1 }).availableTypes).toEqual(["small"]);
    expect(getMosquitoWave({ difficulty: "morning", elapsed: 20, threat: 1 }).availableTypes).toEqual(["small", "fast"]);
    expect(getMosquitoWave({ difficulty: "morning", elapsed: 40, threat: 1 }).availableTypes).toEqual(["small", "fast", "sturdy"]);
    expect(getMosquitoWave({ difficulty: "morning", elapsed: 60, threat: 1 }).availableTypes).toEqual(["small", "fast", "sturdy", "striped"]);
    expect(getMosquitoWave({ difficulty: "morning", elapsed: 80, threat: 1 }).availableTypes).toEqual(["small", "fast", "sturdy", "striped", "giant"]);
  });

  it("時間経過と脅威度により、同時出現数は増え、出現間隔は短くなる", () => {
    const opening = getMosquitoWave({ difficulty: "night", elapsed: 0, threat: 1 });
    const climax = getMosquitoWave({ difficulty: "night", elapsed: 80, threat: 1.16 });
    expect(climax.activeCap).toBeGreaterThan(opening.activeCap);
    expect(climax.spawnInterval).toBeLessThan(opening.spawnInterval);
  });

  it("後半の抽選では縞蚊と大型蚊を選択できる", () => {
    const stripedWave = getMosquitoWave({ difficulty: "dusk", elapsed: 60, threat: 1 });
    const giantWave = getMosquitoWave({ difficulty: "dusk", elapsed: 80, threat: 1 });
    expect(chooseMosquitoType(stripedWave, 0.9)).toBe("striped");
    expect(chooseMosquitoType(giantWave, 0.95)).toBe("giant");
  });
});

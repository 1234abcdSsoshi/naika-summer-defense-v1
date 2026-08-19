import { describe, expect, it } from "vitest";
import { chooseMosquitoType, getMosquitoWave } from "./mosquitoProgression";

describe("蚊の時間経過進行", () => {
  it("15秒ごとに種類を1つずつ解禁し、135秒以降に10種類すべてを出現候補にする", () => {
    expect(getMosquitoWave({ difficulty: "morning", elapsed: 0, threat: 1 }).availableTypes).toEqual(["small"]);
    expect(getMosquitoWave({ difficulty: "morning", elapsed: 75, threat: 1 }).availableTypes).toContain("brood");
    expect(getMosquitoWave({ difficulty: "morning", elapsed: 105, threat: 1 }).availableTypes).toContain("tank");
    expect(getMosquitoWave({ difficulty: "morning", elapsed: 120, threat: 1 }).availableTypes).toContain("needle");
    expect(getMosquitoWave({ difficulty: "morning", elapsed: 135, threat: 1 }).availableTypes).toEqual(["small", "fast", "sturdy", "striped", "giant", "brood", "dart", "tank", "needle", "swarm"]);
  });

  it("時間経過と脅威度により、同時出現数は増え、出現間隔は短くなる", () => {
    const opening = getMosquitoWave({ difficulty: "night", elapsed: 0, threat: 1 });
    const climax = getMosquitoWave({ difficulty: "night", elapsed: 135, threat: 1.16 });
    expect(climax.activeCap).toBeGreaterThan(opening.activeCap);
    expect(climax.spawnInterval).toBeLessThan(opening.spawnInterval);
  });

  it("後半の抽選では特殊蚊を選択できる", () => {
    const broodWave = getMosquitoWave({ difficulty: "dusk", elapsed: 75, threat: 1 });
    const swarmWave = getMosquitoWave({ difficulty: "dusk", elapsed: 135, threat: 1 });
    expect(chooseMosquitoType(broodWave, 0.95)).toBe("brood");
    expect(chooseMosquitoType(swarmWave, 0.95)).toBe("swarm");
  });
});

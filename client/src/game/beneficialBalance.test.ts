import { describe, expect, it } from "vitest";
import { BENEFICIAL_CAPTURE_CHARGE, getBeneficialProgressPhase, getBeneficialSpawnInterval } from "./beneficialBalance";

describe("益虫の進行・難易度連動バランス", () => {
  it("序盤・中盤・終盤で益虫の出現間隔を段階的に短縮する", () => {
    expect(getBeneficialProgressPhase(0)).toBe(0);
    expect(getBeneficialProgressPhase(30)).toBe(1);
    expect(getBeneficialProgressPhase(60)).toBe(2);
    expect(getBeneficialSpawnInterval({ difficulty: "dusk", elapsed: 0, threat: 1, random: 0 })).toBe(20);
    expect(getBeneficialSpawnInterval({ difficulty: "dusk", elapsed: 30, threat: 1, random: 0 })).toBe(14);
    expect(getBeneficialSpawnInterval({ difficulty: "dusk", elapsed: 60, threat: 1, random: 0 })).toBe(10);
  });

  it("高い脅威度では出現を早めつつ、最低間隔を守る", () => {
    const standard = getBeneficialSpawnInterval({ difficulty: "night", elapsed: 0, threat: 1, random: 0 });
    const pressured = getBeneficialSpawnInterval({ difficulty: "night", elapsed: 0, threat: 1.25, random: 0 });
    const lateGame = getBeneficialSpawnInterval({ difficulty: "morning", elapsed: 80, threat: 1.25, random: 0 });
    expect(pressured).toBeLessThan(standard);
    expect(lateGame).toBe(7);
    expect(lateGame).toBeGreaterThanOrEqual(6.5);
  });

  it("夜ほど希少な益虫は、一回の捕獲でより多くのスキルを蓄積する", () => {
    expect(BENEFICIAL_CAPTURE_CHARGE.cicada).toBe(0.2);
    expect(BENEFICIAL_CAPTURE_CHARGE.dragonfly).toBe(0.23);
    expect(BENEFICIAL_CAPTURE_CHARGE.beetle).toBe(0.26);
    expect(BENEFICIAL_CAPTURE_CHARGE.cicada).toBeLessThan(BENEFICIAL_CAPTURE_CHARGE.dragonfly);
    expect(BENEFICIAL_CAPTURE_CHARGE.dragonfly).toBeLessThan(BENEFICIAL_CAPTURE_CHARGE.beetle);
  });
});

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(import.meta.dirname, "../../..");
const componentSource = readFileSync(resolve(projectRoot, "client/src/components/GameCanvas.tsx"), "utf8");
const styleSource = readFileSync(resolve(projectRoot, "client/src/index.css"), "utf8");
const sceneSource = readFileSync(resolve(projectRoot, "client/src/game/scene.ts"), "utf8");

describe("蚊と小判の描画仕様", () => {
  it("小判上の丸いハイライト要素を描画しない", () => {
    const kobanMarkup = componentSource.match(/koban-dom-layer[\s\S]*?placed-item-dom-layer/)?.[0] ?? "";
    expect(kobanMarkup).not.toContain("<i />");
  });

  it("最終スタイルで蚊と小判にドロップシャドウを付与しない", () => {
    const finalEnemyStyle = styleSource.match(/\.enemy-dom \{ width: 52px;[^\n]+/)?.[0] ?? "";
    const finalKobanStyle = styleSource.match(/\.koban-dom \{ width: 43px;[^\n]+/)?.[0] ?? "";
    expect(finalEnemyStyle).toContain("filter: none");
    expect(finalKobanStyle).toContain("box-shadow: none");
    expect(finalKobanStyle).toContain("filter: none");
    expect(styleSource).not.toMatch(/@keyframes enemy-3d-flight[^\n]+drop-shadow/);
  });

  it("Babylon側の蚊・小判下層ビジュアルを非表示にする", () => {
    const mosquitoSpawn = sceneSource.match(/private spawnMosquito\(\)[\s\S]*?private updateMosquitoes/)?.[0] ?? "";
    const coinSpawn = sceneSource.match(/private spawnCoin\([\s\S]*?private collectCoin/)?.[0] ?? "";
    expect(mosquitoSpawn).toContain("root.setEnabled(false)");
    expect(coinSpawn).toContain("root.setEnabled(false)");
  });

  it("確認専用画面では蚊と小判を同時に表示できる", () => {
    expect(sceneSource).toContain('private readonly visualCheck = new URLSearchParams(window.location.search).has("visual-check")');
    const startRun = sceneSource.match(/startRun = \(\) => \{[\s\S]*?this\.callbacks\.onPhase\("playing"\)/)?.[0] ?? "";
    expect(startRun).toContain("if (this.visualCheck)");
    expect(startRun).toContain("this.spawnMosquito()");
    expect(startRun).toContain("this.spawnCoin(-1.25, 1.55, 1)");
  });

  it("確認専用画面では小判を保持してDOM検証できる", () => {
    const updateCoins = sceneSource.match(/private updateCoins\([\s\S]*?private runDemo/)?.[0] ?? "";
    expect(updateCoins).toContain("if (this.visualCheck) continue");
  });
});

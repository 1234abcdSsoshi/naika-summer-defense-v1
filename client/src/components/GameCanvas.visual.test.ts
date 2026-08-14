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
    const finalKobanStyle = styleSource.match(/\.koban-dom \{ width: 29px;[^\n]+/)?.[0] ?? "";
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
    expect(startRun).toContain("this.spawnCoin(this.darumaCoinCheck ? -1.12 : -1.25, this.darumaCoinCheck ? -0.45 : 1.55, 1)");
  });

  it("確認専用画面では小判を保持してDOM検証できる", () => {
    const updateCoins = sceneSource.match(/private updateCoins\([\s\S]*?private runDemo/)?.[0] ?? "";
    expect(updateCoins).toContain("if (this.visualCheck) continue");
  });

  it("カエルは方向を定めた舌で蚊を引き寄せ、小判を自動回収する", () => {
    expect(sceneSource).toContain('type MosquitoState = "approaching" | "feeding" | "captured" | "falling"');
    expect(sceneSource).toContain('target.state = "captured"');
    expect(sceneSource).toContain("target.captureTargetX");
    expect(sceneSource).toContain('this.collectCoin(coin, "カエルが小判を飲み込んだ +1")');
    expect(sceneSource).toContain('phase: "aim" as const');
    expect(sceneSource).toContain('phase: "pull"');
    expect(sceneSource).toContain("frogPreviewSlow");
    expect(sceneSource).toContain("frogPreviewPull");
    expect(sceneSource).toContain("frogCoinCheck");
    expect(sceneSource).toContain("this.spawnCoin(-1.12, -0.45, 1)");
    expect(sceneSource).toContain("if (this.frogCoinCheck) this.nextSpawnAt = Number.POSITIVE_INFINITY");
    expect(sceneSource).toContain("&& !this.frogCoinCheck");
    expect(componentSource).toContain('params.has("frog-coin-check")');
    expect(componentSource).toContain('"--frog-mouth-x"');
    expect(componentSource).toContain('"--tongue-origin-x"');
    expect(styleSource).toContain(".placed-item-frog.is-aiming .placed-item-art");
  });

  it("アイテムの残り時間は右下の小型表示で、線香本体だけが回転する", () => {
    expect(componentSource).toContain('className="incense-coil"');
    expect(styleSource).toContain("top: auto; right: 2px; bottom: -4px");
    expect(styleSource).toContain("width: 18px; height: 18px");
    expect(styleSource).toContain("@keyframes incense-coil-turn");
    expect(styleSource).toContain("animation: incense-coil-turn 5.6s linear infinite");
    expect(sceneSource).not.toContain("item.mesh.rotation.z += 0.015");
    expect(sceneSource).toContain("private readonly itemPreviewId: ItemId");
    expect(sceneSource).toContain("private readonly itemPreviewHold");
  });

  it("だるまはフィールドを巡回し、小判を吸い寄せてから回収する", () => {
    expect(sceneSource).toContain("originX: number");
    expect(sceneSource).toContain("Math.sin(travel * 1.17) * 1.12");
    expect(sceneSource).toContain("coin.attractItemKey = item.mesh.name");
    expect(sceneSource).toContain("const daruma = this.placed.find((item) => item.mesh.name === coin.attractItemKey)");
    expect(sceneSource).toContain("coin.attractNotice = \"ダルマが小判を吸い寄せた +1\"");
    expect(sceneSource).toContain("const pull = Math.min(1, delta * pullRate)");
    expect(sceneSource).toContain("private readonly darumaPreviewPull");
    expect(sceneSource).toContain("const pullRate = this.darumaPreviewPull ? 0.16");
    expect(sceneSource).toContain("if (!this.darumaPreviewPull && !this.darumaCoinCheck) this.spawnMosquito()");
    expect(sceneSource).toContain("private readonly darumaCoinCheck");
    expect(sceneSource).toContain("this.darumaCoinCheck ? -1.12 : -1.25");
    expect(componentSource).toContain("key={item.key}");
    expect(styleSource).toContain("@keyframes daruma-travel-bob");
  });

  it("右上コインゲージは丸い記号ではなく小判アイコンを表示する", () => {
    expect(componentSource).toContain('className="hud-koban"');
    expect(componentSource).toContain('aria-label="小判"');
    expect(componentSource).not.toContain('<div className="coin-readout"><span>◒</span>');
    expect(styleSource).toContain(".hud-koban { display: inline-block; width: 19px; height: 15px");
  });

  it("フィールドに出現する小判は従来の約2/3の大きさで表示する", () => {
    expect(styleSource).toContain(".koban-dom { width: 29px; height: 24px");
    expect(sceneSource).toContain("this.spawnCoin(mosquito.x, mosquito.y, info.coin)");
  });

  it("設置アイテムのBabylon下層スプライト・円盤は表示しない", () => {
    const placeItem = sceneSource.match(/private placeItem\([\s\S]*?private removeItem/)?.[0] ?? "";
    expect(placeItem).toContain("root.setEnabled(false)");
    expect(placeItem).toContain("DOMオーバーレイのみを使用する");
  });

  it("確認用の設置アイテム表示は全種類で保持できる", () => {
    expect(sceneSource).toContain('item.id === "cat"');
    expect(sceneSource).toContain("&& !this.itemPreviewHold");
  });

  it("設置アイテムはBabylon下層の無効化状態をDOM検証属性へ公開する", () => {
    expect(sceneSource).toContain("underlayDisabled: !mesh.isEnabled()");
    expect(componentSource).toContain('data-babylon-underlay={item.underlayDisabled ? "disabled" : "enabled"}');
  });

  it("招き猫は従来の防衛アイテムアトラス表示を使い、生成スプライトを参照しない", () => {
    expect(componentSource).not.toContain('className="cat-waving-paw"');
    expect(componentSource).not.toContain('data-item-motion={item.id === "cat" ? "sprite-waving" : "static"}');
    expect(styleSource).not.toContain("@keyframes cat-waving-paw");
    expect(styleSource).not.toContain("@keyframes cat-body-bob");
    expect(componentSource).not.toContain("CAT_WAVING_SPRITESHEET");
    expect(componentSource).not.toContain("naika-maneki-cat-waving-spritesheet");
    expect(styleSource).not.toContain("@keyframes cat-sprite-wave");
    expect(styleSource).toContain(".placed-item-cat .placed-item-art { border-radius: 14px; background-position: 100% 0 !important; }");
  });

  it("有効範囲は設置プレビュー中だけ表示し、設置済みアイテムへ残さない", () => {
    expect(componentSource).toContain("placement-range-preview");
    expect(componentSource).toContain("data-placement-range={placementPreview.item}");
    expect(componentSource).toContain("onPointerMove={updatePlacementPreview}");
    expect(componentSource).not.toContain('<span className="placed-item-range"');
    expect(styleSource).toContain(".placement-range-preview");
    expect(sceneSource).toContain('get("placement-check")');
    expect(sceneSource).toContain("if (this.placementPreviewCheck) this.placement = this.placementPreviewCheck");
  });

  it("穏やかな放射状光粒は招き猫の実効果発動時だけに表示する", () => {
    expect(componentSource).toContain('activation.item === "cat" && activation.kind === "trigger"');
    expect(componentSource).toContain('data-activation-source="cat"');
    expect(componentSource).toContain("cat-radiance-mote");
    expect(componentSource).not.toContain("ACTIVATION_PARTICLES");
    expect(componentSource).not.toContain("item-activation-frog");
    expect(styleSource).toContain(".cat-radiance");
    expect(styleSource).toContain(".cat-radiance-mote");
    expect(styleSource).toContain("@keyframes cat-radiance-mote");
    expect(styleSource).not.toContain(".activation-washi");
  });
});

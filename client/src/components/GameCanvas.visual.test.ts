import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(import.meta.dirname, "../../..");
const componentSource = readFileSync(resolve(projectRoot, "client/src/components/GameCanvas.tsx"), "utf8");
const styleSource = readFileSync(resolve(projectRoot, "client/src/index.css"), "utf8");
const sceneSource = readFileSync(resolve(projectRoot, "client/src/game/scene.ts"), "utf8");
const stageSource = readFileSync(resolve(projectRoot, "client/src/game/stage.ts"), "utf8");

describe("蚊と小判の描画仕様", () => {
  it("小判上の丸いハイライト要素を描画しない", () => {
    const kobanMarkup = componentSource.match(/koban-dom-layer[\s\S]*?placed-item-dom-layer/)?.[0] ?? "";
    expect(kobanMarkup).not.toContain("<i />");
    expect(kobanMarkup).not.toMatch(/<i[^>]*>/);
    expect(styleSource).toContain(".koban-dom span, .koban-dom i { display: none; }");
    expect(componentSource).toContain('const KOBAN_ASSET = "/manus-storage/naika-3d-koban-true-alpha_76e66136.png"');
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

  it("朝・夕暮れ・夜の3ステージ固有背景を使用し、夜は満月版を維持する", () => {
    expect(stageSource).toContain('export type StageId = "morning" | "dusk" | "night"');
    expect(stageSource).toContain('morning: {');
    expect(stageSource).toContain('dusk: {');
    expect(stageSource).toContain('night: {');
    expect(stageSource).toContain('/manus-storage/naika-room-background-morning_61f9fe46.png');
    expect(stageSource).toContain('/manus-storage/naika-room-background-dusk_2b5c1a6f.png');
    expect(stageSource).toContain('/manus-storage/naika-room-background-full-moon_95c25e77.png');
    expect(componentSource).toContain('const stage = STAGE_PRESENTATIONS[difficulty]');
    expect(componentSource).toContain('url(${stage.background})');
    expect(sceneSource).toContain('STAGE_PRESENTATIONS.night.background');
    expect(componentSource).not.toContain('className="moon-disc"');
    expect(styleSource).not.toContain('.moon-disc {');
  });

  it("全ステージの背景を180度回転して表示する", () => {
    expect(componentSource).toContain('className="stage-background"');
    expect(styleSource).toContain("transform: rotate(180deg)");
    expect(sceneSource).toContain("texture.uScale = -1");
    expect(sceneSource).toContain("texture.vScale = -1");
    expect(sceneSource).toContain("texture.uOffset = 1");
    expect(sceneSource).toContain("texture.vOffset = 1");
  });

  it("朝・夕暮れに風鈴と雲の背景演出を表示し、背景の視認性を補正する", () => {
    expect(componentSource).toContain('className={`stage-atmosphere ${difficulty === "night" ? "is-night" : ""}`}');
    expect(componentSource).toContain('className={`wind-chime-control ${chimePulse ? "is-ringing" : ""}`}');
    expect(componentSource).toContain('className="stage-cloud stage-cloud-one"');
    expect(styleSource).toContain("@keyframes stage-cloud-drift");
    expect(styleSource).toContain("@keyframes wind-chime-sway");
    expect(styleSource).toContain("backdrop-filter: brightness(.84) contrast(1.16) saturate(.92)");
    expect(styleSource).toContain(".stage-dusk .stage-contrast-overlay");
  });

  it("歯車を表示せず、風鈴タップで音量設定を開きランダムなチリン音を再生する", () => {
    expect(componentSource).not.toContain('className="settings-button"');
    expect(componentSource).toContain('className={`wind-chime-control ${chimePulse ? "is-ringing" : ""}`}');
    expect(componentSource).toContain('aria-label="音量設定を開く"');
    expect(componentSource).toContain("unlockWindChimeAudio(); playWindChime();");
    expect(componentSource).toContain("7200 + Math.random() * 5800");
    expect(componentSource).toContain("0.065 * audioSettings.sfx");
    expect(componentSource).toContain('className="settings-panel wind-chime-settings-panel"');
    expect(styleSource).toContain(".wind-chime-control");
    expect(styleSource).toContain(".wind-chime-settings-panel");
  });

  it("スキルボタンのY位置を維持し、X位置だけを画面中央へ表示する", () => {
    expect(styleSource).toContain(".skill-core { position: absolute; top: 32%; left: 50%");
    expect(styleSource).toContain("transform: translate(-50%, -50%)");
    expect(styleSource).toContain(".skill-core { top: 31%; left: 50%; width: 70px; height: 70px; transform: translate(-50%, -50%); }");
  });

  it("風鈴タップからBGM音量を調整できる", () => {
    expect(componentSource).toContain('className={`wind-chime-control ${chimePulse ? "is-ringing" : ""}`}');
    expect(componentSource).toContain('aria-label="音量設定を開く"');
    expect(componentSource).toContain('aria-expanded={showAudioSettings}');
    expect(componentSource).toContain('has("settings-check")');
    expect(componentSource).toContain('className="settings-panel wind-chime-settings-panel"');
    expect(componentSource).toContain('aria-label="BGM音量"');
    expect(componentSource).toContain('Math.round(audioSettings.bgm * 100)');
    expect(styleSource).toContain(".wind-chime-control");
    expect(styleSource).toContain(".settings-panel");
    expect(styleSource).toContain(".wind-chime-settings-panel");
    expect(styleSource).not.toContain('>⚙<');
  });

  it("蚊の出現時にカラン音を追加せず、カラン音を抑えたBGMを使う", () => {
    expect(stageSource).toContain('/manus-storage/naika-night-defense-loop-no-bell_33ace5a3.mp3');
    const mosquitoSpawn = sceneSource.match(/private spawnMosquito\(\)[\s\S]*?private spawnBeneficial/)?.[0] ?? "";
    expect(mosquitoSpawn).not.toContain("playTone");
    expect(sceneSource).toContain("startMosquitoBuzz(context)");
    expect(sceneSource).toContain('const KOBAN_COLLECT_SFX = "/manus-storage/naika-koban-collect_c76439e0.mp3"');
    expect(sceneSource).toContain('const ITEM_PLACE_SFX = "/manus-storage/naika-item-place_c23e24d7.mp3"');
    expect(sceneSource).toContain("Math.max(0, 1000 - startAtSeconds * 1000)");
    expect(sceneSource).toContain("effect.pause();");
    expect(sceneSource).toContain("this.playInteractionSfx(this.kobanCollectSfx, 0.48, 0.3);");
    expect(sceneSource).toContain("Math.max(0, 1000 - startAtSeconds * 1000)");
  });

  it("確認画面を開くとゲームを一時停止し、キャンセルで再開する", () => {
    expect(componentSource).toContain("handleRef.current?.setPaused(true)");
    expect(componentSource).toContain("handleRef.current?.setPaused(false)");
    expect(componentSource).toContain("const openContinuePrompt");
    expect(componentSource).toContain("const cancelReturnToTitle");
    expect(sceneSource).toContain("setPaused: (paused: boolean) => void");
    expect(sceneSource).toContain("if (!this.running || this.paused) return;");
    expect(sceneSource).toContain("setPaused: world.setPaused");
  });

  it("縁側へ戻るとプレイBGMからタイトルBGMへ切り替わる", () => {
    expect(componentSource).toContain('const TITLE_BGM = "/manus-storage/naika-engawa-title-bgm_bcb74aac.wav"');
    expect(componentSource).toContain('src={phase === "title" ? TITLE_BGM : stage.gameplayBgm}');
    expect(componentSource).toContain("if (phase === \"title\") bgm.play().catch(() => undefined)");
  });

  it("益虫を捕獲してスキルを蓄積し、ステージ固有の像モチーフで全蚊を撃破する", () => {
    expect(stageSource).toContain('cicada: 0');
    expect(stageSource).toContain('firefly: 1');
    expect(stageSource).toContain('moth: 2');
    expect(stageSource).toContain('buddha: 0');
    expect(stageSource).toContain('fujin: 1');
    expect(stageSource).toContain('raijin: 2');
    expect(sceneSource).toContain('onBeneficials: (beneficials: BeneficialView[]) => void');
    expect(sceneSource).toContain('onSkill: (skill: SkillView) => void');
    expect(sceneSource).toContain('private spawnBeneficial()');
    expect(sceneSource).toContain('this.difficulty === "morning" ? 12 : this.difficulty === "dusk" ? 12 + this.random() * 3 : 12 + this.random() * 6');
    expect(sceneSource).toContain('const captureCharge = beneficial.type === "cicada" ? 0.2 : 0.24');
    expect(sceneSource).toContain('this.skillCharge = Math.min(1, this.skillCharge + captureCharge)');
    expect(sceneSource).toContain('this.skillCharge = Math.min(1, this.skillCharge + safeDelta / 60)');
    expect(sceneSource).toContain('activateSkill = () =>');
    expect(sceneSource).toContain('this.killMosquito(mosquito, false, "skill")');
    expect(componentSource).toContain('onBeneficials: setBeneficials');
    expect(componentSource).toContain('onSkill: setSkill');
    expect(componentSource).toContain('className={`beneficial-dom beneficial-${beneficial.type}`}');
    expect(componentSource).toContain('className={`skill-core ${skill.ready ? "is-ready" : ""}');
    expect(componentSource).toContain('handleRef.current?.activateSkill()');
    expect(styleSource).toContain('.beneficial-dom-layer');
    expect(styleSource).toContain('.skill-core');
    expect(styleSource).toContain('.skill-hands');
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

  it("内蚊アイコンは継続確認を開き、いいえでステージ選択へ戻れる", () => {
    expect(componentSource).toContain('className="brand-mini brand-menu-button"');
    expect(componentSource).toContain("最初の画面へ戻るか確認する");
    expect(componentSource).toContain("setShowContinuePrompt(true)");
    expect(componentSource).toContain("最初の画面へ戻りますか？");
    expect(componentSource).toContain("キャンセル");
    expect(componentSource).toContain("戻る");
    expect(componentSource).toContain("onClick={returnToTitle}");
    expect(componentSource).toContain("現在のプレイを終了して最初の画面へ戻ります");
    expect(componentSource).toContain('className="continue-dialog-warning"');
    expect(componentSource).toContain("現在のスコアは破棄されます。");
    expect(styleSource).toContain(".continue-dialog .continue-dialog-warning");
    expect(sceneSource).toContain("abandonRun: () => void");
    expect(sceneSource).toContain('abandonRun = () =>');
    expect(sceneSource).toContain('this.callbacks.onPhase("title")');
    expect(styleSource).toContain(".continue-dialog-backdrop");
    expect(styleSource).toContain(".brand-menu-button");
    expect(styleSource).toContain(".brand-menu-button { position: relative; pointer-events: auto;");
    expect(styleSource).toContain('.brand-menu-button::before { content: ""; position: absolute; z-index: -1; inset: -8px; }');
  });

  it("連続撃破のHUDバッジと連続数を含む通知を表示せず、内部スコア補正は維持する", () => {
    expect(componentSource).not.toContain("combo-badge");
    expect(styleSource).not.toContain(".combo-badge");
    expect(sceneSource).not.toContain("${this.combo}連続");
    expect(sceneSource).toContain("1 + this.combo * 0.05");
  });

  it("不要な命中・手動回収案内を表示せず、カエルは半分の間隔で捕食し、蚊を最前面へ描画する", () => {
    expect(sceneSource).not.toContain('"命中！"');
    expect(sceneSource).not.toContain('"指先で回収 +1"');
    expect(sceneSource).toContain("item.nextActionAt = this.now + 0.85");
    expect(styleSource).toContain(".enemy-dom-layer { pointer-events: none; position: absolute; z-index: 6;");
    expect(styleSource).toContain(".koban-dom-layer { pointer-events: none; position: absolute; z-index: 4;");
    expect(styleSource).toContain(".placed-item-dom-layer { pointer-events: none; position: absolute; z-index: 3;");
  });

  it("寝ている中年男性は体力に応じて刺し跡と表情を変え、体力が尽きると目を覚ます", () => {
    expect(componentSource).toContain('const SLEEPER_ASSET = "/manus-storage/naika-sleeper-middle-aged-man-upperbody-states-clean_49502447.png"');
    expect(componentSource).toContain('const PILLOW_ASSET = "/manus-storage/naika-sleeper-japanese-pillow-horizontal_e5543254.png"');
    expect(componentSource).toContain('className="sleeper-pillow"');
    expect(componentSource).toContain('function getSleeperState(health: number, awake = false)');
    expect(componentSource).toContain('const displayHealth = sleeperPreview ? previewHealth : hud.health;');
    expect(componentSource).toContain('if (health <= 35) return "distressed"');
    expect(componentSource).toContain('if (health <= 70) return "bitten"');
    expect(componentSource).toContain('data-sleeper-state={sleeperState}');
    expect(componentSource).toContain('className="gameover-wake-overlay"');
    expect(componentSource).toContain('const [isGameOverWaking, setIsGameOverWaking] = useState(false);');
    expect(componentSource).toContain('setIsGameOverWaking(true);');
    expect(componentSource).toContain('setPhase("result");');
    expect(componentSource).toContain('gameOverPreview || isGameOverWaking');
    expect(componentSource).toContain('目を覚ましてしまった。');
    expect(componentSource).toContain('params.has("game-over-check")');
    expect(componentSource).toContain('params.has("game-over-result-check")');
    expect(componentSource).toContain('params.has("damage-demo")');
    expect(componentSource).toContain('params.has("mosquito-flow-demo")');
    expect(componentSource).toContain('params.has("mosquito-flow-result-demo")');
    expect(sceneSource).toContain('private readonly gameOverPreview');
    expect(sceneSource).toContain('private readonly gameOverResultPreview');
    expect(sceneSource).toContain('this.playerRoot.setEnabled(false)');
    expect(sceneSource).toContain('this.health = 0;');
    expect(sceneSource).toContain('private readonly healthPreview');
    expect(sceneSource).toContain('this.health = this.healthPreview;');
    expect(sceneSource).toContain('private readonly damageDemoStage');
    expect(sceneSource).toContain('this.runDamageDemo(true);');
    expect(sceneSource).toContain('private runDamageDemo(immediate = false)');
    expect(sceneSource).toContain('this.bitePlayer(this.damageDemoStage === "gameover" ? 34 : 38);');
    expect(sceneSource).toContain('this.emitHud(this.health <= 0 ? "蚊に起こされてしまった…" : "寝息が細くなっている…");');
    expect(sceneSource).toContain('private readonly mosquitoFlowDemo');
    expect(sceneSource).toContain('params.has("mosquito-flow-result-demo") ? "gameover" : null');
    expect(sceneSource).toContain('if (this.mosquitoFlowDemo) this.startMosquitoFlowDemo();');
    expect(sceneSource).toContain('private startMosquitoFlowDemo()');
    expect(sceneSource).toContain('mosquito.state === "feeding"');
    expect(sceneSource).toContain('if (this.mosquitoFlowDemo && mosquito.state === "feeding") mosquito.biteAt = Math.min(mosquito.biteAt, this.now);');
    expect(sceneSource).toContain('if (this.mosquitoFlowDemo) {');
    expect(styleSource).toContain('.sleeper-state-bitten .sleeper-sprite');
    expect(styleSource).toContain('.sleeper-state-distressed .sleeper-bite');
    expect(styleSource).toContain('.gameover-wake-overlay');
    expect(styleSource).toContain('bottom: 94px; left: 12%;');
    expect(styleSource).toContain('width: min(174px, 46vw); height: min(174px, 46vw);');
    expect(styleSource).toContain('background: var(--sleeper-asset) center / 200% 200% no-repeat');
    expect(styleSource).toContain('.game-sleeper-anchor .sleeper-pillow');
    expect(styleSource).toContain('background: var(--pillow-asset) center / contain no-repeat');
    expect(styleSource).toContain('bottom: 71px;');
    expect(styleSource).toContain('transform: translateX(-50%) rotate(0deg);');
  });

  it("中年男性は頭と肩だけのコンパクト表示にする", () => {
    expect(styleSource).toContain("width: min(174px, 46vw); height: min(174px, 46vw);");
    expect(styleSource).toContain("bottom: -6px;");
    expect(styleSource).toContain("width: min(122px, 32vw); height: min(50px, 13vw);");
  });

  it("フィールド上のキャラクターを1.5倍で表示する", () => {
    expect(styleSource).toContain("scale(calc(var(--enemy-scale) * 1.5))");
    expect(styleSource).toContain("transform: translate(-50%, -50%) scale(1.5);");
    expect(styleSource).toContain("width: min(174px, 46vw); height: min(174px, 46vw);");
    expect(styleSource).toContain("width: min(280px, 76vw); height: min(280px, 76vw);");
    expect(styleSource).toContain("width: 105px; height: 105px;");
    expect(styleSource).toContain("bottom: -6px;");
  });
});

/**
 * Design reminder — 「藍の縁側、行灯の防衛線」:
 * 深い藍の夏夜に、月白と行灯橙だけを重要情報に使う。
 * React is the frame; this module owns the Babylon canvas and all gameplay.
 */
import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { Camera } from "@babylonjs/core/Cameras/camera";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Layer } from "@babylonjs/core/Layers/layer";
import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import "@babylonjs/core/Shaders/layer.vertex";
import "@babylonjs/core/Shaders/layer.fragment";
import "@babylonjs/core/Shaders/default.vertex";
import "@babylonjs/core/Shaders/standard.fragment";
import { DIFFICULTY_PROFILES, getAdaptiveThreat, type DifficultyId } from "./difficulty";
import { GameplayTelemetry, type RunAnalytics } from "./telemetry";
import { STAGE_PRESENTATIONS, type BeneficialType, type SkillMotif } from "./stage";
import { BENEFICIAL_CAPTURE_CHARGE, getBeneficialSpawnInterval } from "./beneficialBalance";
import { chooseMosquitoType, getMosquitoWave, type MosquitoType } from "./mosquitoProgression";

const ENEMY_SPRITES: Record<MosquitoType, string> = {
  small: "/manus-storage/naika-mosquito-small-sprite_af4952dd.png",
  fast: "/manus-storage/naika-mosquito-fast-sprite_f65f8e38.png",
  sturdy: "/manus-storage/naika-mosquito-sturdy-sprite_87f8df86.png",
  striped: "/manus-storage/naika-mosquito-striped-sprite_51ac0220.png",
  giant: "/manus-storage/naika-mosquito-giant-sprite_79bc0575.png",
  brood: "/manus-storage/naika-mosquito-brood-sprite_3d3812cb.png",
  dart: "/manus-storage/naika-mosquito-dart-sprite_25512159.png",
  tank: "/manus-storage/naika-mosquito-tank-sprite_4e400a58.png",
  needle: "/manus-storage/naika-mosquito-needle-sprite_a6033f92.png",
  swarm: "/manus-storage/naika-mosquito-swarm-sprite_a944c58a.png",
};
const HAZARD_SPRITES = {
  egg: "/manus-storage/naika-hazard-egg-sprite_a11929c9.png",
  larva: "/manus-storage/naika-hazard-larva-sprite_2a7101be.png",
  needle: "/manus-storage/naika-hazard-needle-sprite_5ca3d79a.png",
} as const;
const ITEM_ATLAS = "/manus-storage/naika-defense-items-atlas_4c991078.png";
const VFX_ATLAS = "/manus-storage/naika-woodblock-vfx-atlas_9cc67c3a.png";
const KOBAN_COLLECT_SFX = "/manus-storage/naika-koban-piggybank_6e0b5118.mp3";
const ITEM_PLACE_SFX = "/manus-storage/naika-item-place_c23e24d7.mp3";

export type ItemId = "incense" | "cat" | "frog" | "daruma";
type MosquitoState = "approaching" | "feeding" | "captured" | "falling";

export type HudState = {
  health: number;
  score: number;
  coins: number;
  combo: number;
  elapsed: number;
  items: Record<ItemId, { price: number; active: boolean; cooldown?: number }>;
  placement: ItemId | null;
  notice: string;
};

export type ResultState = { score: number; best: number; kills: number; duration: number; analytics?: RunAnalytics };
export type MosquitoView = { id: number; type: MosquitoType; x: number; y: number; bank: number; scale: number };
export type HazardKind = keyof typeof HAZARD_SPRITES;
export type HazardView = { id: number; kind: HazardKind; x: number; y: number; angle: number; scale: number };
export type KobanView = { id: number; x: number; y: number };
export type PlacedItemView = { key: string; id: ItemId; x: number; y: number; range: number; duration: number | null; remaining: number | null; tone: string; underlayDisabled: boolean };
export type FrogTongueView = { itemX: number; itemY: number; targetX: number; targetY: number; nonce: number; phase: "aim" | "pull" };
export type ItemActivationView = { key: string; item: ItemId; x: number; y: number; tone: string; kind: "placed" | "trigger" };
export type BeneficialView = { id: number; type: BeneficialType; x: number; y: number; drift: number };
export type SkillView = { charge: number; motif: SkillMotif; ready: boolean; casting: boolean };

export type GameCallbacks = {
  onHud: (hud: HudState) => void;
  onMosquitoes: (mosquitoes: MosquitoView[]) => void;
  onHazards: (hazards: HazardView[]) => void;
  onKobans: (kobans: KobanView[]) => void;
  onPlacedItems: (items: PlacedItemView[]) => void;
  onFrogTongue: (tongue: FrogTongueView | null) => void;
  onItemActivation: (activation: ItemActivationView) => void;
  onBeneficials: (beneficials: BeneficialView[]) => void;
  onSkill: (skill: SkillView) => void;
  onPhase: (phase: "title" | "playing" | "result") => void;
  onResult: (result: ResultState) => void;
};

export type GameHandle = {
  scene: Scene;
  startRun: () => void;
  abandonRun: () => void;
  purchase: (item: ItemId) => void;
  cancelPlacement: () => void;
  setDifficulty: (difficulty: DifficultyId) => void;
  retry: () => void;
  setPaused: (paused: boolean) => void;
  activateSkill: () => void;
  dispose: () => void;
};

type Mosquito = {
  id: number;
  type: MosquitoType;
  hp: number;
  state: MosquitoState;
  x: number;
  y: number;
  vx: number;
  vy: number;
  speed: number;
  biteAt: number;
  fallingFor: number;
  capturedFor: number;
  captureOriginX: number;
  captureOriginY: number;
  captureTargetX: number;
  captureTargetY: number;
  nextSpecialAt: number;
  mesh: TransformNode;
};

type Hazard = {
  id: number;
  kind: HazardKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  bornAt: number;
  hatchAt: number;
  angle: number;
  mesh: TransformNode;
};

type Coin = {
  id: number;
  x: number;
  y: number;
  bornAt: number;
  mesh: TransformNode;
  attractToX?: number;
  attractToY?: number;
  attractItemKey?: string;
  attractNotice?: string;
};

type PlacedItem = {
  id: ItemId;
  x: number;
  y: number;
  originX: number;
  originY: number;
  bornAt: number;
  mesh: TransformNode;
  nextActionAt: number;
  nextCollectAt: number;
};

type VfxKind = "tap" | "seal" | "smoke" | "damage";
type Vfx = { kind: VfxKind; bornAt: number; duration: number; mesh: TransformNode };
type Beneficial = { id: number; type: BeneficialType; x: number; y: number; vx: number; bornAt: number; drift: number };
const ITEM_CELL: Record<ItemId, number> = { incense: 0, cat: 1, frog: 2, daruma: 3 };
const VFX_CELL: Record<VfxKind, number> = { tap: 0, seal: 1, smoke: 2, damage: 3 };

const ITEM_INFO: Record<ItemId, { price: number; label: string; color: Color3 }> = {
  incense: { price: 6, label: "蚊取り線香", color: Color3.FromHexString("#98AD5C") },
  cat: { price: 8, label: "招き猫", color: Color3.FromHexString("#F3E6D3") },
  frog: { price: 14, label: "カエル", color: Color3.FromHexString("#7BAF70") },
  daruma: { price: 10, label: "ダルマ", color: Color3.FromHexString("#CC5C4C") },
};

const ITEM_RUNTIME: Record<ItemId, { duration: number | null; range: number; tone: string }> = {
  incense: { duration: 15, range: 1.5, tone: "#95ad62" },
  cat: { duration: 12, range: 2.25, tone: "#f6a33a" },
  frog: { duration: 20, range: 1.7, tone: "#88b76d" },
  daruma: { duration: 12, range: 2.25, tone: "#cc5c4c" },
};
const FROG_CAPTURE_INTERVAL = 0.2;
const FROG_TONGUE_DELAY_MS = 35;
const FROG_TONGUE_CYCLE_MS = 180;

const MOSQUITO_INFO: Record<MosquitoType, { hp: number; speed: number; score: number; coin: number; color: Color3 }> = {
  small: { hp: 1, speed: 1.15, score: 100, coin: 1, color: Color3.FromHexString("#1D1B22") },
  fast: { hp: 1, speed: 1.78, score: 160, coin: 1, color: Color3.FromHexString("#243A5A") },
  sturdy: { hp: 2, speed: 0.94, score: 260, coin: 2, color: Color3.FromHexString("#3A2C3D") },
  striped: { hp: 1, speed: 2.12, score: 220, coin: 1, color: Color3.FromHexString("#34444B") },
  giant: { hp: 3, speed: 0.82, score: 460, coin: 3, color: Color3.FromHexString("#452C33") },
  brood: { hp: 2, speed: 1.04, score: 350, coin: 2, color: Color3.FromHexString("#5B3442") },
  dart: { hp: 1, speed: 3.08, score: 360, coin: 1, color: Color3.FromHexString("#385E76") },
  tank: { hp: 4, speed: 0.6, score: 610, coin: 3, color: Color3.FromHexString("#604138") },
  needle: { hp: 2, speed: 1.32, score: 430, coin: 2, color: Color3.FromHexString("#3B5047") },
  swarm: { hp: 1, speed: 2.02, score: 480, coin: 2, color: Color3.FromHexString("#625B33") },
};
const MOSQUITO_DAMAGE: Record<MosquitoType, number> = { small: 6, fast: 7, sturdy: 9, striped: 7, giant: 11, brood: 8, dart: 7, tank: 12, needle: 8, swarm: 6 };
const MOSQUITO_BITE_INTERVAL: Record<MosquitoType, number> = { small: 2.05, fast: 1.65, sturdy: 2.2, striped: 1.55, giant: 2.35, brood: 2.15, dart: 1.35, tank: 2.5, needle: 1.85, swarm: 1.45 };

class GameWorld {
  private readonly width = 8;
  private readonly height = 14;
  private readonly playerY = -3.45;
  private now = 0;
  private running = false;
  private paused = false;
  private placement: ItemId | null = null;
  private health = 100;
  private score = 0;
  private coins = 4;
  private combo = 0;
  private kills = 0;
  private nextSpawnAt = 1.1;
  private nextAutoAt = 0.45;
  private lastKillAt = -99;
  private mosquitoId = 0;
  private hazardId = 0;
  private coinId = 0;
  private mosquitoes: Mosquito[] = [];
  private hazards: Hazard[] = [];
  private coinsOnFloor: Coin[] = [];
  private placed: PlacedItem[] = [];
  private vfxs: Vfx[] = [];
  private beneficials: Beneficial[] = [];
  private difficulty: DifficultyId = "night";
  private skillCharge = 0;
  private skillCastUntil = 0;
  private nextBeneficialAt = 10;
  private beneficialId = 0;
  private currentThreat = 1;
  private taps = 0;
  private hits = 0;
  private damageTaken = 0;
  private coinsCollected = 0;
  private itemsPlaced = 0;
  private threatSum = 0;
  private threatSamples = 0;
  private nextMosquitoSyncAt = 0;
  private nextHazardSyncAt = 0;
  private nextKobanSyncAt = 0;
  private nextPlacedItemSyncAt = 0;
  private nextBeneficialSyncAt = 0;
  private nextHudSyncAt = 0;
  private nextBuzzAt = 0;
  private readonly telemetry = new GameplayTelemetry();
  private readonly playerRoot: TransformNode;
  private readonly callbacks: GameCallbacks;
  private readonly demo = new URLSearchParams(window.location.search).has("demo");
  private readonly inspect = new URLSearchParams(window.location.search).has("inspect");
  private readonly visualCheck = new URLSearchParams(window.location.search).has("visual-check");
  private readonly beneficialCheck = new URLSearchParams(window.location.search).has("beneficial-check");
  private readonly mosquitoTypeCheck: MosquitoType | null = (() => {
    const type = new URLSearchParams(window.location.search).get("mosquito-type-check");
    return type === "small" || type === "fast" || type === "sturdy" || type === "striped" || type === "giant" || type === "brood" || type === "dart" || type === "tank" || type === "needle" || type === "swarm" ? type : null;
  })();
  private readonly hazardCheck: HazardKind | null = (() => {
    const kind = new URLSearchParams(window.location.search).get("hazard-check");
    return kind === "egg" || kind === "larva" || kind === "needle" ? kind : null;
  })();
  private readonly gameOverPreview = new URLSearchParams(window.location.search).has("game-over-check");
  private readonly gameOverResultPreview = new URLSearchParams(window.location.search).has("game-over-result-check");
  private readonly damageDemoStage = (() => {
    const stage = new URLSearchParams(window.location.search).get("damage-demo");
    return stage === "bitten" || stage === "distressed" || stage === "gameover" ? stage : null;
  })();
  private readonly mosquitoFlowDemo = (() => {
    const params = new URLSearchParams(window.location.search);
    const stage = params.get("mosquito-flow-demo") ?? (params.has("mosquito-flow-result-demo") ? "gameover" : null);
    return stage === "bitten" || stage === "distressed" || stage === "gameover" ? stage : null;
  })();
  private readonly healthPreview = (() => {
    const value = Number(new URLSearchParams(window.location.search).get("health-check"));
    return value === 62 || value === 28 ? value : null;
  })();
  private readonly rewardPreview = new URLSearchParams(window.location.search).has("reward");
  private readonly itemPreview = new URLSearchParams(window.location.search).has("item");
  private readonly itemPreviewId: ItemId = (() => {
    const item = new URLSearchParams(window.location.search).get("item");
    return item === "cat" || item === "frog" || item === "daruma" || item === "incense" ? item : "incense";
  })();
  private readonly placementPreviewCheck: ItemId | null = (() => {
    const item = new URLSearchParams(window.location.search).get("placement-check");
    return item === "cat" || item === "frog" || item === "daruma" || item === "incense" ? item : null;
  })();
  private readonly itemPreviewHold = new URLSearchParams(window.location.search).has("item-hold");
  private readonly itemEffectCheck: ItemId | null = (() => {
    const item = new URLSearchParams(window.location.search).get("item-effect-check");
    return item === "cat" || item === "frog" || item === "daruma" || item === "incense" ? item : null;
  })();
  private readonly catLureCheck = new URLSearchParams(window.location.search).has("cat-lure-check");
  private readonly frogPreview = new URLSearchParams(window.location.search).has("frog");
  private readonly frogPreviewSlow = new URLSearchParams(window.location.search).has("frog-slow");
  private readonly frogPreviewPull = new URLSearchParams(window.location.search).has("frog-pull");
  private readonly frogCoinCheck = new URLSearchParams(window.location.search).has("frog-coin-check");
  private readonly darumaPreviewPull = new URLSearchParams(window.location.search).has("daruma-pull");
  private readonly darumaCoinCheck = new URLSearchParams(window.location.search).has("daruma-coin-check");
  private rewardPreviewComplete = false;
  private itemPreviewComplete = false;
  private frogPreviewComplete = false;
  private frogCoinCheckComplete = false;
  private gameOverPreviewComplete = false;
  private damageDemoHits = 0;
  private frogTongueNonce = 0;
  private activationNonce = 0;
  private audioContext: AudioContext | null = null;
  private buzzOscillator: OscillatorNode | null = null;
  private buzzGain: GainNode | null = null;
  private buzzFilter: BiquadFilterNode | null = null;
  private readonly kobanCollectSfx = new Audio(KOBAN_COLLECT_SFX);
  private readonly itemPlaceSfx = new Audio(ITEM_PLACE_SFX);
  private sfxVolume = clamp(Number(window.localStorage.getItem("naika-sfx-volume") ?? "1"), 0, 1);
  private readonly onAudioSettings = (event: Event) => {
    const detail = (event as CustomEvent<{ sfx?: number }>).detail;
    if (typeof detail?.sfx === "number") this.sfxVolume = clamp(detail.sfx, 0, 1);
  };

  constructor(private readonly scene: Scene, callbacks: GameCallbacks, private readonly roomLayer: Layer) {
    this.callbacks = callbacks;
    window.addEventListener("naika-audio-settings", this.onAudioSettings);
    this.playerRoot = new TransformNode("sleeping-person", scene);
    this.playerRoot.position = new Vector3(0, this.playerY, 0.15);
    // The React DOM character sprite is the sole sleeper representation. The old
    // Babylon discs are intentionally not created: they leaked as blue shapes on the title screen.
    this.playerRoot.setEnabled(false);
  }

  startRun = () => {
    this.resetRun();
    if (this.healthPreview !== null) {
      this.health = this.healthPreview;
      this.damageTaken = 100 - this.health;
    }
    if (this.mosquitoFlowDemo) {
      this.health = this.mosquitoFlowDemo === "bitten" ? 76 : this.mosquitoFlowDemo === "distressed" ? 40 : 8;
      this.damageTaken = 100 - this.health;
    }
    this.unlockAudio();
    this.running = true;
    if (this.hazardCheck) {
      this.spawnHazard(this.hazardCheck, this.hazardCheck === "needle" ? 2.9 : 0.5, this.hazardCheck === "needle" ? 2.8 : 1.8);
      this.nextSpawnAt = Number.POSITIVE_INFINITY;
    } else if (this.mosquitoTypeCheck) {
      this.spawnMosquito(this.mosquitoTypeCheck);
      this.nextSpawnAt = Number.POSITIVE_INFINITY;
    }
    if (this.visualCheck) {
      if (!this.darumaPreviewPull && !this.darumaCoinCheck) this.spawnMosquito();
      this.spawnCoin(this.darumaCoinCheck ? -1.12 : -1.25, this.darumaCoinCheck ? -0.45 : 1.55, 1);
      this.nextSpawnAt = Number.POSITIVE_INFINITY;
    } else if (this.beneficialCheck) {
      this.spawnBeneficial();
      this.nextSpawnAt = Number.POSITIVE_INFINITY;
      this.nextBeneficialAt = Number.POSITIVE_INFINITY;
    } else if (this.gameOverPreview || this.gameOverResultPreview || this.damageDemoStage || this.mosquitoFlowDemo) {
      if (!this.darumaPreviewPull && !this.darumaCoinCheck) this.spawnMosquito();
      this.spawnCoin(this.darumaCoinCheck ? -1.12 : -1.25, this.darumaCoinCheck ? -0.45 : 1.55, 1);
      this.nextSpawnAt = Number.POSITIVE_INFINITY;
    }
    if (this.placementPreviewCheck) this.placement = this.placementPreviewCheck;
    if (this.frogCoinCheck) this.nextSpawnAt = Number.POSITIVE_INFINITY;
    this.telemetry.start(this.difficulty);
    this.callbacks.onPhase("playing");
    this.emitMosquitoViews(true);
    this.emitSkill(true);
    this.emitHud(`${DIFFICULTY_PROFILES[this.difficulty].label}。蚊を落として、寝息を守ろう`);
    if (this.damageDemoStage) {
      this.runDamageDemo(true);
      if (!this.running) return;
    }
    if (this.mosquitoFlowDemo) this.startMosquitoFlowDemo();
  };

  setDifficulty = (difficulty: DifficultyId) => {
    if (this.running) return;
    this.difficulty = difficulty;
    this.roomLayer.texture?.dispose();
    this.roomLayer.texture = this.createOrientedBackgroundTexture(STAGE_PRESENTATIONS[difficulty].background);
    this.emitSkill(true);
    this.emitHud(`${DIFFICULTY_PROFILES[difficulty].label}を選択`);
  };

  retry = () => this.startRun();

  setPaused = (paused: boolean) => {
    if (!this.running) return;
    this.paused = paused;
    if (paused) this.stopMosquitoBuzz();
  };

  activateSkill = () => {
    if (!this.running || this.paused || this.skillCharge < 1 || this.skillCastUntil > this.now) return;
    this.skillCharge = 0;
    this.skillCastUntil = this.now + 0.92;
    const stage = STAGE_PRESENTATIONS[this.difficulty];
    this.playStageSkillSound(stage.skillMotif);
    for (const mosquito of this.mosquitoes.filter((entry) => entry.state !== "falling")) this.killMosquito(mosquito, false, "skill");
    this.callbacks.onSkill({ charge: this.skillCharge, motif: stage.skillMotif, ready: false, casting: true });
    window.setTimeout(() => this.emitSkill(true), 940);
    this.emitHud(`${stage.skillLabel}！ 蚊を挟み撃ちにした`);
  };

  abandonRun = () => {
    if (!this.running) return;
    this.running = false;
    this.paused = false;
    this.placement = null;
    this.callbacks.onPhase("title");
  };

  update(delta: number) {
    const safeDelta = Math.min(delta, 0.05);
    if (!this.running || this.paused) return;
    this.now += safeDelta;
    this.skillCharge = Math.min(1, this.skillCharge + safeDelta / 60);
    this.currentThreat = getAdaptiveThreat(this.health, this.hits / Math.max(1, this.taps), this.now);
    this.threatSum += this.currentThreat;
    this.threatSamples += 1;
    if (this.frogPreview && !this.frogPreviewComplete && this.now > 0.2) {
      const frog = this.placed.find((item) => item.id === "frog");
      const target = this.mosquitoes.find((entry) => entry.state !== "falling");
      if (frog && target) {
        target.x = frog.x + 1.05;
        target.y = frog.y + 0.05;
        target.mesh.position.set(target.x, target.y, 0.45);
        frog.nextActionAt = this.now;
        this.frogPreviewComplete = true;
      }
    }
    this.updateItems();
    this.emitPlacedItemViews();
    if (this.now >= this.nextSpawnAt) this.spawnMosquito();
    if (this.now >= this.nextBeneficialAt) this.spawnBeneficial();
    this.updateHazards(safeDelta);
    this.updateMosquitoes(safeDelta);
    this.updateBeneficials(safeDelta);
    this.emitMosquitoViews();
    this.updateMosquitoBuzz();
    this.updateCoins(safeDelta);
    this.emitKobanViews();
    this.updateVfx();
    if (this.itemPreview && !this.itemPreviewComplete && this.now > 0.12) {
      this.itemPreviewComplete = true;
      this.placeItem(this.frogPreview ? "frog" : this.itemPreviewId, -1.55, -0.45);
    }
    if (this.frogCoinCheck && !this.frogCoinCheckComplete && this.now > 0.18) {
      this.frogCoinCheckComplete = true;
      this.spawnCoin(-1.12, -0.45, 1);
    }
    if ((this.gameOverPreview || this.gameOverResultPreview) && !this.gameOverPreviewComplete && this.now > 0.55) {
      this.gameOverPreviewComplete = true;
      this.health = 0;
      this.damageTaken += 100;
      this.endRun();
      return;
    }
    if (this.rewardPreview && !this.rewardPreviewComplete && this.now > 0.35) {
      const target = this.mosquitoes.find((entry) => entry.state !== "falling");
      if (target) {
        this.rewardPreviewComplete = true;
        this.hitMosquito(target);
      }
    }
    if (this.demo && !this.inspect && this.now >= this.nextAutoAt) this.runDemo();
    this.emitHud();
    this.emitSkill();
  }

  handleTap = (x: number, y: number) => {
    this.unlockAudio();
    if (!this.running) return;
    this.taps += 1;
    if (this.placement) {
      this.placeItem(this.placement, x, y);
      return;
    }

    const coin = this.coinsOnFloor
      .filter((entry) => distance(x, y, entry.x, entry.y) < 0.42)
      .sort((a, b) => a.bornAt - b.bornAt)[0];
    if (coin) {
      this.collectCoin(coin);
      return;
    }

    const beneficial = this.beneficials
      .filter((entry) => distance(entry.x, entry.y, x, y) < 0.52)
      .sort((a, b) => distance(a.x, a.y, x, y) - distance(b.x, b.y, x, y))[0];
    if (beneficial) {
      this.captureBeneficial(beneficial);
      return;
    }

    const hazard = this.hazards
      .filter((entry) => distance(entry.x, entry.y, x, y) < (entry.kind === "needle" ? 0.42 : 0.48))
      .sort((a, b) => distance(a.x, a.y, x, y) - distance(b.x, b.y, x, y))[0];
    if (hazard) {
      this.spawnVfx("tap", hazard.x, hazard.y, 0.64);
      this.telemetry.track("tap_hit", { type: `hazard-${hazard.kind}`, hpRemaining: 0 });
      this.removeHazard(hazard, hazard.kind === "needle" ? "針を壊した。小判は出ない" : hazard.kind === "egg" ? "卵を割った。孵化を防いだ" : "幼虫を退けた。小判は出ない");
      this.playTone(560, 0.045, "square", 0.04);
      return;
    }

    const mosquito = this.mosquitoes
      .filter((entry) => entry.state !== "falling" && distance(entry.x, entry.y, x, y) < 0.45)
      .sort((a, b) => distance(a.x, a.y, 0, this.playerY) - distance(b.x, b.y, 0, this.playerY))[0];
    if (mosquito) this.hitMosquito(mosquito);
    else this.playTone(140, 0.035, "sine", 0.025);
  };

  cancelPlacement = () => {
    if (!this.running || !this.placement) return;
    this.placement = null;
    this.emitHud("設置選択を解除");
  };

  purchase = (item: ItemId) => {
    if (!this.running || this.placement) return;
    const info = ITEM_INFO[item];
    if (this.coins < info.price) {
      this.emitHud(`${info.label}にはあと${info.price - this.coins}枚必要`);
      this.playTone(140, 0.06, "sine", 0.025);
      return;
    }
    if (this.placed.some((entry) => entry.id === item)) {
      this.emitHud(`${info.label}は今、畳にある`);
      return;
    }
    this.coins -= info.price;
    this.placement = item;
    this.emitHud(`${info.label}を選択。畳をタップして置く`);
    this.playTone(520, 0.07, "triangle", 0.06);
  };

  dispose = () => {
    window.removeEventListener("naika-audio-settings", this.onAudioSettings);
    this.mosquitoes.forEach((entry) => entry.mesh.dispose());
    this.hazards.forEach((entry) => entry.mesh.dispose());
    this.coinsOnFloor.forEach((entry) => entry.mesh.dispose());
    this.placed.forEach((entry) => entry.mesh.dispose());
    this.vfxs.forEach((entry) => entry.mesh.dispose());
    this.stopMosquitoBuzz();
    this.audioContext?.close().catch(() => undefined);
    this.audioContext = null;
    this.playerRoot.dispose(false, true);
  };

  private resetRun() {
    this.mosquitoes.forEach((entry) => entry.mesh.dispose());
    this.hazards.forEach((entry) => entry.mesh.dispose());
    this.coinsOnFloor.forEach((entry) => entry.mesh.dispose());
    this.placed.forEach((entry) => entry.mesh.dispose());
    this.vfxs.forEach((entry) => entry.mesh.dispose());
    this.mosquitoes = [];
    this.hazards = [];
    this.coinsOnFloor = [];
    this.placed = [];
    this.vfxs = [];
    this.beneficials = [];
    this.now = 0;
    this.paused = false;
    this.health = 100;
    this.score = 0;
    this.coins = 4;
    this.combo = 0;
    this.kills = 0;
    this.nextSpawnAt = this.demo ? 0 : 0.9;
    this.nextAutoAt = 0.45;
    this.placement = null;
    this.taps = 0;
    this.hits = 0;
    this.damageTaken = 0;
    this.coinsCollected = 0;
    this.itemsPlaced = 0;
    this.threatSum = 0;
    this.threatSamples = 0;
    this.currentThreat = 1;
    this.nextMosquitoSyncAt = 0;
    this.nextHazardSyncAt = 0;
    this.nextKobanSyncAt = 0;
    this.nextPlacedItemSyncAt = 0;
    this.nextBeneficialSyncAt = 0;
    this.nextHudSyncAt = 0;
    this.nextBuzzAt = 0;
    this.nextBeneficialAt = this.getBeneficialInterval();
    this.skillCharge = 0;
    this.skillCastUntil = 0;
    this.rewardPreviewComplete = false;
    this.itemPreviewComplete = false;
    this.frogPreviewComplete = false;
    this.frogCoinCheckComplete = false;
    this.gameOverPreviewComplete = false;
    this.damageDemoHits = 0;
    this.callbacks.onMosquitoes([]);
    this.callbacks.onHazards([]);
    this.callbacks.onKobans([]);
    this.callbacks.onPlacedItems([]);
    this.callbacks.onFrogTongue(null);
    this.callbacks.onBeneficials([]);
    this.playerRoot.scaling.setAll(1);
  }

  private spawnMosquito(forcedType?: MosquitoType, bypassCap = false) {
    const wave = getMosquitoWave({ difficulty: this.difficulty, elapsed: this.now, threat: this.currentThreat });
    const type = forcedType ?? this.mosquitoTypeCheck ?? chooseMosquitoType(wave, this.random());
    this.nextSpawnAt = this.now + wave.spawnInterval;
    const activeCount = this.mosquitoes.filter((entry) => entry.state !== "falling").length;
    if (!bypassCap && activeCount >= wave.activeCap) return;
    const info = MOSQUITO_INFO[type];
    const x = -3.35 + this.random() * 6.7;
    const y = 3.45 + this.random() * 0.65;
    const root = new TransformNode(`mosquito-${this.mosquitoId}`, this.scene);
    root.position = new Vector3(x, y, 0.62);
    // 敵の見た目はDOMスプライトだけが担当する。非表示Babylonスプライトを
    // 作らないことで、高密度時のメッシュ更新・マテリアル負荷を避ける。
    root.setEnabled(false);
    this.mosquitoes.push({ id: this.mosquitoId++, type, hp: info.hp, state: "approaching", x, y, vx: 0, vy: 0, speed: info.speed, biteAt: 0, fallingFor: 0, capturedFor: 0, captureOriginX: x, captureOriginY: y, captureTargetX: x, captureTargetY: y, nextSpecialAt: this.now + (type === "brood" ? 0.9 : type === "needle" ? 1.1 : Number.POSITIVE_INFINITY), mesh: root });
    if (type === "swarm" && !forcedType) {
      this.spawnMosquito("small");
    }
    this.emitMosquitoViews(true);
    this.telemetry.track("enemy_spawned", { type, wave: wave.index, threat: Number(this.currentThreat.toFixed(2)), difficulty: this.difficulty });
  }

  private spawnHazard(kind: HazardKind, x: number, y: number) {
    if (!this.hazardCheck && this.hazards.length >= 4) return;
    const root = new TransformNode(`hazard-${kind}-${this.hazardId}`, this.scene);
    root.setEnabled(false);
    const targetY = this.playerY + 0.25;
    const length = Math.max(0.001, Math.hypot(-x, targetY - y));
    const speed = this.hazardCheck === kind ? 0 : kind === "needle" ? 3.75 : kind === "larva" ? 2.5 : 0;
    const vx = kind === "egg" ? 0 : (-x / length) * speed;
    const vy = kind === "egg" ? 0 : ((targetY - y) / length) * speed;
    this.hazards.push({ id: this.hazardId++, kind, x, y, vx, vy, bornAt: this.now, hatchAt: this.hazardCheck === kind ? Number.POSITIVE_INFINITY : this.now + 1, angle: Math.atan2(vy, vx), mesh: root });
    this.emitHazardViews(true);
    this.telemetry.track("enemy_spawned", { type: `hazard-${kind}`, wave: -1, threat: Number(this.currentThreat.toFixed(2)), difficulty: this.difficulty });
  }

  private removeHazard(hazard: Hazard, notice?: string) {
    hazard.mesh.dispose();
    this.hazards = this.hazards.filter((entry) => entry !== hazard);
    this.emitHazardViews(true);
    if (notice) this.emitHud(notice);
  }

  private spawnBeneficial() {
    const stage = STAGE_PRESENTATIONS[this.difficulty];
    const interval = this.getBeneficialInterval();
    this.nextBeneficialAt = this.now + interval;
    const type = stage.beneficial;
    const beneficial: Beneficial = {
      id: this.beneficialId++,
      type,
      x: -3.4 + this.random() * 6.8,
      y: 2.2 + this.random() * 1.8,
      vx: (this.random() > 0.5 ? 1 : -1) * (type === "cicada" ? 0.82 : 0.5),
      bornAt: this.now,
      drift: this.random() * Math.PI * 2,
    };
    this.beneficials.push(beneficial);
    if (type === "cicada") this.playCicadaChirp();
    else if (type === "dragonfly") this.playTone(760, 0.16, "triangle", 0.028);
    else this.playTone(260, 0.2, "sine", 0.026);
    this.emitBeneficialViews(true);
    this.emitHud(`${stage.beneficialLabel}が飛んできた。タップで技が早く溜まる`);
  }

  private getBeneficialInterval() {
    return getBeneficialSpawnInterval({ difficulty: this.difficulty, elapsed: this.now, threat: this.currentThreat, random: this.random() });
  }

  private getUiSyncInterval() {
    const entityPressure = this.mosquitoes.filter((entry) => entry.state !== "falling").length + this.hazards.length + Math.min(this.coinsOnFloor.length, 4);
    if (entityPressure >= 10) return 0.2;
    if (entityPressure >= 6) return 0.14;
    return 0.1;
  }

  private updateBeneficials(delta: number) {
    for (const beneficial of [...this.beneficials]) {
      const age = this.now - beneficial.bornAt;
      beneficial.x += beneficial.vx * delta;
      const flutter = beneficial.type === "cicada" ? 7 : beneficial.type === "dragonfly" ? 5.5 : 3.2;
      beneficial.y += Math.sin(this.now * flutter + beneficial.drift) * delta * 0.42;
      if (age > 7 || beneficial.x < -4.3 || beneficial.x > 4.3) this.beneficials = this.beneficials.filter((entry) => entry !== beneficial);
    }
    this.emitBeneficialViews();
  }

  private captureBeneficial(beneficial: Beneficial) {
    if (!this.beneficials.includes(beneficial)) return;
    this.beneficials = this.beneficials.filter((entry) => entry !== beneficial);
    const captureCharge = BENEFICIAL_CAPTURE_CHARGE[beneficial.type];
    this.skillCharge = Math.min(1, this.skillCharge + captureCharge);
    this.playTone(beneficial.type === "cicada" ? 780 : beneficial.type === "dragonfly" ? 940 : 520, 0.16, "sine", 0.05);
    this.emitBeneficialViews(true);
    this.emitSkill(true);
    this.emitHud(`${STAGE_PRESENTATIONS[this.difficulty].beneficialLabel}を見つけた。技の気配が高まる`);
  }

  private emitBeneficialViews(force = false) {
    if (!force && this.now < this.nextBeneficialSyncAt) return;
    this.nextBeneficialSyncAt = this.now + this.getUiSyncInterval();
    this.callbacks.onBeneficials(this.beneficials.map(({ id, type, x, y, drift }) => ({ id, type, x, y, drift })));
  }

  private emitSkill(force = false) {
    if (!force && Math.floor(this.now * 10) % 2 !== 0) return;
    const stage = STAGE_PRESENTATIONS[this.difficulty];
    this.callbacks.onSkill({ charge: this.skillCharge, motif: stage.skillMotif, ready: this.skillCharge >= 1, casting: this.skillCastUntil > this.now });
  }

  private updateMosquitoes(delta: number) {
    for (const mosquito of [...this.mosquitoes]) {
      if (mosquito.state === "falling") {
        mosquito.fallingFor += delta;
        mosquito.y -= 4.6 * delta;
        if (mosquito.fallingFor > 0.28) {
          mosquito.mesh.dispose();
          this.mosquitoes = this.mosquitoes.filter((entry) => entry !== mosquito);
        }
        continue;
      }
      if (mosquito.state === "captured") {
        mosquito.capturedFor += delta;
        if (mosquito.capturedFor < 0) continue;
        const progress = Math.min(1, mosquito.capturedFor / 0.36);
        const eased = 1 - Math.pow(1 - progress, 3);
        mosquito.x = mosquito.captureOriginX + (mosquito.captureTargetX - mosquito.captureOriginX) * eased;
        mosquito.y = mosquito.captureOriginY + (mosquito.captureTargetY - mosquito.captureOriginY) * eased;
        if (progress >= 1) this.killMosquito(mosquito, false);
        continue;
      }
      if (mosquito.state === "approaching" && mosquito.type === "brood" && this.now >= mosquito.nextSpecialAt) {
        mosquito.nextSpecialAt = this.now + 3.4;
        this.spawnHazard("egg", mosquito.x, mosquito.y + 0.05);
        this.emitHud("産卵蚊が卵を落とした。1秒以内に割れ！");
      }
      if (mosquito.state === "approaching" && mosquito.type === "needle" && this.now >= mosquito.nextSpecialAt) {
        mosquito.nextSpecialAt = this.now + 2.25;
        this.spawnHazard("needle", mosquito.x, mosquito.y);
      }
      const cat = this.placed.find((item) => item.id === "cat" && (this.itemPreviewHold || this.now - item.bornAt < (ITEM_RUNTIME.cat.duration ?? 0)));
      const targetX = cat && mosquito.state !== "feeding" ? cat.x : 0;
      const targetY = cat && mosquito.state !== "feeding" ? cat.y : this.playerY + 0.25;
      const targetDistance = distance(mosquito.x, mosquito.y, targetX, targetY);
      if (!cat && targetDistance < 0.62) {
        mosquito.state = "feeding";
        if (!mosquito.biteAt) mosquito.biteAt = this.now + 1.1;
      }
      if (this.mosquitoFlowDemo && mosquito.state === "feeding") mosquito.biteAt = Math.min(mosquito.biteAt, this.now);
      if (mosquito.state === "feeding") {
        if (this.now >= mosquito.biteAt) {
          mosquito.biteAt = this.now + MOSQUITO_BITE_INTERVAL[mosquito.type];
          this.bitePlayer(MOSQUITO_DAMAGE[mosquito.type]);
          if (this.mosquitoFlowDemo) {
            mosquito.state = "falling";
            mosquito.fallingFor = 0;
            this.nextSpawnAt = Number.POSITIVE_INFINITY;
          }
        }
      } else {
        const dx = targetX - mosquito.x;
        const dy = targetY - mosquito.y;
        const len = Math.max(0.001, Math.hypot(dx, dy));
        const wiggle = Math.sin(this.now * 12 + mosquito.id * 3) * 0.18;
        const desiredVx = dx / len * mosquito.speed + wiggle;
        const desiredVy = dy / len * mosquito.speed;
        const steering = Math.min(1, delta * 9.5);
        mosquito.vx += (desiredVx - mosquito.vx) * steering;
        mosquito.vy += (desiredVy - mosquito.vy) * steering;
        mosquito.x += mosquito.vx * delta;
        mosquito.y += mosquito.vy * delta;
      }
    }
  }

  private updateHazards(delta: number) {
    for (const hazard of [...this.hazards]) {
      if (hazard.kind === "egg") {
        if (this.now >= hazard.hatchAt) {
          const x = hazard.x;
          const y = hazard.y;
          this.removeHazard(hazard);
          this.spawnHazard("larva", x, y);
          this.emitHud("卵が孵化した！ 幼虫が人へ向かう");
        }
        continue;
      }
      hazard.x += hazard.vx * delta;
      hazard.y += hazard.vy * delta;
      hazard.angle = Math.atan2(hazard.vy, hazard.vx);
      if (hazard.y <= this.playerY + 0.18 || Math.abs(hazard.x) > 4.5 || hazard.y < -4.2) {
        this.bitePlayer(hazard.kind === "needle" ? 8 : 6);
        this.removeHazard(hazard, hazard.kind === "needle" ? "針が寝息を刺した" : "幼虫が人へ飛びついた");
      }
    }
    this.emitHazardViews();
  }

  private updateItems() {
    for (const item of [...this.placed]) {
      const age = this.now - item.bornAt;
      const outer = item.mesh.getChildMeshes()[0];
      if (item.id === "incense") {
        item.mesh.scaling.setAll(Math.max(0.72, 1 - age / 64));
        if (age > 15 && !this.itemPreviewHold) this.removeItem(item, "線香の煙が消えた");
        const targets = this.mosquitoes.filter((mosquito) => mosquito.state !== "falling" && distance(item.x, item.y, mosquito.x, mosquito.y) < ITEM_RUNTIME.incense.range);
        if (targets.length) {
          item.nextActionAt = this.now + 0.72;
          this.emitItemActivation(item, "trigger");
        }
        for (const mosquito of targets) this.killMosquito(mosquito, false);
      }
      if (item.id === "cat") {
        item.mesh.rotation.z = Math.sin(this.now * 10) * 0.08;
        if (age > (ITEM_RUNTIME.cat.duration ?? 0) && !this.itemPreviewHold) this.removeItem(item, "招き猫はひと休み");
        else if (age > 8 && outer) outer.visibility = 0.5;
        const lured = this.mosquitoes.some((mosquito) => mosquito.state !== "falling" && distance(item.x, item.y, mosquito.x, mosquito.y) < ITEM_RUNTIME.cat.range);
        if (lured && this.now >= item.nextActionAt) {
          item.nextActionAt = this.now + 1.2;
          this.emitItemActivation(item, "trigger");
        }
      }
      if (item.id === "frog") {
        if (age > (ITEM_RUNTIME.frog.duration ?? 0) && !this.frogCoinCheck) this.removeItem(item, "カエルは水辺へ帰った");
        else {
          if (this.now >= item.nextCollectAt) {
            item.nextCollectAt = this.now + 0.22;
            const coin = this.coinsOnFloor
              .filter((entry) => distance(item.x, item.y, entry.x, entry.y) < ITEM_RUNTIME.frog.range)
              .sort((a, b) => distance(a.x, a.y, item.x, item.y) - distance(b.x, b.y, item.x, item.y))[0];
            if (coin) this.collectCoin(coin, "カエルが小判を飲み込んだ +1");
          }
          if (this.now < item.nextActionAt) continue;
          const target = this.mosquitoes
            .filter((mosquito) => (mosquito.state === "approaching" || mosquito.state === "feeding") && distance(item.x, item.y, mosquito.x, mosquito.y) < ITEM_RUNTIME.frog.range)
            .sort((a, b) => distance(a.x, a.y, item.x, item.y) - distance(b.x, b.y, item.x, item.y))[0];
          if (target) {
            item.nextActionAt = this.now + FROG_CAPTURE_INTERVAL;
            this.emitItemActivation(item, "trigger");
            const tongue = { itemX: item.x, itemY: item.y, targetX: target.x, targetY: target.y, nonce: this.frogTongueNonce++, phase: "aim" as const };
            const dx = target.x - item.x;
            const dy = target.y - item.y;
            const length = Math.max(0.001, Math.hypot(dx, dy));
            target.state = "captured";
            target.capturedFor = this.frogPreviewSlow || this.frogPreviewPull ? -60 : -0.12;
            target.captureOriginX = target.x;
            target.captureOriginY = target.y;
            target.captureTargetX = item.x + (dx / length) * 0.25;
            target.captureTargetY = item.y + (dy / length) * 0.25;
            this.callbacks.onFrogTongue(tongue);
            const tongueDelay = this.frogPreviewPull ? 0 : this.frogPreviewSlow ? 10000 : FROG_TONGUE_DELAY_MS;
            window.setTimeout(() => this.callbacks.onFrogTongue({ ...tongue, phase: "pull" }), tongueDelay);
            window.setTimeout(() => this.callbacks.onFrogTongue(null), this.frogPreviewPull ? 60000 : FROG_TONGUE_CYCLE_MS);
            item.mesh.scaling.set(0.84, 1.26, 1);
            item.mesh.rotation.z = Math.atan2(dy, dx) * 0.1;
            window.setTimeout(() => {
              item.mesh.scaling.setAll(1);
              item.mesh.rotation.z = 0;
            }, FROG_TONGUE_CYCLE_MS);
          }
        }
      }
      if (item.id === "daruma") {
        const travel = age * 0.92 + item.originX * 0.6 - item.originY * 0.35;
        item.x = clamp(item.originX + Math.sin(travel * 1.17) * 1.12, -3.1, 3.1);
        item.y = clamp(item.originY + Math.cos(travel * 0.83) * 0.86, -2.4, 3.85);
        item.mesh.position.set(item.x, item.y, 0.35);
        item.mesh.rotation.z = Math.sin(this.now * 8) * 0.08;
        if (age > (ITEM_RUNTIME.daruma.duration ?? 0) && !this.itemPreviewHold) this.removeItem(item, "ダルマは回収を終えた");
        if (this.now >= item.nextActionAt) {
          item.nextActionAt = this.now + 0.16;
          const coin = this.coinsOnFloor
            .filter((entry) => !entry.attractItemKey && distance(item.x, item.y, entry.x, entry.y) < ITEM_RUNTIME.daruma.range)
            .sort((a, b) => distance(item.x, item.y, a.x, a.y) - distance(item.x, item.y, b.x, b.y))[0];
          if (coin) {
            coin.attractItemKey = item.mesh.name;
            coin.attractNotice = "ダルマが小判を吸い寄せた +1";
            this.emitItemActivation(item, "trigger");
          }
        }
      }
    }
  }

  private emitMosquitoViews(force = false) {
    if (!force && this.now < this.nextMosquitoSyncAt) return;
    this.nextMosquitoSyncAt = this.now + this.getUiSyncInterval();
    this.callbacks.onMosquitoes(this.mosquitoes
      .filter((entry) => entry.state !== "falling")
      .map(({ id, type, x, y, vx }) => ({ id, type, x, y, bank: Math.max(-18, Math.min(18, -vx * 18)), scale: type === "giant" || type === "tank" ? 1.22 : type === "sturdy" || type === "brood" ? 1.16 : type === "fast" || type === "dart" ? 0.9 : 1 })));
  }

  private emitHazardViews(force = false) {
    if (!force && this.now < this.nextHazardSyncAt) return;
    this.nextHazardSyncAt = this.now + this.getUiSyncInterval();
    this.callbacks.onHazards(this.hazards.map(({ id, kind, x, y, angle }) => ({ id, kind, x, y, angle, scale: kind === "egg" ? 0.8 : kind === "needle" ? 0.75 : 0.9 })));
  }

  private emitKobanViews(force = false) {
    if (!force && this.now < this.nextKobanSyncAt) return;
    this.nextKobanSyncAt = this.now + this.getUiSyncInterval();
    this.callbacks.onKobans(this.coinsOnFloor.map(({ id, x, y }) => ({ id, x, y })));
  }

  private updateCoins(delta: number) {
    for (const coin of [...this.coinsOnFloor]) {
      const age = this.now - coin.bornAt;
      if (coin.attractItemKey) {
        const daruma = this.placed.find((item) => item.mesh.name === coin.attractItemKey);
        if (daruma) {
          coin.attractToX = daruma.x;
          coin.attractToY = daruma.y + 0.06;
        } else {
          coin.attractItemKey = undefined;
          coin.attractToX = undefined;
          coin.attractToY = undefined;
        }
      }
      if (coin.attractToX !== undefined && coin.attractToY !== undefined) {
        const dx = coin.attractToX - coin.x;
        const dy = coin.attractToY - coin.y;
        const gap = Math.hypot(dx, dy);
        const pullRate = this.darumaPreviewPull ? 0.16 : 2.4 + 2.6 / Math.max(0.35, gap);
        const pull = Math.min(1, delta * pullRate);
        coin.x += dx * pull;
        coin.y += dy * pull;
        if (gap < 0.17) {
          this.collectCoin(coin, coin.attractNotice ?? "ダルマが小判を吸い寄せた +1");
          continue;
        }
      }
      coin.mesh.position.y = coin.y + Math.sin(age * 9) * 0.08;
      coin.mesh.rotation.z += 0.08;
      if (this.visualCheck) continue;
      const warn = age > 4;
      coin.mesh.scaling.setAll(warn ? 0.88 + Math.sin(this.now * 20) * 0.12 : 1);
      if (age > 5) {
        coin.mesh.dispose();
        this.coinsOnFloor = this.coinsOnFloor.filter((entry) => entry !== coin);
        this.emitKobanViews(true);
      }
    }
  }

  private runDemo() {
    this.nextAutoAt = this.now + 0.42;
    const coin = this.coinsOnFloor[0];
    if (coin) {
      this.collectCoin(coin, "夜更けの回収 +1");
      return;
    }
    if (this.placement) {
      this.placeItem(this.placement, this.placement === "incense" ? -2.3 : 2.2, -1.2);
      return;
    }
    const ready = (Object.keys(ITEM_INFO) as ItemId[]).find((id) => this.coins >= ITEM_INFO[id].price && !this.placed.some((item) => item.id === id));
    if (ready) {
      this.purchase(ready);
      return;
    }
    const target = this.mosquitoes.find((mosquito) => mosquito.state !== "falling");
    if (target) this.hitMosquito(target);
  }

  private hitMosquito(mosquito: Mosquito) {
    mosquito.hp -= 1;
    this.hits += 1;
    this.spawnVfx("tap", mosquito.x, mosquito.y, 0.84);
    this.telemetry.track("tap_hit", { type: mosquito.type, hpRemaining: mosquito.hp });
    this.playTone(660, 0.055, "square", 0.045);
    navigator.vibrate?.(12);
    if (mosquito.hp <= 0) this.killMosquito(mosquito, true);
    else this.emitHud("しぶとい蚊。もう一度！");
  }

  private killMosquito(mosquito: Mosquito, handTap: boolean, source: "tap" | "item" | "skill" = handTap ? "tap" : "item") {
    if (mosquito.state === "falling") return;
    mosquito.state = "falling";
    mosquito.fallingFor = 0;
    this.spawnVfx("seal", mosquito.x, mosquito.y, mosquito.type === "sturdy" ? 1.35 : 1.05);
    this.spawnVfx("smoke", mosquito.x, mosquito.y - 0.1, 0.86);
    this.kills += 1;
    this.combo = this.now - this.lastKillAt <= 3 ? Math.min(20, this.combo + 1) : 1;
    this.lastKillAt = this.now;
    const info = MOSQUITO_INFO[mosquito.type];
    this.spawnCoin(mosquito.x, mosquito.y, info.coin);
    this.score += Math.round(info.score * DIFFICULTY_PROFILES[this.difficulty].rewardMultiplier * (1 + this.combo * 0.05));
    this.telemetry.track("enemy_defeated", { type: mosquito.type, source, combo: this.combo, score: this.score });
    if (source !== "skill") this.emitHud(handTap ? undefined : "道具が蚊を退けた");
  }

  private bitePlayer(damage: number) {
    const adjustedDamage = Math.round(damage * DIFFICULTY_PROFILES[this.difficulty].damageMultiplier);
    this.health = Math.max(0, this.health - adjustedDamage);
    this.damageTaken += adjustedDamage;
    this.combo = 0;
    this.spawnVfx("damage", 0, this.playerY + 0.3, 1.82);
    this.telemetry.track("damage_taken", { damage: adjustedDamage, health: this.health, difficulty: this.difficulty });
    this.playerRoot.scaling.x = Math.max(0.65, this.health / 100);
    this.playerRoot.scaling.y = 0.86 + this.health / 800;
    this.playTone(185, 0.12, "sawtooth", 0.06);
    navigator.vibrate?.([18, 24, 18]);
    this.emitHud(this.health <= 0 ? "蚊に起こされてしまった…" : "寝息が細くなっている…");
    if (this.health <= 0) this.endRun();
  }

  private runDamageDemo(immediate = false) {
    const targetHits = this.damageDemoStage === "bitten" ? 1 : this.damageDemoStage === "distressed" ? 2 : 3;
    while (this.damageDemoHits < targetHits) {
      const nextAt = 0.42 + this.damageDemoHits * 0.44;
      if (!immediate && this.now < nextAt) return;
      this.damageDemoHits += 1;
      this.bitePlayer(this.damageDemoStage === "gameover" ? 34 : 38);
      if (!this.running) return;
    }
  }

  private startMosquitoFlowDemo() {
    this.spawnMosquito();
    const mosquito = this.mosquitoes[this.mosquitoes.length - 1];
    if (!mosquito) return;
    mosquito.type = "sturdy";
    mosquito.hp = MOSQUITO_INFO.sturdy.hp;
    mosquito.speed = 18;
    mosquito.x = 0;
    mosquito.y = this.playerY + 0.76;
    mosquito.vx = 0;
    mosquito.vy = 0;
    this.nextSpawnAt = Number.POSITIVE_INFINITY;
    this.emitHud("蚊が寝息へ近づいている…");
  }

  private spawnCoin(x: number, y: number, value: number) {
    for (let index = 0; index < value; index += 1) {
      const root = new TransformNode(`coin-${this.coinId}`, this.scene);
      const coin = this.makeDisc(`coin-disc-${this.coinId}`, 0.16, Color3.FromHexString("#F6A33A"));
      coin.parent = root;
      // The DOM small-koban asset is the only intended visual; the canvas disc
      // would otherwise appear underneath as a false drop shadow.
      root.setEnabled(false);
      root.position = new Vector3(x + (index ? 0.24 : -0.08), y - 0.18, 0.52);
      this.coinsOnFloor.push({ id: this.coinId++, x: root.position.x, y: root.position.y, bornAt: this.now, mesh: root });
    }
    this.emitKobanViews(true);
  }

  private collectCoin(coin: Coin, notice?: string) {
    if (!this.coinsOnFloor.includes(coin)) return;
    this.coins += 1;
    this.coinsCollected += 1;
    coin.mesh.dispose();
    this.coinsOnFloor = this.coinsOnFloor.filter((entry) => entry !== coin);
    this.emitKobanViews(true);
    this.playInteractionSfx(this.kobanCollectSfx, 0.48, 0, 2, null);
    this.telemetry.track("coin_collected", { coins: this.coins, source: notice?.includes("ダルマ") ? "daruma" : "tap" });
    this.emitHud(notice);
  }

  private placeItem(id: ItemId, x: number, y: number) {
    const safeX = clamp(x, -3.1, 3.1);
    const safeY = clamp(y, -2.4, 3.85);
    const root = new TransformNode(`item-${id}-${this.placed.length}`, this.scene);
    root.position = new Vector3(safeX, safeY, 0.35);
    const color = ITEM_INFO[id].color;
    const base = this.makeAtlasSprite(`item-${id}-sprite`, ITEM_CELL[id], id === "frog" ? 0.92 : 0.78);
    base.parent = root;
    const glow = this.makeDisc(`item-${id}-glow`, id === "frog" ? 0.46 : 0.37, color, 0.16);
    glow.parent = root;
    glow.position.z = -0.02;
    if (id === "incense") {
      const ember = this.makeDisc("incense-ember", 0.1, Color3.FromHexString("#F6A33A"));
      ember.parent = root;
      ember.position.y = 0.2;
      const smoke = this.makeDisc("incense-smoke", 0.72, Color3.FromHexString("#F2EBDD"), 0.22);
      smoke.parent = root;
      smoke.position.y = 0.7;
    } else if (id === "cat") {
      const paw = this.makeDisc("cat-paw", 0.12, Color3.FromHexString("#CC5C4C"));
      paw.parent = root;
      paw.position.set(0.22, 0.34, 0.02);
    } else if (id === "frog") {
      const eyeL = this.makeDisc("frog-eye-l", 0.1, Color3.FromHexString("#F2EBDD"));
      eyeL.parent = root;
      eyeL.position.set(-0.18, 0.2, 0.02);
      const eyeR = eyeL.clone("frog-eye-r")!;
      eyeR.position.x = 0.18;
      eyeR.parent = root;
    } else {
      const eye = this.makeDisc("daruma-eye", 0.08, Color3.FromHexString("#F2EBDD"));
      eye.parent = root;
      eye.position.set(-0.12, 0.05, 0.02);
      const eyeR = eye.clone("daruma-eye-r")!;
      eyeR.position.x = 0.12;
      eyeR.parent = root;
    }
    // 設置アイテムの見た目はDOMオーバーレイのみを使用する。Babylon側の
    // スプライト・グロー・補助ディスクは背後で白い円盤に見えるため描画しない。
    root.setEnabled(false);
    this.placed.push({ id, x: safeX, y: safeY, originX: safeX, originY: safeY, bornAt: this.now, mesh: root, nextActionAt: this.now + 0.5, nextCollectAt: this.now + 0.12 });
    if ((id === "cat" && this.catLureCheck) || this.itemEffectCheck === id) {
      const target = this.mosquitoes.find((mosquito) => mosquito.state !== "falling");
      if (target && id !== "daruma") {
        target.x = safeX + 1.05;
        target.y = safeY + 0.08;
      }
      if (id === "daruma") this.spawnCoin(safeX + 0.42, safeY + 0.08, 1);
    }
    this.emitPlacedItemViews(true);
    this.emitItemActivation(this.placed[this.placed.length - 1], "placed");
    this.placement = null;
    this.itemsPlaced += 1;
    this.playInteractionSfx(this.itemPlaceSfx, 0.42);
    this.telemetry.track("item_placed", { item: id, x: Number(safeX.toFixed(1)), y: Number(safeY.toFixed(1)) });
    this.emitHud(`${ITEM_INFO[id].label}を置いた`);
  }

  private removeItem(item: PlacedItem, notice: string) {
    item.mesh.dispose();
    this.placed = this.placed.filter((entry) => entry !== item);
    this.emitPlacedItemViews(true);
    this.emitHud(notice);
  }

  private emitPlacedItemViews(force = false) {
    if (!force && this.now < this.nextPlacedItemSyncAt) return;
    this.nextPlacedItemSyncAt = this.now + 0.16;
    this.callbacks.onPlacedItems(this.placed.map(({ id, x, y, bornAt, mesh }) => {
      const runtime = ITEM_RUNTIME[id];
      const remaining = runtime.duration === null ? null : Math.max(0, runtime.duration - (this.now - bornAt));
      return { key: mesh.name, id, x, y, range: runtime.range, duration: runtime.duration, remaining, tone: runtime.tone, underlayDisabled: !mesh.isEnabled() };
    }));
  }

  private emitItemActivation(item: PlacedItem, kind: ItemActivationView["kind"]) {
    this.callbacks.onItemActivation({
      key: `item-activation-${this.activationNonce++}`,
      item: item.id,
      x: item.x,
      y: item.y,
      tone: ITEM_RUNTIME[item.id].tone,
      kind,
    });
  }

  private endRun() {
    this.running = false;
    this.placement = null;
    const previous = Number(localStorage.getItem("naika-high-score") ?? "0");
    const best = Math.max(previous, this.score);
    const analytics: RunAnalytics = {
      runId: "local",
      difficulty: this.difficulty,
      score: this.score,
      duration: Math.round(this.now),
      kills: this.kills,
      hitRate: Number((this.hits / Math.max(1, this.taps)).toFixed(2)),
      damageTaken: this.damageTaken,
      coinsCollected: this.coinsCollected,
      itemsPlaced: this.itemsPlaced,
      averageThreat: Number((this.threatSum / Math.max(1, this.threatSamples)).toFixed(2)),
    };
    this.telemetry.finish(analytics);
    localStorage.setItem("naika-high-score", String(best));
    this.callbacks.onResult({ score: this.score, best, kills: this.kills, duration: Math.round(this.now), analytics });
    this.callbacks.onPhase("result");
  }

  private emitHud(notice?: string) {
    if (!notice && this.now < this.nextHudSyncAt) return;
    this.nextHudSyncAt = this.now + this.getUiSyncInterval();
    const active = (id: ItemId) => this.placed.some((entry) => entry.id === id);
    this.callbacks.onHud({
      health: this.health,
      score: this.score,
      coins: this.coins,
      combo: this.combo,
      elapsed: this.now,
      placement: this.placement,
      notice: notice ?? "",
      items: {
        incense: { price: 6, active: active("incense") },
        cat: { price: 8, active: active("cat"), cooldown: active("cat") ? Math.max(0, Math.ceil(20 - (this.now - this.placed.find((item) => item.id === "cat")!.bornAt))) : undefined },
        frog: { price: 14, active: active("frog") },
        daruma: { price: 10, active: active("daruma") },
      },
    });
  }

  private updateVfx() {
    for (const effect of [...this.vfxs]) {
      const progress = (this.now - effect.bornAt) / effect.duration;
      if (progress >= 1) {
        effect.mesh.dispose();
        this.vfxs = this.vfxs.filter((entry) => entry !== effect);
        continue;
      }
      effect.mesh.scaling.setAll(1 + progress * (effect.kind === "damage" ? 0.26 : 0.72));
      effect.mesh.rotation.z += (effect.kind === "tap" ? 0.11 : 0.045);
      const art = effect.mesh.getChildMeshes()[0];
      if (art?.material instanceof StandardMaterial) art.material.alpha = Math.max(0, 0.88 - progress * 0.92);
    }
  }

  private spawnVfx(kind: VfxKind, x: number, y: number, size: number) {
    const root = new TransformNode(`vfx-${kind}-${this.vfxs.length}`, this.scene);
    root.position = new Vector3(x, y, 0.78);
    const art = this.makeAtlasSprite(`vfx-${kind}-art`, VFX_CELL[kind], size);
    art.parent = root;
    this.vfxs.push({ kind, bornAt: this.now, duration: kind === "damage" ? 0.38 : 0.26, mesh: root });
  }

  private createOrientedBackgroundTexture(url: string) {
    const texture = new Texture(url, this.scene, true, false);
    texture.uScale = -1;
    texture.vScale = -1;
    texture.uOffset = 1;
    texture.vOffset = 1;
    return texture;
  }

  private makeSprite(name: string, url: string, size: number) {
    const plane = MeshBuilder.CreatePlane(name, { width: size, height: size }, this.scene);
    const material = new StandardMaterial(`${name}-material`, this.scene);
    const texture = new Texture(url, this.scene, true, false);
    texture.hasAlpha = true;
    material.diffuseTexture = texture;
    material.emissiveTexture = texture;
    material.useAlphaFromDiffuseTexture = true;
    material.alpha = 1;
    material.backFaceCulling = false;
    plane.material = material;
    return plane;
  }

  private makeMosquitoSilhouette(name: string, type: MosquitoType) {
    const root = new TransformNode(name, this.scene);
    const isHeavy = type === "sturdy" || type === "giant";
    const bodySize = type === "giant" ? 0.22 : isHeavy ? 0.18 : type === "fast" || type === "striped" ? 0.115 : 0.14;
    const body = this.makeDisc(`${name}-body`, bodySize, isHeavy ? Color3.FromHexString("#321E31") : Color3.FromHexString("#161A27"), 0.96);
    body.scaling.y = 1.26;
    body.parent = root;
    body.position.z = -0.025;
    const wingColor = Color3.FromHexString(type === "fast" || type === "striped" ? "#AFC8D6" : "#DCE6E5");
    for (const side of [-1, 1]) {
      const wing = this.makeDisc(`${name}-wing-${side}`, isHeavy ? 0.19 : 0.15, wingColor, 0.7);
      wing.scaling.set(1.2, 0.34, 1);
      wing.position.set(side * 0.16, 0.08, -0.04);
      wing.rotation.z = side * 0.38;
      wing.parent = root;
      const leg = this.makeDisc(`${name}-leg-${side}`, 0.22, Color3.FromHexString("#171A22"), 0.7);
      leg.scaling.set(1.1, 0.1, 1);
      leg.position.set(side * 0.1, -0.1, -0.05);
      leg.rotation.z = side * 0.52;
      leg.parent = root;
    }
    return root;
  }

  private makeAtlasSprite(name: string, cell: number, size: number) {
    const plane = this.makeSprite(name, cell <= 3 ? (name.startsWith("vfx-") ? VFX_ATLAS : ITEM_ATLAS) : ITEM_ATLAS, size);
    const material = plane.material as StandardMaterial;
    const texture = material.diffuseTexture as Texture;
    texture.uScale = 0.5;
    texture.vScale = 0.5;
    texture.uOffset = cell % 2 === 0 ? 0 : 0.5;
    texture.vOffset = cell < 2 ? 0.5 : 0;
    return plane;
  }

  private makeDisc(name: string, radius: number, color: Color3, alpha = 1) {
    const disc = MeshBuilder.CreateDisc(name, { radius, tessellation: 32 }, this.scene);
    disc.material = this.material(`${name}-material`, color, alpha);
    return disc;
  }

  private material(name: string, color: Color3, alpha = 1) {
    const material = new StandardMaterial(name, this.scene);
    material.diffuseColor = color;
    material.emissiveColor = color.scale(0.18);
    material.alpha = alpha;
    material.backFaceCulling = false;
    return material;
  }

  private random() {
    return this.demo ? seededRandom(Math.floor(this.now * 100 + this.mosquitoId * 17)) : Math.random();
  }

  private unlockAudio() {
    const context = this.getAudioContext();
    if (!context) return;
    context.resume().catch(() => undefined);
    this.startMosquitoBuzz(context);
  }

  private playTone(frequency: number, duration: number, type: OscillatorType, volume: number, startAfter = 0) {
    const context = this.getAudioContext();
    if (!context) return;
    try {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = type;
      oscillator.frequency.value = frequency;
      const startAt = context.currentTime + startAfter;
      gain.gain.setValueAtTime(volume * this.sfxVolume, startAt);
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(startAt);
      oscillator.stop(startAt + duration);
    } catch { /* Audio is enhancement only. */ }
  }

  private playNoiseSweep(duration: number, startFrequency: number, endFrequency: number, volume: number, startAfter = 0) {
    const context = this.getAudioContext();
    if (!context) return;
    try {
      const startAt = context.currentTime + startAfter;
      const buffer = context.createBuffer(1, Math.max(1, Math.floor(context.sampleRate * duration)), context.sampleRate);
      const samples = buffer.getChannelData(0);
      for (let index = 0; index < samples.length; index += 1) samples[index] = Math.random() * 2 - 1;
      const source = context.createBufferSource();
      const filter = context.createBiquadFilter();
      const gain = context.createGain();
      source.buffer = buffer;
      filter.type = "bandpass";
      filter.Q.value = 0.8;
      filter.frequency.setValueAtTime(startFrequency, startAt);
      filter.frequency.exponentialRampToValueAtTime(endFrequency, startAt + duration * 0.76);
      gain.gain.setValueAtTime(0.0001, startAt);
      gain.gain.exponentialRampToValueAtTime(volume * this.sfxVolume, startAt + Math.min(0.06, duration * 0.18));
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
      source.connect(filter).connect(gain).connect(context.destination);
      source.start(startAt);
      source.stop(startAt + duration);
    } catch { /* Audio is enhancement only. */ }
  }

  private playCicadaChirp() {
    const context = this.getAudioContext();
    if (!context) return;
    try {
      for (const [offset, frequency] of [[0, 4300], [0.11, 3900], [0.22, 4700]] as const) {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = "sawtooth";
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0.0001, context.currentTime + offset);
        gain.gain.exponentialRampToValueAtTime(0.032 * this.sfxVolume, context.currentTime + offset + 0.018);
        gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + offset + 0.19);
        oscillator.connect(gain).connect(context.destination);
        oscillator.start(context.currentTime + offset);
        oscillator.stop(context.currentTime + offset + 0.2);
      }
    } catch { /* Ambient effects are enhancements only. */ }
  }

  private playStageSkillSound(motif: SkillMotif) {
    if (motif === "buddha") {
      this.playTone(174, 0.88, "sine", 0.14);
      this.playTone(348, 0.68, "sine", 0.085, 0.03);
      this.playTone(522, 0.36, "triangle", 0.07, 0.12);
      this.playNoiseSweep(0.34, 920, 2100, 0.035, 0.1);
      return;
    }
    if (motif === "fujin") {
      this.playNoiseSweep(0.82, 160, 1600, 0.09);
      this.playTone(126, 0.74, "sawtooth", 0.065, 0.02);
      this.playTone(612, 0.34, "triangle", 0.07, 0.28);
      return;
    }
    this.playNoiseSweep(0.5, 120, 2800, 0.13);
    this.playTone(82, 0.6, "sawtooth", 0.12);
    this.playTone(196, 0.2, "square", 0.09, 0.09);
    this.playTone(62, 0.48, "sine", 0.09, 0.16);
  }

  private playInteractionSfx(source: HTMLAudioElement, volume: number, startAtSeconds = 0, playbackRate = 1, stopAfterSourceSeconds: number | null = 1) {
    try {
      const effect = source.cloneNode(true) as HTMLAudioElement;
      effect.volume = volume * this.sfxVolume;
      effect.preload = "auto";
      effect.currentTime = startAtSeconds;
      effect.playbackRate = playbackRate;
      void effect.play().then(() => {
        if (stopAfterSourceSeconds === null) return;
        window.setTimeout(() => {
          effect.pause();
          effect.currentTime = 0;
        }, Math.max(0, (stopAfterSourceSeconds - startAtSeconds) * 1000 / playbackRate));
      }).catch(() => undefined);
    } catch { /* Sound effects are enhancements only. */ }
  }

  private getAudioContext() {
    if (typeof AudioContext === "undefined") return null;
    if (!this.audioContext || this.audioContext.state === "closed") this.audioContext = new AudioContext();
    return this.audioContext;
  }

  private startMosquitoBuzz(context: AudioContext) {
    if (this.buzzOscillator || this.buzzGain) return;
    const oscillator = context.createOscillator();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    oscillator.type = "sawtooth";
    oscillator.frequency.value = 176;
    filter.type = "bandpass";
    filter.frequency.value = 620;
    filter.Q.value = 1.3;
    gain.gain.value = 0.0001;
    oscillator.connect(filter).connect(gain).connect(context.destination);
    oscillator.start();
    this.buzzOscillator = oscillator;
    this.buzzFilter = filter;
    this.buzzGain = gain;
  }

  private updateMosquitoBuzz() {
    const context = this.audioContext;
    const gain = this.buzzGain;
    const oscillator = this.buzzOscillator;
    const filter = this.buzzFilter;
    if (!context || context.state !== "running" || !gain || !oscillator || !filter || this.now < this.nextBuzzAt) return;
    this.nextBuzzAt = this.now + 0.12;
    let nearest = Number.POSITIVE_INFINITY;
    for (const mosquito of this.mosquitoes) {
      if (mosquito.state === "falling") continue;
      nearest = Math.min(nearest, distance(mosquito.x, mosquito.y, 0, this.playerY));
    }
    const proximity = Number.isFinite(nearest) ? clamp(1 - nearest / 7.2, 0, 1) : 0;
    const targetGain = 0.0001 + proximity * proximity * 0.075 * this.sfxVolume;
    const tone = 172 + proximity * 116 + Math.sin(this.now * 10) * (4 + proximity * 8);
    gain.gain.setTargetAtTime(targetGain, context.currentTime, 0.065);
    oscillator.frequency.setTargetAtTime(tone, context.currentTime, 0.05);
    filter.frequency.setTargetAtTime(480 + proximity * 840, context.currentTime, 0.08);
  }

  private stopMosquitoBuzz() {
    this.buzzGain?.gain.setTargetAtTime(0.0001, this.audioContext?.currentTime ?? 0, 0.04);
    this.buzzOscillator?.stop();
    this.buzzOscillator = null;
    this.buzzGain = null;
    this.buzzFilter = null;
  }
}

export async function createGameScene(engine: Engine, canvas: HTMLCanvasElement, callbacks: GameCallbacks): Promise<GameHandle> {
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.035, 0.08, 0.16, 1);
  const moonlight = new HemisphericLight("moonlight", new Vector3(0, 0, -1), scene);
  moonlight.intensity = 1.05;
  moonlight.diffuse = Color3.FromHexString("#F2EBDD");
  const camera = new FreeCamera("naika-camera", new Vector3(0, 0, -10), scene);
  camera.mode = Camera.ORTHOGRAPHIC_CAMERA;
  camera.orthoLeft = -4;
  camera.orthoRight = 4;
  camera.orthoTop = 7;
  camera.orthoBottom = -7;
  camera.setTarget(Vector3.Zero());
  const roomLayer = new Layer("room-background", STAGE_PRESENTATIONS.night.background, scene, true);
  const roomTexture = roomLayer.texture as Texture | null;
  if (roomTexture) {
    roomTexture.uScale = -1;
    roomTexture.vScale = -1;
    roomTexture.uOffset = 1;
    roomTexture.vOffset = 1;
  }

  const vignette = MeshBuilder.CreatePlane("indigo-vignette", { width: 8, height: 14 }, scene);
  vignette.position.z = -0.1;
  const vignetteMat = new StandardMaterial("indigo-vignette-material", scene);
  vignetteMat.diffuseColor = Color3.FromHexString("#10233F");
  vignetteMat.alpha = 0.16;
  vignetteMat.backFaceCulling = false;
  vignette.material = vignetteMat;

  const world = new GameWorld(scene, callbacks, roomLayer);
  const onPointerDown = (event: PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    const x = clamp(((event.clientX - rect.left) / rect.width - 0.5) * 8, -4, 4);
    const y = clamp((0.5 - (event.clientY - rect.top) / rect.height) * 14, -7, 7);
    world.handleTap(x, y);
  };
  canvas.addEventListener("pointerdown", onPointerDown, { passive: true });
  scene.onBeforeRenderObservable.add(() => world.update(scene.getEngine().getDeltaTime() / 1000));

  const handle: GameHandle = {
    scene,
    startRun: world.startRun,
    abandonRun: world.abandonRun,
    purchase: world.purchase,
    cancelPlacement: world.cancelPlacement,
    setDifficulty: world.setDifficulty,
    retry: world.retry,
    setPaused: world.setPaused,
    activateSkill: world.activateSkill,
    dispose: () => {
      canvas.removeEventListener("pointerdown", onPointerDown);
      world.dispose();
      scene.dispose();
    },
  };
  if (new URLSearchParams(window.location.search).has("demo")) handle.startRun();
  return handle;
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const distance = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by);
const seededRandom = (seed: number) => {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};

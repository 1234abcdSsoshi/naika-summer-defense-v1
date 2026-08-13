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

const ROOM_BACKGROUND = "/manus-storage/naika-room-background_d0c50701.png";
const ENEMY_SPRITES: Record<MosquitoType, string> = {
  small: "/manus-storage/naika-mosquito-small-sprite_af4952dd.png",
  fast: "/manus-storage/naika-mosquito-fast-sprite_f65f8e38.png",
  sturdy: "/manus-storage/naika-mosquito-sturdy-sprite_87f8df86.png",
};
const ITEM_ATLAS = "/manus-storage/naika-defense-items-atlas_4c991078.png";
const VFX_ATLAS = "/manus-storage/naika-woodblock-vfx-atlas_9cc67c3a.png";

export type ItemId = "incense" | "cat" | "frog" | "daruma";
type MosquitoType = "small" | "fast" | "sturdy";
type MosquitoState = "approaching" | "feeding" | "falling";

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
export type MosquitoView = { id: number; type: MosquitoType; x: number; y: number };
export type KobanView = { id: number; x: number; y: number };
export type PlacedItemView = { id: ItemId; x: number; y: number };

export type GameCallbacks = {
  onHud: (hud: HudState) => void;
  onMosquitoes: (mosquitoes: MosquitoView[]) => void;
  onKobans: (kobans: KobanView[]) => void;
  onPlacedItems: (items: PlacedItemView[]) => void;
  onPhase: (phase: "title" | "playing" | "result") => void;
  onResult: (result: ResultState) => void;
};

export type GameHandle = {
  scene: Scene;
  startRun: () => void;
  purchase: (item: ItemId) => void;
  setDifficulty: (difficulty: DifficultyId) => void;
  retry: () => void;
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
  mesh: TransformNode;
};

type Coin = {
  id: number;
  x: number;
  y: number;
  bornAt: number;
  mesh: TransformNode;
};

type PlacedItem = {
  id: ItemId;
  x: number;
  y: number;
  bornAt: number;
  mesh: TransformNode;
  nextActionAt: number;
};

type VfxKind = "tap" | "seal" | "smoke" | "damage";
type Vfx = { kind: VfxKind; bornAt: number; duration: number; mesh: TransformNode };
const ITEM_CELL: Record<ItemId, number> = { incense: 0, cat: 1, frog: 2, daruma: 3 };
const VFX_CELL: Record<VfxKind, number> = { tap: 0, seal: 1, smoke: 2, damage: 3 };

const ITEM_INFO: Record<ItemId, { price: number; label: string; color: Color3 }> = {
  incense: { price: 6, label: "蚊取り線香", color: Color3.FromHexString("#98AD5C") },
  cat: { price: 8, label: "招き猫", color: Color3.FromHexString("#F3E6D3") },
  frog: { price: 14, label: "カエル", color: Color3.FromHexString("#7BAF70") },
  daruma: { price: 10, label: "ダルマ", color: Color3.FromHexString("#CC5C4C") },
};

const MOSQUITO_INFO: Record<MosquitoType, { hp: number; speed: number; score: number; coin: number; color: Color3 }> = {
  small: { hp: 1, speed: 1.15, score: 100, coin: 1, color: Color3.FromHexString("#1D1B22") },
  fast: { hp: 1, speed: 1.78, score: 160, coin: 1, color: Color3.FromHexString("#243A5A") },
  sturdy: { hp: 2, speed: 0.94, score: 260, coin: 2, color: Color3.FromHexString("#3A2C3D") },
};

class GameWorld {
  private readonly width = 8;
  private readonly height = 14;
  private readonly playerY = -3.45;
  private now = 0;
  private running = false;
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
  private coinId = 0;
  private mosquitoes: Mosquito[] = [];
  private coinsOnFloor: Coin[] = [];
  private placed: PlacedItem[] = [];
  private vfxs: Vfx[] = [];
  private difficulty: DifficultyId = "seasonal";
  private currentThreat = 1;
  private taps = 0;
  private hits = 0;
  private damageTaken = 0;
  private coinsCollected = 0;
  private itemsPlaced = 0;
  private threatSum = 0;
  private threatSamples = 0;
  private nextMosquitoSyncAt = 0;
  private nextKobanSyncAt = 0;
  private readonly telemetry = new GameplayTelemetry();
  private readonly playerRoot: TransformNode;
  private readonly playerHead: AbstractMesh;
  private readonly playerBody: AbstractMesh;
  private readonly callbacks: GameCallbacks;
  private readonly demo = new URLSearchParams(window.location.search).has("demo");
  private readonly inspect = new URLSearchParams(window.location.search).has("inspect");
  private readonly rewardPreview = new URLSearchParams(window.location.search).has("reward");
  private readonly itemPreview = new URLSearchParams(window.location.search).has("item");
  private rewardPreviewComplete = false;
  private itemPreviewComplete = false;
  private audioContext: AudioContext | null = null;
  private buzzOscillator: OscillatorNode | null = null;
  private buzzGain: GainNode | null = null;
  private buzzFilter: BiquadFilterNode | null = null;

  constructor(private readonly scene: Scene, callbacks: GameCallbacks) {
    this.callbacks = callbacks;
    this.playerRoot = new TransformNode("sleeping-person", scene);
    this.playerRoot.position = new Vector3(0, this.playerY, 0.15);
    this.playerBody = this.makeDisc("player-body", 1.22, Color3.FromHexString("#E6D8BD"));
    this.playerBody.scaling.y = 0.58;
    this.playerBody.parent = this.playerRoot;
    this.playerBody.position = new Vector3(0, -0.2, 0);
    this.playerHead = this.makeDisc("player-head", 0.43, Color3.FromHexString("#EFCDB6"));
    this.playerHead.parent = this.playerRoot;
    this.playerHead.position = new Vector3(-0.88, 0.1, 0.03);
    const blanket = this.makeDisc("futon-blanket", 1.48, Color3.FromHexString("#53739A"));
    blanket.scaling.y = 0.48;
    blanket.parent = this.playerRoot;
    blanket.position = new Vector3(0.24, -0.55, -0.04);
  }

  startRun = () => {
    this.resetRun();
    this.unlockAudio();
    this.running = true;
    this.telemetry.start(this.difficulty);
    this.callbacks.onPhase("playing");
    this.emitMosquitoViews(true);
    this.emitHud(`${DIFFICULTY_PROFILES[this.difficulty].label}。蚊を落として、寝息を守ろう`);
  };

  setDifficulty = (difficulty: DifficultyId) => {
    if (this.running) return;
    this.difficulty = difficulty;
    this.emitHud(`${DIFFICULTY_PROFILES[difficulty].label}を選択`);
  };

  retry = () => this.startRun();

  update(delta: number) {
    const safeDelta = Math.min(delta, 0.05);
    this.animatePlayer();
    if (!this.running) return;
    this.now += safeDelta;
    this.currentThreat = getAdaptiveThreat(this.health, this.hits / Math.max(1, this.taps), this.now);
    this.threatSum += this.currentThreat;
    this.threatSamples += 1;
    this.updateItems();
    if (this.now >= this.nextSpawnAt) this.spawnMosquito();
    this.updateMosquitoes(safeDelta);
    this.emitMosquitoViews();
    this.updateMosquitoBuzz();
    this.updateCoins(safeDelta);
    this.emitKobanViews();
    this.updateVfx();
    if (this.itemPreview && !this.itemPreviewComplete && this.now > 0.12) {
      this.itemPreviewComplete = true;
      this.placeItem("incense", -1.55, -0.45);
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
      .filter((entry) => distance(entry.x, entry.y, x, y) < 0.48)
      .sort((a, b) => a.bornAt - b.bornAt)[0];
    if (coin) {
      this.collectCoin(coin, "指先で回収 +1");
      return;
    }

    const mosquito = this.mosquitoes
      .filter((entry) => entry.state !== "falling" && distance(entry.x, entry.y, x, y) < 0.45)
      .sort((a, b) => distance(a.x, a.y, 0, this.playerY) - distance(b.x, b.y, 0, this.playerY))[0];
    if (mosquito) this.hitMosquito(mosquito);
    else this.playTone(140, 0.035, "sine", 0.025);
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
    this.mosquitoes.forEach((entry) => entry.mesh.dispose());
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
    this.coinsOnFloor.forEach((entry) => entry.mesh.dispose());
    this.placed.forEach((entry) => entry.mesh.dispose());
    this.vfxs.forEach((entry) => entry.mesh.dispose());
    this.mosquitoes = [];
    this.coinsOnFloor = [];
    this.placed = [];
    this.vfxs = [];
    this.now = 0;
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
    this.nextMosquitoSyncAt = 0;
    this.nextKobanSyncAt = 0;
    this.rewardPreviewComplete = false;
    this.itemPreviewComplete = false;
    this.callbacks.onMosquitoes([]);
    this.callbacks.onKobans([]);
    this.callbacks.onPlacedItems([]);
    this.playerRoot.scaling.setAll(1);
  }

  private spawnMosquito() {
    const stage = this.now < 30 ? 0 : this.now < 60 ? 1 : 2;
    const profile = DIFFICULTY_PROFILES[this.difficulty];
    const roll = this.random();
    const sturdyBias = profile.sturdyBias + Math.max(0, this.currentThreat - 1) * 0.12;
    const type: MosquitoType = stage === 0 ? (roll < 0.78 - sturdyBias * 0.4 ? "small" : "fast") : stage === 1 ? (roll < 0.48 - sturdyBias ? "small" : roll < 0.83 - sturdyBias * 0.45 ? "fast" : "sturdy") : roll < 0.32 - sturdyBias ? "small" : roll < 0.69 - sturdyBias * 0.45 ? "fast" : "sturdy";
    const activeCap = Math.max(2, Math.round(profile.activeCaps[stage] * (this.currentThreat > 1.1 ? 1.08 : 1)));
    const interval = profile.spawnIntervals[stage] / this.currentThreat;
    this.nextSpawnAt = this.now + interval;
    if (this.mosquitoes.filter((entry) => entry.state !== "falling").length >= activeCap) return;
    const info = MOSQUITO_INFO[type];
    const x = -3.35 + this.random() * 6.7;
    const y = 3.45 + this.random() * 0.65;
    const root = new TransformNode(`mosquito-${this.mosquitoId}`, this.scene);
    root.position = new Vector3(x, y, 0.62);
    this.makeMosquitoSilhouette(`mosquito-ink-${this.mosquitoId}`, type).parent = root;
    const sprite = this.makeSprite(`mosquito-sprite-${this.mosquitoId}`, ENEMY_SPRITES[type], type === "sturdy" ? 0.96 : type === "fast" ? 0.74 : 0.68);
    sprite.parent = root;
    sprite.position.z = 0.035;
    this.mosquitoes.push({ id: this.mosquitoId++, type, hp: info.hp, state: "approaching", x, y, vx: 0, vy: 0, speed: info.speed, biteAt: 0, fallingFor: 0, mesh: root });
    this.emitMosquitoViews(true);
    this.telemetry.track("enemy_spawned", { type, stage, threat: Number(this.currentThreat.toFixed(2)), difficulty: this.difficulty });
  }

  private updateMosquitoes(delta: number) {
    for (const mosquito of [...this.mosquitoes]) {
      if (mosquito.state === "falling") {
        mosquito.fallingFor += delta;
        mosquito.y -= 4.6 * delta;
        mosquito.mesh.rotation.z += 8 * delta;
        mosquito.mesh.position.set(mosquito.x, mosquito.y, 0.45);
        if (mosquito.fallingFor > 0.28) {
          mosquito.mesh.dispose();
          this.mosquitoes = this.mosquitoes.filter((entry) => entry !== mosquito);
        }
        continue;
      }
      const cat = this.placed.find((item) => item.id === "cat" && this.now - item.bornAt < 5);
      const targetX = cat && mosquito.state !== "feeding" ? cat.x : 0;
      const targetY = cat && mosquito.state !== "feeding" ? cat.y : this.playerY + 0.25;
      const targetDistance = distance(mosquito.x, mosquito.y, targetX, targetY);
      if (!cat && targetDistance < 0.62) {
        mosquito.state = "feeding";
        if (!mosquito.biteAt) mosquito.biteAt = this.now + 1.1;
      }
      if (mosquito.state === "feeding") {
        mosquito.mesh.position.y = this.playerY + 0.15 + Math.sin(this.now * 8 + mosquito.id) * 0.06;
        mosquito.mesh.position.x = Math.sin(this.now * 5 + mosquito.id) * 0.32;
        if (this.now >= mosquito.biteAt) {
          mosquito.biteAt = this.now + (mosquito.type === "fast" ? 1.65 : 2.05);
          this.bitePlayer(mosquito.type === "sturdy" ? 9 : mosquito.type === "fast" ? 7 : 6);
        }
      } else {
        const dx = targetX - mosquito.x;
        const dy = targetY - mosquito.y;
        const len = Math.max(0.001, Math.hypot(dx, dy));
        const wiggle = Math.sin(this.now * 12 + mosquito.id * 3) * 0.18;
        mosquito.x += (dx / len * mosquito.speed + wiggle) * delta;
        mosquito.y += (dy / len * mosquito.speed) * delta;
        mosquito.mesh.position.set(mosquito.x, mosquito.y, 0.45);
        mosquito.mesh.rotation.z = Math.sin(this.now * 14 + mosquito.id) * 0.2;
      }
    }
  }

  private updateItems() {
    for (const item of [...this.placed]) {
      const age = this.now - item.bornAt;
      const outer = item.mesh.getChildMeshes()[0];
      if (item.id === "incense") {
        item.mesh.rotation.z += 0.015;
        item.mesh.scaling.setAll(Math.max(0.72, 1 - age / 64));
        if (age > 15) this.removeItem(item, "線香の煙が消えた");
        for (const mosquito of this.mosquitoes) if (mosquito.state !== "falling" && distance(item.x, item.y, mosquito.x, mosquito.y) < 1.5) this.killMosquito(mosquito, false);
      }
      if (item.id === "cat") {
        item.mesh.rotation.z = Math.sin(this.now * 10) * 0.08;
        if (age > 20) this.removeItem(item, "招き猫はひと休み");
        else if (age > 5 && outer) outer.visibility = 0.5;
      }
      if (item.id === "frog" && this.now >= item.nextActionAt) {
        const target = this.mosquitoes
          .filter((mosquito) => mosquito.state !== "falling" && distance(item.x, item.y, mosquito.x, mosquito.y) < 1.7)
          .sort((a, b) => distance(a.x, a.y, 0, this.playerY) - distance(b.x, b.y, 0, this.playerY))[0];
        if (target) {
          item.nextActionAt = this.now + 1.7;
          this.killMosquito(target, false);
          item.mesh.scaling.y = 1.2;
          window.setTimeout(() => item.mesh.scaling.y = 1, 120);
        }
      }
      if (item.id === "daruma") {
        item.mesh.rotation.z = Math.sin(this.now * 6) * 0.1;
        if (age > 12) this.removeItem(item, "ダルマは回収を終えた");
        if (this.now >= item.nextActionAt) {
          item.nextActionAt = this.now + 0.35;
          const coin = this.coinsOnFloor.find((entry) => distance(item.x, item.y, entry.x, entry.y) < 2.25);
          if (coin) this.collectCoin(coin, "ダルマが回収 +1");
        }
      }
    }
  }

  private emitMosquitoViews(force = false) {
    if (!force && this.now < this.nextMosquitoSyncAt) return;
    this.nextMosquitoSyncAt = this.now + 0.05;
    this.callbacks.onMosquitoes(this.mosquitoes
      .filter((entry) => entry.state !== "falling")
      .map(({ id, type, x, y }) => ({ id, type, x, y })));
  }

  private emitKobanViews(force = false) {
    if (!force && this.now < this.nextKobanSyncAt) return;
    this.nextKobanSyncAt = this.now + 0.05;
    this.callbacks.onKobans(this.coinsOnFloor.map(({ id, x, y }) => ({ id, x, y })));
  }

  private updateCoins(_delta: number) {
    for (const coin of [...this.coinsOnFloor]) {
      const age = this.now - coin.bornAt;
      coin.mesh.position.y = coin.y + Math.sin(age * 9) * 0.08;
      coin.mesh.rotation.z += 0.08;
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
    mosquito.mesh.scaling.setAll(1.34);
    window.setTimeout(() => mosquito.mesh.scaling.setAll(1), 90);
    this.playTone(660, 0.055, "square", 0.045);
    navigator.vibrate?.(12);
    if (mosquito.hp <= 0) this.killMosquito(mosquito, true);
    else this.emitHud("しぶとい蚊。もう一度！");
  }

  private killMosquito(mosquito: Mosquito, handTap: boolean) {
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
    this.telemetry.track("enemy_defeated", { type: mosquito.type, source: handTap ? "tap" : "item", combo: this.combo, score: this.score });
    this.emitHud(handTap ? `命中！ ${this.combo}連続` : `道具が蚊を退けた`);
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
    if (this.health <= 0) this.endRun();
    else this.emitHud("寝息が細くなっている…");
  }

  private spawnCoin(x: number, y: number, value: number) {
    for (let index = 0; index < value; index += 1) {
      const root = new TransformNode(`coin-${this.coinId}`, this.scene);
      const coin = this.makeDisc(`coin-disc-${this.coinId}`, 0.16, Color3.FromHexString("#F6A33A"));
      coin.parent = root;
      root.position = new Vector3(x + (index ? 0.24 : -0.08), y - 0.18, 0.52);
      this.coinsOnFloor.push({ id: this.coinId++, x: root.position.x, y: root.position.y, bornAt: this.now, mesh: root });
    }
    this.emitKobanViews(true);
  }

  private collectCoin(coin: Coin, notice: string) {
    if (!this.coinsOnFloor.includes(coin)) return;
    this.coins += 1;
    this.coinsCollected += 1;
    coin.mesh.dispose();
    this.coinsOnFloor = this.coinsOnFloor.filter((entry) => entry !== coin);
    this.emitKobanViews(true);
    this.playTone(820, 0.055, "triangle", 0.045);
    this.telemetry.track("coin_collected", { coins: this.coins, source: notice.includes("ダルマ") ? "daruma" : "tap" });
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
    this.placed.push({ id, x: safeX, y: safeY, bornAt: this.now, mesh: root, nextActionAt: this.now + 0.5 });
    this.emitPlacedItemViews();
    this.placement = null;
    this.itemsPlaced += 1;
    this.playTone(460, 0.09, "triangle", 0.06);
    this.telemetry.track("item_placed", { item: id, x: Number(safeX.toFixed(1)), y: Number(safeY.toFixed(1)) });
    this.emitHud(`${ITEM_INFO[id].label}を置いた`);
  }

  private removeItem(item: PlacedItem, notice: string) {
    item.mesh.dispose();
    this.placed = this.placed.filter((entry) => entry !== item);
    this.emitPlacedItemViews();
    this.emitHud(notice);
  }

  private emitPlacedItemViews() {
    this.callbacks.onPlacedItems(this.placed.map(({ id, x, y }) => ({ id, x, y })));
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

  private animatePlayer() {
    const breath = 1 + Math.sin(performance.now() / 450) * 0.018 * Math.max(0.3, this.health / 100);
    this.playerBody.scaling.x = 1.22 * breath;
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
    const bodySize = type === "sturdy" ? 0.18 : type === "fast" ? 0.115 : 0.14;
    const body = this.makeDisc(`${name}-body`, bodySize, type === "sturdy" ? Color3.FromHexString("#321E31") : Color3.FromHexString("#161A27"), 0.96);
    body.scaling.y = 1.26;
    body.parent = root;
    body.position.z = -0.025;
    const wingColor = Color3.FromHexString(type === "fast" ? "#AFC8D6" : "#DCE6E5");
    for (const side of [-1, 1]) {
      const wing = this.makeDisc(`${name}-wing-${side}`, type === "sturdy" ? 0.19 : 0.15, wingColor, 0.7);
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

  private playTone(frequency: number, duration: number, type: OscillatorType, volume: number) {
    const context = this.getAudioContext();
    if (!context) return;
    try {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = type;
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(volume, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + duration);
    } catch { /* Audio is enhancement only. */ }
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
    if (!context || context.state !== "running" || !gain || !oscillator || !filter) return;
    const nearest = this.mosquitoes
      .filter((entry) => entry.state !== "falling")
      .map((entry) => distance(entry.x, entry.y, 0, this.playerY))
      .sort((a, b) => a - b)[0];
    const proximity = nearest === undefined ? 0 : clamp(1 - nearest / 7.2, 0, 1);
    const targetGain = 0.0001 + proximity * proximity * 0.075;
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
  new Layer("room-background", ROOM_BACKGROUND, scene, true);

  const vignette = MeshBuilder.CreatePlane("indigo-vignette", { width: 8, height: 14 }, scene);
  vignette.position.z = -0.1;
  const vignetteMat = new StandardMaterial("indigo-vignette-material", scene);
  vignetteMat.diffuseColor = Color3.FromHexString("#10233F");
  vignetteMat.alpha = 0.16;
  vignetteMat.backFaceCulling = false;
  vignette.material = vignetteMat;

  const world = new GameWorld(scene, callbacks);
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
    purchase: world.purchase,
    setDifficulty: world.setDifficulty,
    retry: world.retry,
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

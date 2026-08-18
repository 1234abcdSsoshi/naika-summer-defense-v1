/**
 * Design reminder — 「藍の縁側、行灯の防衛線」:
 * DOM HUDは月白の可読性、行灯橙の行動喚起、和紙の薄い質感を使う。
 * Babylon engine lifecycle is guarded for React 19 StrictMode.
 */
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { Engine } from "@babylonjs/core/Engines/engine";
import { createGameScene, type BeneficialView, type FrogTongueView, type GameHandle, type HudState, type ItemActivationView, type ItemId, type KobanView, type MosquitoView, type PlacedItemView, type ResultState, type SkillView } from "@/game/scene";
import { DIFFICULTY_PROFILES, type DifficultyId } from "@/game/difficulty";
import { getLocalEventSummary } from "@/game/telemetry";
import { BENEFICIAL_CELL, SKILL_CELL, STAGE_PRESENTATIONS } from "@/game/stage";

const BRAND_MARK = "/manus-storage/naika-mark_1621aaa0.png";
const TITLE_BGM = "/manus-storage/naika-engawa-title-bgm_bcb74aac.wav";
const DEFENSE_ATLAS = "/manus-storage/naika-3d-defense-atlas_d5b41c2f.png";
const KOBAN_ASSET = "/manus-storage/naika-3d-koban-true-alpha_76e66136.png";
const INSECT_ATLAS = "/manus-storage/naika-3d-insect-atlas_425b7f3c.png";
const SLEEPER_ASSET = "/manus-storage/naika-sleeper-middle-aged-man-upperbody-states-clean_49502447.png";
const PILLOW_ASSET = "/manus-storage/naika-sleeper-japanese-pillow-horizontal_e5543254.png";
const BENEFICIAL_ATLAS = "/manus-storage/naika-beneficial-insects_28ab2b8a.png";
const SKILL_HANDS_ATLAS = "/manus-storage/naika-skill-hands-atlas_8df6a165.png";
const SKILL_BUTTON_ASSETS: Record<DifficultyId, string> = {
  morning: "/manus-storage/naika-skill-button-buddha_ef09ee94.png",
  dusk: "/manus-storage/naika-skill-button-fujin_169fc135.png",
  night: "/manus-storage/naika-skill-button-raijin_6b7390ec.png",
};
const SKILL_BUTTON_TONES: Record<DifficultyId, string> = {
  morning: "#e7a83b",
  dusk: "#e07742",
  night: "#7bb6ea",
};
const WIND_CHIME_ASSETS: Record<DifficultyId, string> = {
  morning: "/manus-storage/naika-wind-chime-morning-3d_8707824b.png",
  dusk: "/manus-storage/naika-wind-chime-dusk-transparent_eabe1a6a.png",
  night: "/manus-storage/naika-wind-chime-night-3d_46098ebc.png",
};
const INCENSE_ASSET = "/manus-storage/naika-incense-reference-cutout_eeafc68a.png";
const WIND_CHIME_AUDIO = "/manus-storage/naika-wind-chime-user_5fe486b7.mp3";
const PLACEMENT_RANGE: Record<ItemId, number> = { incense: 1.5, cat: 2.25, frog: 2, daruma: 2.25 };

type SleeperState = "rested" | "bitten" | "distressed" | "awake";

function getSleeperState(health: number, awake = false): SleeperState {
  if (awake || health <= 0) return "awake";
  if (health <= 35) return "distressed";
  if (health <= 70) return "bitten";
  return "rested";
}

const sleeperStatusCopy: Record<SleeperState, string> = {
  rested: "安らかに眠っている",
  bitten: "虫刺されが増え、眉が少し曇っている",
  distressed: "虫刺されが増え、眠りが浅くなっている",
  awake: "蚊に起こされ、目を覚ました",
};

const initialHud: HudState = {
  health: 100,
  score: 0,
  coins: 4,
  combo: 0,
  elapsed: 0,
  placement: null,
  notice: "",
  items: {
    incense: { price: 6, active: false },
    cat: { price: 8, active: false },
    frog: { price: 14, active: false },
    daruma: { price: 10, active: false },
  },
};

const itemCopy: Record<ItemId, { symbol: string; name: string; short: string }> = {
  incense: { symbol: "◉", name: "蚊取り線香", short: "煙で退ける" },
  cat: { symbol: "招", name: "招き猫", short: "蚊を招く" },
  frog: { symbol: "蛙", name: "カエル", short: "舌で食べる" },
  daruma: { symbol: "達", name: "ダルマ", short: "コイン回収" },
};

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handleRef = useRef<GameHandle | null>(null);
  const bgmRef = useRef<HTMLAudioElement>(null);
  const windChimeAudioRef = useRef<HTMLAudioElement | null>(null);
  const startedRef = useRef(false);
  const skillStageParam = new URLSearchParams(window.location.search).get("skill-stage");
  const skillStagePreview: DifficultyId | null = skillStageParam === "morning" || skillStageParam === "dusk" || skillStageParam === "night" ? skillStageParam : null;
  const [phase, setPhase] = useState<"title" | "playing" | "result">("title");
  const [hud, setHud] = useState<HudState>(initialHud);
  const [result, setResult] = useState<ResultState>({ score: 0, best: Number(localStorage.getItem("naika-high-score") ?? "0"), kills: 0, duration: 0 });
  const [difficulty, setDifficulty] = useState<DifficultyId>(skillStagePreview ?? "night");
  const [eventSummary, setEventSummary] = useState(() => getLocalEventSummary());
  const [audioSettings, setAudioSettings] = useState(() => ({
    bgm: Number(localStorage.getItem("naika-bgm-volume") ?? "0.10"),
    sfx: Number(localStorage.getItem("naika-sfx-volume") ?? "1"),
  }));
  const [mosquitoes, setMosquitoes] = useState<MosquitoView[]>([]);
  const [kobans, setKobans] = useState<KobanView[]>([]);
  const [placedItems, setPlacedItems] = useState<PlacedItemView[]>([]);
  const [frogTongue, setFrogTongue] = useState<FrogTongueView | null>(null);
  const [itemActivations, setItemActivations] = useState<ItemActivationView[]>([]);
  const [beneficials, setBeneficials] = useState<BeneficialView[]>([]);
  const [skill, setSkill] = useState<SkillView>({ charge: 0, motif: "raijin", ready: false, casting: false });
  const [lastItemActivation, setLastItemActivation] = useState<ItemActivationView | null>(null);
  const [placementPreview, setPlacementPreview] = useState<{ item: ItemId; x: number; y: number } | null>(null);
  const [showContinuePrompt, setShowContinuePrompt] = useState(false);
  const [showAudioSettings, setShowAudioSettings] = useState(() => new URLSearchParams(window.location.search).has("settings-check"));
  const [chimePulse, setChimePulse] = useState(false);
  const [isGameOverWaking, setIsGameOverWaking] = useState(false);
  const activationPreview = new URLSearchParams(window.location.search).has("activation-check");
  const skillPreview = new URLSearchParams(window.location.search).has("skill-check");
  const sleeperPreview = new URLSearchParams(window.location.search).get("sleeper");
  const gameOverPreview = new URLSearchParams(window.location.search).has("game-over-check");
  const gameOverResultPreview = new URLSearchParams(window.location.search).has("game-over-result-check");
  const mosquitoFlowResultPreview = new URLSearchParams(window.location.search).has("mosquito-flow-result-demo");
  const previewHealth = sleeperPreview === "bitten" ? 62 : sleeperPreview === "distressed" ? 28 : sleeperPreview === "awake" ? 0 : hud.health;
  const displayHealth = sleeperPreview ? previewHealth : hud.health;
  const sleeperState = getSleeperState(displayHealth, phase === "result" || isGameOverWaking);
  const stage = STAGE_PRESENTATIONS[difficulty];
  const displayedSkill = skillPreview ? { ...skill, charge: 1, ready: true } : skill;
  const catActivations = [
    ...itemActivations.filter((activation) => activation.item === "cat" && activation.kind === "trigger"),
    ...(activationPreview ? placedItems.filter((item) => item.id === "cat").map((item) => ({ key: `activation-preview-${item.key}`, item: item.id, x: item.x, y: item.y, tone: item.tone, kind: "trigger" as const })) : []),
  ];

  const prepareWindChimeAudio = () => {
    if (!windChimeAudioRef.current) {
      const audio = new Audio(WIND_CHIME_AUDIO);
      audio.preload = "auto";
      windChimeAudioRef.current = audio;
    }
    return windChimeAudioRef.current;
  };

  const playWindChime = () => {
    const audio = prepareWindChimeAudio();
    if (audioSettings.sfx <= 0) return;
    audio.pause();
    audio.currentTime = 0;
    audio.volume = audioSettings.sfx;
    void audio.play().catch(() => undefined);
    setChimePulse(true);
    window.setTimeout(() => setChimePulse(false), 720);
  };

  useEffect(() => {
    if (phase === "result") return;
    let cancelled = false;
    let timer: number | undefined;
    const scheduleChime = () => {
      timer = window.setTimeout(() => {
        if (cancelled) return;
        playWindChime();
        scheduleChime();
      }, 7200 + Math.random() * 5800);
    };
    scheduleChime();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [difficulty, phase, audioSettings.sfx]);

  useEffect(() => () => {
    windChimeAudioRef.current?.pause();
    windChimeAudioRef.current = null;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || startedRef.current) return;
    startedRef.current = true;
    const engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true, adaptToDeviceRatio: true });
    let disposed = false;
    let gameOverTimer: number | undefined;
    createGameScene(engine, canvas, {
      onHud: setHud,
      onMosquitoes: setMosquitoes,
      onKobans: setKobans,
      onPlacedItems: setPlacedItems,
      onFrogTongue: setFrogTongue,
      onItemActivation: (activation) => {
        setLastItemActivation(activation);
        setItemActivations((current) => [...current.slice(-11), activation]);
      },
      onBeneficials: setBeneficials,
      onSkill: setSkill,
      onPhase: (nextPhase) => {
        if (nextPhase === "result") {
          setIsGameOverWaking(true);
          gameOverTimer = window.setTimeout(() => {
            setIsGameOverWaking(false);
            setPhase("result");
          }, mosquitoFlowResultPreview ? 90 : 1180);
          return;
        }
        if (gameOverTimer) window.clearTimeout(gameOverTimer);
        setIsGameOverWaking(false);
        setPhase(nextPhase);
      },
      onResult: (nextResult) => {
        setResult(nextResult);
        setEventSummary(getLocalEventSummary());
      },
    }).then((handle) => {
      if (disposed) {
        handle.dispose();
        return;
      }
      handleRef.current = handle;
      engine.runRenderLoop(() => handle.scene.render());
      const params = new URLSearchParams(window.location.search);
      if (params.has("visual-check") || params.has("skill-check") || params.has("frog-coin-check") || params.has("game-over-check") || params.has("game-over-result-check") || params.has("damage-demo") || params.has("mosquito-flow-demo") || params.has("mosquito-flow-result-demo")) {
        if (skillStagePreview) handle.setDifficulty(skillStagePreview);
        handle.startRun();
      }
    });
    const resize = () => engine.resize();
    window.addEventListener("resize", resize);
    return () => {
      disposed = true;
      if (gameOverTimer) window.clearTimeout(gameOverTimer);
      window.removeEventListener("resize", resize);
      handleRef.current?.dispose();
      handleRef.current = null;
      engine.dispose();
      startedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const bgm = bgmRef.current;
    if (!bgm) return;
    bgm.pause();
    bgm.currentTime = 0;
    bgm.volume = audioSettings.bgm;
    if (phase === "title") bgm.play().catch(() => undefined);
  }, [phase]);

  const start = () => {
    setShowContinuePrompt(false);
    setShowAudioSettings(false);
    setIsGameOverWaking(false);
    prepareWindChimeAudio();
    const bgm = bgmRef.current;
    if (bgm) {
      bgm.volume = audioSettings.bgm;
      bgm.play().catch(() => undefined);
    }
    handleRef.current?.setDifficulty(difficulty);
    handleRef.current?.startRun();
  };
  const selectItem = (item: ItemId) => {
    if (hud.placement === item) {
      handleRef.current?.cancelPlacement();
      setPlacementPreview(null);
      return;
    }
    setPlacementPreview({ item, x: -1.55, y: -0.45 });
    handleRef.current?.purchase(item);
  };
  const updatePlacementPreview = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!hud.placement) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = Math.max(-3.1, Math.min(3.1, ((event.clientX - bounds.left) / bounds.width) * 8 - 4));
    const y = Math.max(-2.4, Math.min(3.85, 7 - ((event.clientY - bounds.top) / bounds.height) * 14));
    setPlacementPreview({ item: hud.placement, x, y });
  };
  useEffect(() => {
    const itemToPreview = hud.placement;
    if (!itemToPreview) {
      setPlacementPreview(null);
      return;
    }
    setPlacementPreview((current) => current?.item === itemToPreview ? current : { item: itemToPreview, x: -1.55, y: -0.45 });
  }, [hud.placement]);
  const updateAudioSetting = (kind: "bgm" | "sfx", rawValue: string) => {
    const value = Math.max(0, Math.min(1, Number(rawValue)));
    const next = { ...audioSettings, [kind]: value };
    setAudioSettings(next);
    localStorage.setItem(`naika-${kind}-volume`, String(value));
    if (kind === "bgm" && bgmRef.current) bgmRef.current.volume = value;
    window.dispatchEvent(new CustomEvent("naika-audio-settings", { detail: next }));
  };
  const chooseDifficulty = (nextDifficulty: DifficultyId) => {
    setDifficulty(nextDifficulty);
    handleRef.current?.setDifficulty(nextDifficulty);
  };
  const openContinuePrompt = () => {
    handleRef.current?.setPaused(true);
    setShowContinuePrompt(true);
  };
  const cancelReturnToTitle = () => {
    handleRef.current?.setPaused(false);
    setShowContinuePrompt(false);
  };
  const returnToTitle = () => {
    setShowContinuePrompt(false);
    handleRef.current?.abandonRun();
    setPhase("title");
  };
  const exitToStageSelection = () => {
    setShowContinuePrompt(false);
    returnToTitle();
  };

  return (
    <main className={`night-shell stage-${difficulty}`}>
      <div className="stage-background" aria-hidden="true" style={{ backgroundImage: `${stage.overlay}, url(${stage.background})` }} />
      <div className={`stage-atmosphere ${difficulty === "night" ? "is-night" : ""}`} aria-hidden="true">
        <span className="stage-contrast-overlay" />
      </div>
      <audio ref={bgmRef} src={phase === "title" ? TITLE_BGM : stage.gameplayBgm} loop preload="auto" />
      <canvas ref={canvasRef} onPointerMove={updatePlacementPreview} className="game-canvas" aria-label="内蚊のゲーム画面" style={{ touchAction: "none" }} />
      <div className="paper-grain" aria-hidden="true" />
      {phase !== "result" && <button type="button" className={`wind-chime-control wind-chime-${difficulty} ${chimePulse ? "is-ringing" : ""}`} aria-label="音量設定を開く" aria-expanded={showAudioSettings} onClick={() => { prepareWindChimeAudio(); playWindChime(); setShowAudioSettings((open) => !open); }}><img className="wind-chime-art" src={WIND_CHIME_ASSETS[difficulty]} alt="" /></button>}
      {phase !== "result" && showAudioSettings && <aside className="settings-panel wind-chime-settings-panel" aria-label="音量設定"><div className="settings-panel-title">音量設定</div><label><span>BGM</span><output>{Math.round(audioSettings.bgm * 100)}%</output><input type="range" min="0" max="1" step="0.01" value={audioSettings.bgm} onInput={(event) => updateAudioSetting("bgm", event.currentTarget.value)} aria-label="BGM音量" /></label><label><span>効果音</span><output>{Math.round(audioSettings.sfx * 100)}%</output><input type="range" min="0" max="1" step="0.01" value={audioSettings.sfx} onInput={(event) => updateAudioSetting("sfx", event.currentTarget.value)} aria-label="効果音音量" /></label></aside>}
      {phase === "playing" && <div className="enemy-dom-layer" aria-live="polite" aria-label={`接近中の蚊 ${mosquitoes.length}匹`}>{mosquitoes.map((mosquito) => <div key={mosquito.id} className={`enemy-dom enemy-dom-${mosquito.type}`} style={{ left: `${((mosquito.x + 4) / 8) * 100}%`, top: `${((7 - mosquito.y) / 14) * 100}%`, "--insect-atlas": `url(${INSECT_ATLAS})`, "--enemy-bank": `${mosquito.bank}deg`, "--enemy-scale": `${mosquito.scale}` } as CSSProperties}><span className="enemy-wing enemy-wing-left" /><span className="enemy-wing enemy-wing-right" /><span className="enemy-body" /><span className="enemy-legs" /></div>)}</div>}
      {phase === "playing" && <div className="beneficial-dom-layer" aria-live="polite" aria-label={`飛来中の益虫 ${beneficials.length}匹`}>{beneficials.map((beneficial) => <div key={beneficial.id} className={`beneficial-dom beneficial-${beneficial.type}`} style={{ left: `${((beneficial.x + 4) / 8) * 100}%`, top: `${((7 - beneficial.y) / 14) * 100}%`, "--beneficial-atlas": `url(${BENEFICIAL_ATLAS})`, "--beneficial-cell": `${BENEFICIAL_CELL[beneficial.type]}` } as CSSProperties}><span /></div>)}</div>}
      {phase === "playing" && <div className="koban-dom-layer" aria-live="polite" aria-label={`回収できる小判 ${kobans.length}枚`}>{kobans.map((koban) => <div key={koban.id} className="koban-dom" style={{ left: `${((koban.x + 4) / 8) * 100}%`, top: `${((7 - koban.y) / 14) * 100}%`, "--koban-asset": `url(${KOBAN_ASSET})` } as CSSProperties}><span>小判</span></div>)}</div>}
      {phase === "playing" && <div className="placed-item-dom-layer" aria-live="polite" aria-label={`設置中の防衛道具 ${placedItems.length}個`}>{placedItems.map((item) => {
        const progress = item.duration === null ? 1 : Math.max(0, Math.min(1, (item.remaining ?? 0) / item.duration));
        const effectStyle = { left: `${((item.x + 4) / 8) * 100}%`, top: `${((7 - item.y) / 14) * 100}%`, "--range-size": `${Math.round(item.range * 68)}px`, "--range-color": item.tone, "--ring-progress": `${Math.round(progress * 360)}deg`, "--defense-atlas": `url(${DEFENSE_ATLAS})`, "--incense-asset": `url(${INCENSE_ASSET})` } as CSSProperties;
        const activeFrogTongue = item.id === "frog" && frogTongue && Math.abs(frogTongue.itemX - item.x) < 0.01 && Math.abs(frogTongue.itemY - item.y) < 0.01 ? frogTongue : null;
        const frogActive = Boolean(activeFrogTongue);
        const tonguePulling = activeFrogTongue?.phase === "pull";
        const tongueAngle = activeFrogTongue ? Math.atan2(-(activeFrogTongue.targetY - item.y), activeFrogTongue.targetX - item.x) : 0;
        const mouthX = 36 + Math.cos(tongueAngle) * 17;
        const mouthY = 23 + Math.sin(tongueAngle) * 17;
        const tongueStyle = activeFrogTongue ? { "--tongue-length": `${Math.max(30, Math.min(140, Math.hypot(activeFrogTongue.targetX - item.x, activeFrogTongue.targetY - item.y) * 65))}px`, "--tongue-angle": `${tongueAngle * (180 / Math.PI)}deg`, "--frog-turn": `${tongueAngle * (180 / Math.PI)}deg`, "--frog-mouth-x": `${mouthX}px`, "--frog-mouth-y": `${mouthY}px`, "--tongue-origin-x": `${mouthX}px`, "--tongue-origin-y": `${mouthY}px` } as CSSProperties : undefined;
        return <div key={item.key} data-babylon-underlay={item.underlayDisabled ? "disabled" : "enabled"} className={`placed-item-dom placed-item-${item.id} ${frogActive ? "is-aiming" : ""} ${tonguePulling ? "is-striking" : ""}`} style={{ ...effectStyle, ...tongueStyle }}><span className="placed-item-art" aria-hidden="true" />{item.id === "incense" && <span className="incense-smoke" aria-hidden="true" />}{item.id === "frog" && <span className={`frog-mouth ${frogActive ? "is-open" : ""}`} aria-hidden="true" />}{tonguePulling && <span key={activeFrogTongue?.nonce ?? 0} className="frog-tongue" aria-hidden="true" />}<span className="item-runtime-ring"><i>{item.duration === null ? "∞" : Math.ceil(item.remaining ?? 0)}</i></span></div>;
      })}</div>}
      {phase === "playing" && hud.placement && placementPreview && <div className="placement-preview-layer" aria-hidden="true"><div data-placement-range={placementPreview.item} className="placement-range-preview" style={{ left: `${((placementPreview.x + 4) / 8) * 100}%`, top: `${((7 - placementPreview.y) / 14) * 100}%`, "--range-size": `${Math.round(PLACEMENT_RANGE[placementPreview.item] * 68)}px` } as CSSProperties} /></div>}
      {phase === "playing" && <div className="item-activation-layer" data-last-activation={lastItemActivation ? `${lastItemActivation.item}:${lastItemActivation.kind}` : "none"} aria-hidden="true">
        {catActivations.map((activation) => (
          <div key={activation.key} data-activation-source="cat" className={`cat-radiance ${activation.key.startsWith("activation-preview-") ? "is-preview" : ""}`} style={{ left: `${((activation.x + 4) / 8) * 100}%`, top: `${((7 - activation.y) / 14) * 100}%` }} onAnimationEnd={() => setItemActivations((current) => current.filter((entry) => entry.key !== activation.key))}>
            <span className="cat-radiance-halo" />
            {Array.from({ length: 9 }, (_, index) => <span key={index} className="cat-radiance-mote" style={{ "--ray-angle": `${index * 40}deg`, "--ray-distance": `${25 + (index % 3) * 9}px`, "--ray-delay": `${(index % 3) * 0.12}s` } as CSSProperties} />)}
          </div>
        ))}
      </div>}
      {phase === "title" && <div className="title-world-signals" aria-hidden="true"><span className="lantern-ring ring-one" /><span className="lantern-ring ring-two" /><span className="mosquito-shape mosquito-one" /><span className="mosquito-shape mosquito-two" /><div className="sleeping-band"><i /><i /><i /></div></div>}

      {phase !== "title" && (
        <div className="hud" aria-live="polite">
          <div className="hud-top">
            <button type="button" className="brand-mini brand-menu-button" onClick={openContinuePrompt} aria-label="最初の画面へ戻るか確認する"><img src={BRAND_MARK} alt="" /><span>内蚊</span></button>
            {phase === "playing" && <div className={`skill-meter skill-meter-${difficulty} ${displayedSkill.ready ? "is-ready" : ""}`} aria-label={`スキルゲージ ${Math.round(displayedSkill.charge * 100)}%`} style={{ "--skill-charge": `${Math.round(displayedSkill.charge * 100)}%` } as CSSProperties}><div className="skill-meter-copy"><span>スキル</span><strong>{displayedSkill.ready ? "発動可能" : `${Math.round(displayedSkill.charge * 100)}%`}</strong></div><div className="skill-meter-track"><i /></div><small>{stage.skillLabel}</small></div>}
            <div className="score-cluster"><span>{stage.shortLabel}の得点</span><strong>{hud.score.toLocaleString()}</strong></div>
          </div>
          <div className="hud-readout">
            <div className="breath-meter"><span>寝息</span><div><i style={{ width: `${displayHealth}%` }} /></div><b>{displayHealth}</b></div>
            <div className="coin-readout"><i className="hud-koban" style={{ "--koban-asset": `url(${KOBAN_ASSET})` } as CSSProperties} aria-label="小判" /><b>{hud.coins}</b></div>
          </div>
          {hud.notice && <div className="notice">{hud.notice}</div>}
          {hud.placement && <div className="placement-callout"><span>選択中</span><strong>{itemCopy[hud.placement].name}</strong><small>畳をタップして置く</small></div>}
        </div>
      )}

      {phase === "playing" && (displayedSkill.ready || displayedSkill.casting) && <div className={`skill-core skill-core-${difficulty} ${displayedSkill.ready ? "is-ready" : ""} ${displayedSkill.casting ? "is-casting" : ""}`} style={{ "--skill-button-art": `url(${SKILL_BUTTON_ASSETS[difficulty]})`, "--skill-tone": SKILL_BUTTON_TONES[difficulty], "--skill-hands": `url(${SKILL_HANDS_ATLAS})`, "--skill-hand-row": `${SKILL_CELL[displayedSkill.motif]}` } as CSSProperties}><button type="button" onClick={() => handleRef.current?.activateSkill()} disabled={!displayedSkill.ready} aria-label={`${stage.skillLabel}を使う`}><span className="skill-button-art" aria-hidden="true" /><span className="skill-button-copy"><small>{stage.shortLabel}の奥義</small><strong>{displayedSkill.ready ? stage.skillLabel : "発動中"}</strong></span></button>{displayedSkill.casting && <div className="skill-hands" aria-label={stage.skillLabel}><i className="skill-hand-left" /><i className="skill-hand-right" /></div>}</div>}

      {phase === "playing" && <div className={`game-sleeper-anchor sleeper-state-${sleeperState}`} data-sleeper-state={sleeperState} role="img" aria-label={`中年男性：${sleeperStatusCopy[sleeperState]}`} style={{ "--sleeper-asset": `url(${SLEEPER_ASSET})`, "--pillow-asset": `url(${PILLOW_ASSET})` } as CSSProperties}><span className="sleeper-pillow" aria-hidden="true" /><span className="sleeper-sprite" /><span className="sleeper-bite sleeper-bite-one" /><span className="sleeper-bite sleeper-bite-two" /><span className="sleeper-bite sleeper-bite-three" /><span className="sleeper-bite sleeper-bite-four" /><span className="sleeper-bite sleeper-bite-five" /><span className="sleeper-worry-lines" aria-hidden="true" /><small>{sleeperStatusCopy[sleeperState]}</small></div>}

      {phase === "playing" && (
        <nav className="item-tray" aria-label="防衛道具">
          {(Object.keys(itemCopy) as ItemId[]).map((item) => {
            const data = hud.items[item];
            const ready = hud.coins >= data.price && !data.active;
            return <button key={item} className={`item-button ${ready ? "is-ready" : ""} ${data.active ? "is-active" : ""}`} onClick={() => selectItem(item)} disabled={data.active}>
              <span className={`item-thumb item-thumb-${item}`} aria-hidden="true" style={{ "--defense-atlas": `url(${DEFENSE_ATLAS})`, "--incense-asset": `url(${INCENSE_ASSET})` } as CSSProperties} />
              <span className="item-symbol">{itemCopy[item].symbol}</span>
              <span className="item-name">{itemCopy[item].name}</span>
              <span className="item-meta">{data.active ? (data.cooldown ? `${data.cooldown}s` : "稼働中") : <><i className="koban-mini" style={{ "--koban-asset": `url(${KOBAN_ASSET})` } as CSSProperties} aria-hidden="true" />{data.price}</>}</span>
            </button>;
          })}
        </nav>
      )}

      {phase === "playing" && showContinuePrompt && <div className="continue-dialog-backdrop" role="presentation"><section className="continue-dialog" role="dialog" aria-modal="true" aria-labelledby="continue-dialog-title"><p className="eyebrow">夜の途中ですが</p><h2 id="continue-dialog-title">最初の画面へ戻りますか？</h2><p>「戻る」を選ぶと、現在のプレイを終了して最初の画面へ戻ります。</p><p className="continue-dialog-warning">現在のスコアは破棄されます。</p><div><button type="button" className="continue-yes" onClick={cancelReturnToTitle}>キャンセル</button><button type="button" className="continue-no" onClick={returnToTitle}>戻る</button></div></section></div>}

      {phase === "title" && (
        <section className="title-card" aria-labelledby="game-title">
          <img className="brand-mark" src={BRAND_MARK} alt="内蚊のシンボルマーク" />
          <p className="eyebrow">夏の防衛アクション</p>
          <h1 id="game-title"><em>内</em>蚊 <span>ないか</span></h1>
          <p className="title-copy">この時間、守るのは<br />ひとりぶんの寝息。</p>
          <div className="difficulty-switch" role="group" aria-label="守る時間帯を選ぶ">
            {(Object.keys(DIFFICULTY_PROFILES) as DifficultyId[]).map((id) => <button key={id} className={difficulty === id ? "is-selected" : ""} onClick={() => chooseDifficulty(id)}><span>{DIFFICULTY_PROFILES[id].shortLabel}</span><small>{DIFFICULTY_PROFILES[id].description}</small></button>)}
          </div>
          <button className="start-button" onClick={start}>{stage.titleAction} <span>→</span></button>
          <p className="title-note">蚊をタップし、落ちたコインで道具を置こう。</p>
        </section>
      )}

      {(gameOverPreview || isGameOverWaking) && <div className="gameover-wake-overlay" role="status" aria-live="assertive"><div className="gameover-wake-character" style={{ "--sleeper-asset": `url(${SLEEPER_ASSET})`, "--pillow-asset": `url(${PILLOW_ASSET})` } as CSSProperties}><span className="sleeper-sprite" /></div><p>びくっ！　目を覚ました。</p></div>}

      {phase === "result" && !gameOverPreview && (
        <section className="result-card" aria-live="assertive">
          <div className="result-sleeper" style={{ "--sleeper-asset": `url(${SLEEPER_ASSET})`, "--pillow-asset": `url(${PILLOW_ASSET})` } as CSSProperties}><span className="sleeper-sprite" /></div>
          <p className="eyebrow">蚊に起こされた夜の記録</p>
          <h2>目を覚ましてしまった。</h2>
          <div className="result-score"><span>得点</span><strong>{result.score.toLocaleString()}</strong></div>
          <dl><div><dt>最高点</dt><dd>{result.best.toLocaleString()}</dd></div><div><dt>退けた蚊</dt><dd>{result.kills}</dd></div><div><dt>守れた時間</dt><dd>{result.duration}秒</dd></div></dl>
          {result.analytics && <div className="analysis-slip"><p>今夜の記録 <span>{DIFFICULTY_PROFILES[result.analytics.difficulty].shortLabel}</span></p><div><b>命中率 {Math.round(result.analytics.hitRate * 100)}%</b><b>被弾 {result.analytics.damageTaken}</b><b>脅威 {result.analytics.averageThreat.toFixed(2)}x</b></div><small>端末内イベント {eventSummary.events}件／完走 {eventSummary.completedRuns}回</small></div>}
          <button className="start-button" onClick={start}>もう一度、守る <span>↻</span></button>
          <button type="button" className="quiet-button result-home-button" onClick={returnToTitle} aria-label="ホームへ戻る">ホームへ戻る</button>
        </section>
      )}
    </main>
  );
}

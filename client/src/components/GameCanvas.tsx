/**
 * Design reminder — 「藍の縁側、行灯の防衛線」:
 * DOM HUDは月白の可読性、行灯橙の行動喚起、和紙の薄い質感を使う。
 * Babylon engine lifecycle is guarded for React 19 StrictMode.
 */
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { Engine } from "@babylonjs/core/Engines/engine";
import { createGameScene, type FrogTongueView, type GameHandle, type HudState, type ItemActivationView, type ItemId, type KobanView, type MosquitoView, type PlacedItemView, type ResultState } from "@/game/scene";
import { DIFFICULTY_PROFILES, type DifficultyId } from "@/game/difficulty";
import { getLocalEventSummary } from "@/game/telemetry";

const BRAND_MARK = "/manus-storage/naika-mark_1621aaa0.png";
const BACKGROUND = "/manus-storage/naika-room-background_d0c50701.png";
const NIGHT_BGM = "/manus-storage/naika-night-defense-loop_0b454f3f.mp3";
const DEFENSE_ATLAS = "/manus-storage/naika-3d-defense-atlas_d5b41c2f.png";
const KOBAN_ASSET = "/manus-storage/naika-3d-koban-true-alpha_76e66136.png";
const INSECT_ATLAS = "/manus-storage/naika-3d-insect-atlas_425b7f3c.png";
const SLEEPER_ASSET = "/manus-storage/naika-sleeper-middle-aged-man-states_83f0aa21.png";
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
  const startedRef = useRef(false);
  const [phase, setPhase] = useState<"title" | "playing" | "result">("title");
  const [hud, setHud] = useState<HudState>(initialHud);
  const [result, setResult] = useState<ResultState>({ score: 0, best: Number(localStorage.getItem("naika-high-score") ?? "0"), kills: 0, duration: 0 });
  const [difficulty, setDifficulty] = useState<DifficultyId>("seasonal");
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
  const [lastItemActivation, setLastItemActivation] = useState<ItemActivationView | null>(null);
  const [placementPreview, setPlacementPreview] = useState<{ item: ItemId; x: number; y: number } | null>(null);
  const [showContinuePrompt, setShowContinuePrompt] = useState(false);
  const [isGameOverWaking, setIsGameOverWaking] = useState(false);
  const activationPreview = new URLSearchParams(window.location.search).has("activation-check");
  const sleeperPreview = new URLSearchParams(window.location.search).get("sleeper");
  const gameOverPreview = new URLSearchParams(window.location.search).has("game-over-check");
  const gameOverResultPreview = new URLSearchParams(window.location.search).has("game-over-result-check");
  const mosquitoFlowResultPreview = new URLSearchParams(window.location.search).has("mosquito-flow-result-demo");
  const previewHealth = sleeperPreview === "bitten" ? 62 : sleeperPreview === "distressed" ? 28 : sleeperPreview === "awake" ? 0 : hud.health;
  const displayHealth = sleeperPreview ? previewHealth : hud.health;
  const sleeperState = getSleeperState(displayHealth, phase === "result" || isGameOverWaking);
  const catActivations = [
    ...itemActivations.filter((activation) => activation.item === "cat" && activation.kind === "trigger"),
    ...(activationPreview ? placedItems.filter((item) => item.id === "cat").map((item) => ({ key: `activation-preview-${item.key}`, item: item.id, x: item.x, y: item.y, tone: item.tone, kind: "trigger" as const })) : []),
  ];

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
      if (params.has("visual-check") || params.has("frog-coin-check") || params.has("game-over-check") || params.has("game-over-result-check") || params.has("damage-demo") || params.has("mosquito-flow-demo") || params.has("mosquito-flow-result-demo")) {
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

  const start = () => {
    setShowContinuePrompt(false);
    setIsGameOverWaking(false);
    const bgm = bgmRef.current;
    if (bgm) {
      bgm.volume = audioSettings.bgm;
      bgm.play().catch(() => undefined);
    }
    handleRef.current?.setDifficulty(difficulty);
    handleRef.current?.startRun();
  };
  const selectItem = (item: ItemId) => {
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
  const returnToTitle = () => {
    handleRef.current?.abandonRun();
    const bgm = bgmRef.current;
    if (bgm) {
      bgm.pause();
      bgm.currentTime = 0;
    }
    setPhase("title");
  };
  const exitToStageSelection = () => {
    setShowContinuePrompt(false);
    returnToTitle();
  };

  return (
    <main className="night-shell" style={{ backgroundImage: `linear-gradient(rgba(10, 24, 45, .35), rgba(10, 24, 45, .72)), url(${BACKGROUND})` }}>
      <audio ref={bgmRef} src={NIGHT_BGM} loop preload="auto" />
      <canvas ref={canvasRef} onPointerMove={updatePlacementPreview} className="game-canvas" aria-label="内蚊のゲーム画面" style={{ touchAction: "none" }} />
      <div className="paper-grain" aria-hidden="true" />
      {phase !== "result" && <aside className="audio-dock" aria-label="音量調整"><div className="audio-dock-title">音量</div><label><span aria-hidden="true">♫</span><input type="range" min="0" max="1" step="0.01" value={audioSettings.bgm} onInput={(event) => updateAudioSetting("bgm", event.currentTarget.value)} aria-label="BGM音量" /><small>BGM</small></label><label><span aria-hidden="true">✦</span><input type="range" min="0" max="1" step="0.01" value={audioSettings.sfx} onInput={(event) => updateAudioSetting("sfx", event.currentTarget.value)} aria-label="効果音音量" /><small>効果音</small></label></aside>}
      {phase === "playing" && <div className="enemy-dom-layer" aria-live="polite" aria-label={`接近中の蚊 ${mosquitoes.length}匹`}>{mosquitoes.map((mosquito) => <div key={mosquito.id} className={`enemy-dom enemy-dom-${mosquito.type}`} style={{ left: `${((mosquito.x + 4) / 8) * 100}%`, top: `${((7 - mosquito.y) / 14) * 100}%`, "--insect-atlas": `url(${INSECT_ATLAS})`, "--enemy-bank": `${mosquito.bank}deg`, "--enemy-scale": `${mosquito.scale}` } as CSSProperties}><span className="enemy-wing enemy-wing-left" /><span className="enemy-wing enemy-wing-right" /><span className="enemy-body" /><span className="enemy-legs" /></div>)}</div>}
      {phase === "playing" && <div className="koban-dom-layer" aria-live="polite" aria-label={`回収できる小判 ${kobans.length}枚`}>{kobans.map((koban) => <div key={koban.id} className="koban-dom" style={{ left: `${((koban.x + 4) / 8) * 100}%`, top: `${((7 - koban.y) / 14) * 100}%`, "--koban-asset": `url(${KOBAN_ASSET})` } as CSSProperties}><span>小判</span></div>)}</div>}
      {phase === "playing" && <div className="placed-item-dom-layer" aria-live="polite" aria-label={`設置中の防衛道具 ${placedItems.length}個`}>{placedItems.map((item) => {
        const progress = item.duration === null ? 1 : Math.max(0, Math.min(1, (item.remaining ?? 0) / item.duration));
        const effectStyle = { left: `${((item.x + 4) / 8) * 100}%`, top: `${((7 - item.y) / 14) * 100}%`, "--range-size": `${Math.round(item.range * 68)}px`, "--range-color": item.tone, "--ring-progress": `${Math.round(progress * 360)}deg`, "--defense-atlas": `url(${DEFENSE_ATLAS})` } as CSSProperties;
        const activeFrogTongue = item.id === "frog" && frogTongue && Math.abs(frogTongue.itemX - item.x) < 0.01 && Math.abs(frogTongue.itemY - item.y) < 0.01 ? frogTongue : null;
        const frogActive = Boolean(activeFrogTongue);
        const tonguePulling = activeFrogTongue?.phase === "pull";
        const tongueAngle = activeFrogTongue ? Math.atan2(-(activeFrogTongue.targetY - item.y), activeFrogTongue.targetX - item.x) : 0;
        const mouthX = 36 + Math.cos(tongueAngle) * 17;
        const mouthY = 23 + Math.sin(tongueAngle) * 17;
        const tongueStyle = activeFrogTongue ? { "--tongue-length": `${Math.max(30, Math.min(140, Math.hypot(activeFrogTongue.targetX - item.x, activeFrogTongue.targetY - item.y) * 65))}px`, "--tongue-angle": `${tongueAngle * (180 / Math.PI)}deg`, "--frog-turn": `${tongueAngle * (180 / Math.PI)}deg`, "--frog-mouth-x": `${mouthX}px`, "--frog-mouth-y": `${mouthY}px`, "--tongue-origin-x": `${mouthX}px`, "--tongue-origin-y": `${mouthY}px` } as CSSProperties : undefined;
        return <div key={item.key} data-babylon-underlay={item.underlayDisabled ? "disabled" : "enabled"} className={`placed-item-dom placed-item-${item.id} ${frogActive ? "is-aiming" : ""} ${tonguePulling ? "is-striking" : ""}`} style={{ ...effectStyle, ...tongueStyle }}><span className="placed-item-art" aria-hidden="true" />{item.id === "incense" && <span className="incense-coil" aria-hidden="true" />}{item.id === "frog" && <span className={`frog-mouth ${frogActive ? "is-open" : ""}`} aria-hidden="true" />}{tonguePulling && <span key={activeFrogTongue?.nonce ?? 0} className="frog-tongue" aria-hidden="true" />}<span className="item-runtime-ring"><i>{item.duration === null ? "∞" : Math.ceil(item.remaining ?? 0)}</i></span></div>;
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
      {phase === "title" && <div className="title-world-signals" aria-hidden="true"><span className="moon-disc" /><span className="lantern-ring ring-one" /><span className="lantern-ring ring-two" /><span className="mosquito-shape mosquito-one" /><span className="mosquito-shape mosquito-two" /><div className="sleeping-band"><i /><i /><i /></div></div>}

      {phase !== "title" && (
        <div className="hud" aria-live="polite">
          <div className="hud-top">
            <button type="button" className="brand-mini brand-menu-button" onClick={() => setShowContinuePrompt(true)} aria-label="ゲームを続けるか確認する"><img src={BRAND_MARK} alt="" /><span>内蚊</span></button>
            <div className="score-cluster"><span>夜更けの得点</span><strong>{hud.score.toLocaleString()}</strong></div>
          </div>
          <div className="hud-readout">
            <div className="breath-meter"><span>寝息</span><div><i style={{ width: `${displayHealth}%` }} /></div><b>{displayHealth}</b></div>
            <div className="coin-readout"><i className="hud-koban" style={{ "--koban-asset": `url(${KOBAN_ASSET})` } as CSSProperties} aria-label="小判" /><b>{hud.coins}</b></div>
          </div>
          {hud.notice && <div className="notice">{hud.notice}</div>}
          {hud.placement && <div className="placement-callout"><span>選択中</span><strong>{itemCopy[hud.placement].name}</strong><small>畳をタップして置く</small></div>}
        </div>
      )}

      {phase === "playing" && <div className={`game-sleeper-anchor sleeper-state-${sleeperState}`} data-sleeper-state={sleeperState} role="img" aria-label={`中年男性：${sleeperStatusCopy[sleeperState]}`} style={{ "--sleeper-asset": `url(${SLEEPER_ASSET})` } as CSSProperties}><span className="sleeper-sprite" /><span className="sleeper-bite sleeper-bite-one" /><span className="sleeper-bite sleeper-bite-two" /><span className="sleeper-bite sleeper-bite-three" /><span className="sleeper-bite sleeper-bite-four" /><span className="sleeper-bite sleeper-bite-five" /><span className="sleeper-worry-lines" aria-hidden="true" /><small>{sleeperStatusCopy[sleeperState]}</small></div>}

      {phase === "playing" && (
        <nav className="item-tray" aria-label="防衛道具">
          {(Object.keys(itemCopy) as ItemId[]).map((item) => {
            const data = hud.items[item];
            const ready = hud.coins >= data.price && !data.active;
            return <button key={item} className={`item-button ${ready ? "is-ready" : ""} ${data.active ? "is-active" : ""}`} onClick={() => selectItem(item)} disabled={data.active}>
              <span className={`item-thumb item-thumb-${item}`} aria-hidden="true" style={{ "--defense-atlas": `url(${DEFENSE_ATLAS})` } as CSSProperties} />
              <span className="item-symbol">{itemCopy[item].symbol}</span>
              <span className="item-name">{itemCopy[item].name}</span>
              <span className="item-meta">{data.active ? (data.cooldown ? `${data.cooldown}s` : "稼働中") : <><i className="koban-mini" style={{ "--koban-asset": `url(${KOBAN_ASSET})` } as CSSProperties} aria-hidden="true" />{data.price}</>}</span>
            </button>;
          })}
        </nav>
      )}

      {phase === "playing" && showContinuePrompt && <div className="continue-dialog-backdrop" role="presentation"><section className="continue-dialog" role="dialog" aria-modal="true" aria-labelledby="continue-dialog-title"><p className="eyebrow">夜の途中ですが</p><h2 id="continue-dialog-title">ゲームを続けますか？</h2><p>「いいえ」を選ぶと、難易度を選べるステージ選択画面へ戻ります。</p><div><button type="button" className="continue-yes" onClick={() => setShowContinuePrompt(false)}>はい、続ける</button><button type="button" className="continue-no" onClick={exitToStageSelection}>いいえ</button></div></section></div>}

      {phase === "title" && (
        <section className="title-card" aria-labelledby="game-title">
          <img className="brand-mark" src={BRAND_MARK} alt="内蚊のシンボルマーク" />
          <p className="eyebrow">夏夜の防衛アクション</p>
          <h1 id="game-title"><em>内</em>蚊 <span>ないか</span></h1>
          <p className="title-copy">今夜、守るのは<br />ひとりぶんの寝息。</p>
          <div className="difficulty-switch" role="group" aria-label="夜の気配を選ぶ">
            {(Object.keys(DIFFICULTY_PROFILES) as DifficultyId[]).map((id) => <button key={id} className={difficulty === id ? "is-selected" : ""} onClick={() => chooseDifficulty(id)}><span>{DIFFICULTY_PROFILES[id].shortLabel}</span><small>{DIFFICULTY_PROFILES[id].description}</small></button>)}
          </div>
          <button className="start-button" onClick={start}>夜を守る <span>→</span></button>
          <p className="title-note">蚊をタップし、落ちたコインで道具を置こう。</p>
        </section>
      )}

      {(gameOverPreview || isGameOverWaking) && <div className="gameover-wake-overlay" role="status" aria-live="assertive"><div className="gameover-wake-character" style={{ "--sleeper-asset": `url(${SLEEPER_ASSET})` } as CSSProperties}><span className="sleeper-sprite" /></div><p>びくっ！　目を覚ました。</p></div>}

      {phase === "result" && !gameOverPreview && (
        <section className="result-card" aria-live="assertive">
          <div className="result-sleeper" style={{ "--sleeper-asset": `url(${SLEEPER_ASSET})` } as CSSProperties}><span className="sleeper-sprite" /></div>
          <p className="eyebrow">蚊に起こされた夜の記録</p>
          <h2>目を覚ましてしまった。</h2>
          <div className="result-score"><span>得点</span><strong>{result.score.toLocaleString()}</strong></div>
          <dl><div><dt>最高点</dt><dd>{result.best.toLocaleString()}</dd></div><div><dt>退けた蚊</dt><dd>{result.kills}</dd></div><div><dt>守れた時間</dt><dd>{result.duration}秒</dd></div></dl>
          {result.analytics && <div className="analysis-slip"><p>今夜の記録 <span>{DIFFICULTY_PROFILES[result.analytics.difficulty].shortLabel}</span></p><div><b>命中率 {Math.round(result.analytics.hitRate * 100)}%</b><b>被弾 {result.analytics.damageTaken}</b><b>脅威 {result.analytics.averageThreat.toFixed(2)}x</b></div><small>端末内イベント {eventSummary.events}件／完走 {eventSummary.completedRuns}回</small></div>}
          <button className="start-button" onClick={start}>もう一度、守る <span>↻</span></button>
          <button className="quiet-button" onClick={returnToTitle}>縁側へ戻る</button>
        </section>
      )}
    </main>
  );
}

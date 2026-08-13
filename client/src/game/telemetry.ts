/**
 * Design reminder — 夜の記録は個人情報を扱わず、ゲーム内の手触りを検証する匿名イベントだけを残す。
 */
import type { DifficultyId } from "./difficulty";

export type GameEventName = "run_started" | "enemy_spawned" | "tap_hit" | "enemy_defeated" | "damage_taken" | "coin_collected" | "item_purchased" | "item_placed" | "run_ended";

export type GameEvent = {
  name: GameEventName;
  at: number;
  runId: string;
  payload: Record<string, string | number>;
};

export type RunAnalytics = {
  runId: string;
  difficulty: DifficultyId;
  score: number;
  duration: number;
  kills: number;
  hitRate: number;
  damageTaken: number;
  coinsCollected: number;
  itemsPlaced: number;
  averageThreat: number;
};

const STORAGE_KEY = "naika-game-events-v1";

export class GameplayTelemetry {
  private runId = "";

  start(difficulty: DifficultyId) {
    this.runId = `night-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    this.track("run_started", { difficulty });
    return this.runId;
  }

  track(name: GameEventName, payload: Record<string, string | number> = {}) {
    if (!this.runId) return;
    const event: GameEvent = { name, at: Date.now(), runId: this.runId, payload };
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as GameEvent[];
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...stored.slice(-199), event]));
    } catch {
      // Telemetry is optional and must never block a game session.
    }
    window.dispatchEvent(new CustomEvent("naika:game-event", { detail: event }));
  }

  finish(analytics: RunAnalytics) {
    this.track("run_ended", { score: analytics.score, duration: analytics.duration, hitRate: analytics.hitRate, damageTaken: analytics.damageTaken, difficulty: analytics.difficulty });
  }
}

export function getLocalEventSummary() {
  try {
    const events = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as GameEvent[];
    const completed = events.filter((event) => event.name === "run_ended");
    return { events: events.length, completedRuns: completed.length, latest: completed.at(-1)?.payload ?? null };
  } catch {
    return { events: 0, completedRuns: 0, latest: null };
  }
}

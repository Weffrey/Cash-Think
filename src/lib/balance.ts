import { CATEGORIES } from "./categories";
import type { Counters, Settings } from "./types";

export interface BalanceRow {
  categoryId: number;
  name: string;
  /** completed questions that counted */
  count: number;
  weight: number;
  pinned: boolean;
  /** weight / sum of weights; 0 when the category is excluded */
  share: number;
  /** share x total counted questions among included categories; null when excluded */
  target: number | null;
  /** count - target: positive means ahead, negative means behind; null when excluded */
  delta: number | null;
}

/**
 * Where each category stands against its weighted target share. Uses the same
 * shares as the selector (weight / sum of weights over categories with weight > 0).
 */
export function computeBalance(counters: Counters, settings: Settings): BalanceRow[] {
  const weightOf = (id: number) => {
    const w = settings.weights[id];
    return w === undefined ? 1 : w;
  };
  const active = CATEGORIES.filter((c) => weightOf(c.id) > 0);
  const weightSum = active.reduce((s, c) => s + weightOf(c.id), 0);
  const total = active.reduce((s, c) => s + (counters[c.id] ?? 0), 0);
  return CATEGORIES.map((c) => {
    const weight = weightOf(c.id);
    const count = counters[c.id] ?? 0;
    const included = weight > 0 && weightSum > 0;
    const share = included ? weight / weightSum : 0;
    const target = included ? share * total : null;
    return {
      categoryId: c.id,
      name: c.name,
      count,
      weight,
      pinned: settings.pinnedCategories.includes(c.id),
      share,
      target,
      delta: target === null ? null : count - target,
    };
  });
}

/** Validate and normalize settings coming from the browser. Returns null if they are not usable. */
export function normalizeSettings(input: unknown): Settings | null {
  if (typeof input !== "object" || input === null) return null;
  const raw = input as Record<string, unknown>;
  const base = raw.baseDifficulty;
  const stretch = raw.stretchPct;
  if (typeof base !== "number" || !Number.isInteger(base) || base < 1 || base > 5) return null;
  if (typeof stretch !== "number" || !Number.isFinite(stretch) || stretch < 0 || stretch > 100) return null;
  const ids = new Set<number>(CATEGORIES.map((c) => c.id));
  const weights: Record<number, number> = {};
  if (raw.weights !== undefined) {
    if (typeof raw.weights !== "object" || raw.weights === null) return null;
    for (const [k, v] of Object.entries(raw.weights as Record<string, unknown>)) {
      const id = Number(k);
      if (!ids.has(id) || typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 10) return null;
      if (v !== 1) weights[id] = v;
    }
  }
  let pinned: number[] = [];
  if (raw.pinnedCategories !== undefined) {
    if (!Array.isArray(raw.pinnedCategories)) return null;
    for (const p of raw.pinnedCategories) if (typeof p !== "number" || !ids.has(p)) return null;
    pinned = [...new Set(raw.pinnedCategories as number[])].sort((a, b) => a - b);
  }
  return { baseDifficulty: base, stretchPct: Math.round(stretch), weights, pinnedCategories: pinned };
}

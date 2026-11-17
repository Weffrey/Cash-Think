import type { Attempt, Counters, Question, Settings } from "./types";

/** Random number source returning [0, 1). Injected so tests are deterministic. */
export type Rng = () => number;

export const MIN_DIFFICULTY = 1;
export const MAX_DIFFICULTY = 5;

/**
 * An attempt counts toward its category only if it was completed and the
 * solution was not shown before answering. Giving up never counts.
 */
export function countsTowardCategory(a: Pick<Attempt, "outcome" | "helpLevel">): boolean {
  return a.outcome === "completed" && a.helpLevel < 3;
}

/** Counters are derived from attempts, never stored, so they cannot drift. */
export function computeCounters(attempts: Pick<Attempt, "categoryId" | "outcome" | "helpLevel">[]): Counters {
  const counters: Counters = {};
  for (const a of attempts) {
    if (countsTowardCategory(a)) {
      counters[a.categoryId] = (counters[a.categoryId] ?? 0) + 1;
    }
  }
  return counters;
}

function weightOf(settings: Settings, categoryId: number): number {
  const w = settings.weights[categoryId];
  return w === undefined ? 1 : w;
}

function randomPick<T>(items: T[], rng: Rng): T {
  return items[Math.floor(rng() * items.length)];
}

/**
 * Pick the category furthest behind its target share.
 * target share = weight / sum of weights (among eligible categories)
 * gap = share * (total + 1) - count, where total is the sum of counts among
 * eligible categories. The largest gap wins; ties are broken randomly.
 */
export function pickCategory(
  eligible: number[],
  counters: Counters,
  weights: (id: number) => number,
  rng: Rng,
): number | null {
  const active = eligible.filter((id) => weights(id) > 0);
  if (active.length === 0) return null;
  const weightSum = active.reduce((s, id) => s + weights(id), 0);
  const total = active.reduce((s, id) => s + (counters[id] ?? 0), 0);
  const EPS = 1e-9;
  let best: number[] = [];
  let bestGap = -Infinity;
  for (const id of active) {
    const gap = (weights(id) / weightSum) * (total + 1) - (counters[id] ?? 0);
    if (gap > bestGap + EPS) {
      bestGap = gap;
      best = [id];
    } else if (Math.abs(gap - bestGap) <= EPS) {
      best.push(id);
    }
  }
  return randomPick(best, rng);
}

/**
 * Difficulty mix: with probability stretchPct a question is one level above
 * the base level, otherwise it is at the base level. Stretch is one level only.
 */
export function pickDifficulty(base: number, stretchPct: number, rng: Rng): number {
  const b = Math.min(MAX_DIFFICULTY, Math.max(MIN_DIFFICULTY, Math.round(base)));
  const stretch = Math.min(100, Math.max(0, stretchPct));
  return rng() * 100 < stretch ? Math.min(MAX_DIFFICULTY, b + 1) : b;
}

/**
 * Pick a question from one category's pool at the wanted difficulty.
 * If none exist at that difficulty, use the nearest difficulty (lower wins ties).
 * Prefer unseen questions, then the least recently seen.
 * lastSeen maps questionId to the timestamp of its latest attempt.
 */
export function pickQuestion(
  pool: Question[],
  difficulty: number,
  lastSeen: Map<number, number>,
  rng: Rng,
): Question | null {
  if (pool.length === 0) return null;
  const distance = (q: Question) => Math.abs(q.difficulty - difficulty);
  const minDistance = Math.min(...pool.map(distance));
  let near = pool.filter((q) => distance(q) === minDistance);
  if (minDistance > 0) {
    const lower = near.filter((q) => q.difficulty < difficulty);
    if (lower.length > 0) near = lower;
  }
  const unseen = near.filter((q) => !lastSeen.has(q.id));
  if (unseen.length > 0) return randomPick(unseen, rng);
  const oldest = Math.min(...near.map((q) => lastSeen.get(q.id) as number));
  return randomPick(near.filter((q) => lastSeen.get(q.id) === oldest), rng);
}

export interface SelectionInput {
  questions: Question[];
  counters: Counters;
  settings: Settings;
  lastSeen: Map<number, number>;
}

export interface Selection {
  question: Question;
  categoryId: number;
  difficulty: number;
}

/** The whole selector: settings and counters in, next question out. Pure. */
export function selectNext(input: SelectionInput, rng: Rng): Selection | null {
  const { counters, settings, lastSeen } = input;
  const usable = input.questions.filter((q) => q.verified);
  const byCategory = new Map<number, Question[]>();
  for (const q of usable) {
    const list = byCategory.get(q.categoryId) ?? [];
    list.push(q);
    byCategory.set(q.categoryId, list);
  }
  let eligible = [...byCategory.keys()];
  if (settings.pinnedCategories.length > 0) {
    eligible = eligible.filter((id) => settings.pinnedCategories.includes(id));
  }
  const categoryId = pickCategory(eligible, counters, (id) => weightOf(settings, id), rng);
  if (categoryId === null) return null;
  const difficulty = pickDifficulty(settings.baseDifficulty, settings.stretchPct, rng);
  const question = pickQuestion(byCategory.get(categoryId) as Question[], difficulty, lastSeen, rng);
  if (!question) return null;
  return { question, categoryId, difficulty };
}

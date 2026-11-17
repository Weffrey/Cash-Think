import { describe, expect, it } from "vitest";
import { CATEGORY_IDS } from "./categories";
import {
  computeCounters,
  countsTowardCategory,
  pickCategory,
  pickDifficulty,
  pickQuestion,
  selectNext,
  type Rng,
} from "./selector";
import { DEFAULT_SETTINGS, type Counters, type Question, type Settings } from "./types";

/** Small seeded generator so tests are repeatable. */
function seeded(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeQuestion(id: number, categoryId: number, difficulty = 1, verified = true): Question {
  return {
    id,
    categoryId,
    format: "mcq",
    difficulty,
    prompt: `q${id}`,
    options: ["a", "b"],
    correctOption: 0,
    optionReasons: ["x", "y"],
    correctValue: null,
    tolerance: null,
    unit: null,
    rubric: null,
    referenceCard: "ref",
    hints: [],
    shortAnswer: "s",
    steps: "s",
    theory: "t",
    intuition: "i",
    parentId: null,
    verified,
  };
}

/** One question per category at the given difficulty. */
function bank(difficulty = 1): Question[] {
  return CATEGORY_IDS.map((c) => makeQuestion(c, c, difficulty));
}

const settings = (over: Partial<Settings> = {}): Settings => ({ ...DEFAULT_SETTINGS, weights: {}, pinnedCategories: [], ...over });

describe("counting rule", () => {
  it("counts completed attempts below help level 3", () => {
    expect(countsTowardCategory({ outcome: "completed", helpLevel: 0 })).toBe(true);
    expect(countsTowardCategory({ outcome: "completed", helpLevel: 1 })).toBe(true);
    expect(countsTowardCategory({ outcome: "completed", helpLevel: 2 })).toBe(true);
  });

  it("does not count give-ups or solution-shown attempts", () => {
    expect(countsTowardCategory({ outcome: "gave_up", helpLevel: 0 })).toBe(false);
    expect(countsTowardCategory({ outcome: "completed", helpLevel: 3 })).toBe(false);
  });

  it("derives counters from attempts", () => {
    const counters = computeCounters([
      { categoryId: 1, outcome: "completed", helpLevel: 0 },
      { categoryId: 1, outcome: "completed", helpLevel: 2 },
      { categoryId: 1, outcome: "gave_up", helpLevel: 0 },
      { categoryId: 2, outcome: "completed", helpLevel: 3 },
      { categoryId: 3, outcome: "completed", helpLevel: 1 },
    ]);
    expect(counters).toEqual({ 1: 2, 3: 1 });
  });
});

describe("pickCategory", () => {
  const equal = () => 1;

  it("picks the category with the lowest count when weights are equal", () => {
    const counters: Counters = { 1: 5, 2: 5, 3: 2, 4: 5 };
    expect(pickCategory([1, 2, 3, 4], counters, equal, seeded(1))).toBe(3);
  });

  it("returns null when nothing is eligible", () => {
    expect(pickCategory([], {}, equal, seeded(1))).toBeNull();
    expect(pickCategory([1, 2], {}, () => 0, seeded(1))).toBeNull();
  });

  it("keeps counts within 1 of each other across many picks", () => {
    const rng = seeded(42);
    const counters: Counters = {};
    for (let i = 0; i < 1200; i++) {
      const c = pickCategory(CATEGORY_IDS, counters, equal, rng) as number;
      counters[c] = (counters[c] ?? 0) + 1;
    }
    const values = CATEGORY_IDS.map((c) => counters[c] ?? 0);
    expect(Math.max(...values) - Math.min(...values)).toBeLessThanOrEqual(1);
  });

  it("serves a category in proportion to its weight", () => {
    const rng = seeded(7);
    const counters: Counters = {};
    const weights = (id: number) => (id === 1 ? 2 : 1);
    for (let i = 0; i < 1300; i++) {
      const c = pickCategory(CATEGORY_IDS, counters, weights, rng) as number;
      counters[c] = (counters[c] ?? 0) + 1;
    }
    // weights sum to 13, so category 1 targets 200 and the others 100 each
    expect(Math.abs((counters[1] ?? 0) - 200)).toBeLessThanOrEqual(2);
    expect(Math.abs((counters[2] ?? 0) - 100)).toBeLessThanOrEqual(2);
  });

  it("ignores categories with weight 0", () => {
    const rng = seeded(3);
    const counters: Counters = {};
    const weights = (id: number) => (id === 5 ? 0 : 1);
    for (let i = 0; i < 100; i++) {
      const c = pickCategory(CATEGORY_IDS, counters, weights, rng) as number;
      expect(c).not.toBe(5);
      counters[c] = (counters[c] ?? 0) + 1;
    }
  });
});

describe("pickDifficulty", () => {
  it("returns the base level when stretch is 0", () => {
    const rng = seeded(1);
    for (let i = 0; i < 100; i++) expect(pickDifficulty(2, 0, rng)).toBe(2);
  });

  it("returns one level up when stretch is 100", () => {
    const rng = seeded(1);
    for (let i = 0; i < 100; i++) expect(pickDifficulty(2, 100, rng)).toBe(3);
  });

  it("never exceeds the maximum level", () => {
    const rng = seeded(1);
    for (let i = 0; i < 100; i++) expect(pickDifficulty(5, 100, rng)).toBe(5);
  });

  it("serves about the stretch percentage one level up", () => {
    const rng = seeded(11);
    let up = 0;
    for (let i = 0; i < 10000; i++) if (pickDifficulty(1, 20, rng) === 2) up++;
    expect(up / 10000).toBeGreaterThan(0.18);
    expect(up / 10000).toBeLessThan(0.22);
  });
});

describe("pickQuestion", () => {
  it("prefers unseen questions", () => {
    const pool = [makeQuestion(1, 1), makeQuestion(2, 1), makeQuestion(3, 1)];
    const lastSeen = new Map([[1, 100], [2, 200]]);
    expect(pickQuestion(pool, 1, lastSeen, seeded(1))?.id).toBe(3);
  });

  it("falls back to the least recently seen when all were seen", () => {
    const pool = [makeQuestion(1, 1), makeQuestion(2, 1), makeQuestion(3, 1)];
    const lastSeen = new Map([[1, 300], [2, 100], [3, 200]]);
    expect(pickQuestion(pool, 1, lastSeen, seeded(1))?.id).toBe(2);
  });

  it("uses the nearest difficulty when none match, preferring the lower one", () => {
    const pool = [makeQuestion(1, 1, 1), makeQuestion(2, 1, 3)];
    expect(pickQuestion(pool, 2, new Map(), seeded(1))?.id).toBe(1);
  });

  it("returns null for an empty pool", () => {
    expect(pickQuestion([], 1, new Map(), seeded(1))).toBeNull();
  });
});

describe("selectNext", () => {
  it("returns null when there are no verified questions", () => {
    const questions = [makeQuestion(1, 1, 1, false)];
    const out = selectNext({ questions, counters: {}, settings: settings(), lastSeen: new Map() }, seeded(1));
    expect(out).toBeNull();
  });

  it("only uses categories that have questions", () => {
    const questions = [makeQuestion(1, 4), makeQuestion(2, 9)];
    const rng = seeded(5);
    const counters: Counters = {};
    for (let i = 0; i < 20; i++) {
      const out = selectNext({ questions, counters, settings: settings(), lastSeen: new Map() }, rng);
      expect([4, 9]).toContain(out?.categoryId);
      counters[out!.categoryId] = (counters[out!.categoryId] ?? 0) + 1;
    }
    expect(counters[4]).toBe(10);
    expect(counters[9]).toBe(10);
  });

  it("restricts to pinned categories", () => {
    const rng = seeded(9);
    const s = settings({ pinnedCategories: [2, 3] });
    const counters: Counters = {};
    for (let i = 0; i < 30; i++) {
      const out = selectNext({ questions: bank(), counters, settings: s, lastSeen: new Map() }, rng);
      expect([2, 3]).toContain(out?.categoryId);
      counters[out!.categoryId] = (counters[out!.categoryId] ?? 0) + 1;
    }
  });

  it("catches up neglected categories after a pinned stretch", () => {
    const rng = seeded(13);
    const counters: Counters = {};
    const pinned = settings({ pinnedCategories: [1] });
    for (let i = 0; i < 24; i++) {
      const out = selectNext({ questions: bank(), counters, settings: pinned, lastSeen: new Map() }, rng)!;
      counters[out.categoryId] = (counters[out.categoryId] ?? 0) + 1;
    }
    expect(counters[1]).toBe(24);
    // Unpinned: the next 11 picks must all be different categories, none of them category 1.
    const seen = new Set<number>();
    for (let i = 0; i < 11; i++) {
      const out = selectNext({ questions: bank(), counters, settings: settings(), lastSeen: new Map() }, rng)!;
      expect(out.categoryId).not.toBe(1);
      seen.add(out.categoryId);
      counters[out.categoryId] = (counters[out.categoryId] ?? 0) + 1;
    }
    expect(seen.size).toBe(11);
  });

  it("serves at the base difficulty when stretch is 0", () => {
    const questions = [makeQuestion(1, 1, 1), makeQuestion(2, 1, 2)];
    const s = settings({ baseDifficulty: 1, stretchPct: 0 });
    const rng = seeded(2);
    for (let i = 0; i < 20; i++) {
      const out = selectNext({ questions, counters: {}, settings: s, lastSeen: new Map() }, rng);
      expect(out?.question.difficulty).toBe(1);
    }
  });
});

import { describe, expect, it } from "vitest";
import { SEED_QUESTIONS } from "../data/seed-questions";
import {
  getCounters,
  getLastSeen,
  getSettings,
  insertQuestion,
  listFavoriteIds,
  listQuestions,
  openDb,
  recordAttempt,
  saveSettings,
  setFavorite,
} from "./db";
import { selectNext } from "./selector";
import { DEFAULT_SETTINGS } from "./types";

function freshDb() {
  const db = openDb(":memory:");
  const ids = SEED_QUESTIONS.map((q) => insertQuestion(db, q));
  return { db, ids };
}

describe("database", () => {
  it("round-trips questions including JSON fields", () => {
    const { db } = freshDb();
    const all = listQuestions(db);
    expect(all).toHaveLength(SEED_QUESTIONS.length);
    const bayes = all.find((q) => q.prompt.startsWith("A disease affects"))!;
    expect(bayes.options).toHaveLength(4);
    expect(bayes.correctOption).toBe(2);
    expect(bayes.hints.length).toBeGreaterThan(0);
    expect(bayes.verified).toBe(true);
  });

  it("only returns verified questions when asked", () => {
    const { db } = freshDb();
    insertQuestion(db, { ...SEED_QUESTIONS[0], verified: false });
    expect(listQuestions(db, { verifiedOnly: true })).toHaveLength(SEED_QUESTIONS.length);
    expect(listQuestions(db)).toHaveLength(SEED_QUESTIONS.length + 1);
  });

  it("derives counters from attempts using the counting rule", () => {
    const { db, ids } = freshDb();
    const first = listQuestions(db)[0];
    recordAttempt(db, { questionId: first.id, outcome: "completed", helpLevel: 0 });
    recordAttempt(db, { questionId: first.id, outcome: "completed", helpLevel: 2 });
    recordAttempt(db, { questionId: first.id, outcome: "gave_up", helpLevel: 1 });
    recordAttempt(db, { questionId: first.id, outcome: "completed", helpLevel: 3 });
    expect(getCounters(db)).toEqual({ [first.categoryId]: 2 });
    expect(ids.length).toBeGreaterThan(0);
  });

  it("records the last time a question was seen, including give-ups", () => {
    const { db } = freshDb();
    const [a, b] = listQuestions(db);
    recordAttempt(db, { questionId: a.id, outcome: "gave_up", helpLevel: 1, createdAt: 1000 });
    recordAttempt(db, { questionId: a.id, outcome: "completed", helpLevel: 0, createdAt: 2000 });
    const seen = getLastSeen(db);
    expect(seen.get(a.id)).toBe(2000);
    expect(seen.has(b.id)).toBe(false);
  });

  it("rejects attempts for unknown questions", () => {
    const { db } = freshDb();
    expect(() => recordAttempt(db, { questionId: 9999, outcome: "completed", helpLevel: 0 })).toThrow();
  });

  it("returns default settings, then saves changes", () => {
    const { db } = freshDb();
    expect(getSettings(db)).toEqual(DEFAULT_SETTINGS);
    saveSettings(db, { ...DEFAULT_SETTINGS, baseDifficulty: 3, weights: { 1: 2 }, pinnedCategories: [4] });
    const s = getSettings(db);
    expect(s.baseDifficulty).toBe(3);
    expect(s.weights).toEqual({ 1: 2 });
    expect(s.pinnedCategories).toEqual([4]);
  });

  it("adds and removes favorites", () => {
    const { db } = freshDb();
    const [a, b] = listQuestions(db);
    setFavorite(db, a.id, true);
    setFavorite(db, b.id, true);
    setFavorite(db, a.id, true);
    expect(listFavoriteIds(db).sort()).toEqual([a.id, b.id].sort());
    setFavorite(db, a.id, false);
    expect(listFavoriteIds(db)).toEqual([b.id]);
  });

  it("runs the selector end to end against the seeded database", () => {
    const { db } = freshDb();
    let n = 0;
    const rng = () => {
      n = (n * 1103515245 + 12345) % 2147483648;
      return n / 2147483648;
    };
    const seenCategories = new Set<number>();
    for (let i = 0; i < 12; i++) {
      const out = selectNext(
        {
          questions: listQuestions(db, { verifiedOnly: true }),
          counters: getCounters(db),
          settings: getSettings(db),
          lastSeen: getLastSeen(db),
        },
        rng,
      );
      expect(out).not.toBeNull();
      recordAttempt(db, { questionId: out!.question.id, outcome: "completed", helpLevel: 0 });
      seenCategories.add(out!.categoryId);
    }
    // 12 seeded categories, 12 picks, so every category is served exactly once.
    expect(seenCategories.size).toBe(12);
  });
});

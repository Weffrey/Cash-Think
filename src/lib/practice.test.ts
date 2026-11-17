import { describe, expect, it } from "vitest";
import { SEED_QUESTIONS } from "../data/seed-questions";
import { getCounters, insertQuestion, listAttempts, listQuestions, openDb, saveSettings } from "./db";
import {
  applyAction,
  getAttemptState,
  helpLevelOf,
  PracticeError,
  startAttempt,
  startNextAttempt,
  toPublicQuestion,
  type AttemptState,
} from "./practice";
import { expectNoLeak } from "./test-helpers";
import { DEFAULT_SETTINGS, type Question } from "./types";

function freshDb() {
  const db = openDb(":memory:");
  for (const q of SEED_QUESTIONS) insertQuestion(db, q);
  const all = listQuestions(db);
  const byFormat = (f: Question["format"]) => all.find((q) => q.format === f)!;
  return { db, all, mcq: byFormat("mcq"), numeric: byFormat("numeric"), long: byFormat("long") };
}

describe("no-leak guarantee", () => {
  it("the public question has none of the secret fields, for every seed question", () => {
    const { all } = freshDb();
    for (const q of all) expectNoLeak(toPublicQuestion(q), q);
  });

  it("a fresh attempt state contains no answer, breakdown, reference card, or hints, for every seed question", () => {
    const { db, all } = freshDb();
    for (const q of all) {
      const state = startAttempt(db, q.id);
      expect(state.phase).toBe("open");
      expect(state.reveal).toBeNull();
      expect(state.result).toBeNull();
      expect(state.reference).toBeNull();
      expect(state.hints).toEqual([]);
      expect(state.hintsTotal).toBe(q.hints.length);
      // reveal is null and reference is null, so the walk only meets allowed keys
      expectNoLeak({ ...state, reveal: undefined }, q);
      expect(state.question.prompt).toBe(q.prompt);
    }
  });

  it("opening the reference reveals only the reference; a hint reveals only that hint", () => {
    const { db, mcq } = freshDb();
    let s = startAttempt(db, mcq.id);
    s = applyAction(db, s.attemptId, { type: "reference" });
    expect(s.reference).toBe(mcq.referenceCard);
    expect(s.reveal).toBeNull();
    const text = JSON.stringify(s);
    for (const secret of [mcq.shortAnswer, mcq.steps, mcq.theory, mcq.intuition, ...mcq.hints, ...mcq.optionReasons!]) {
      expect(text).not.toContain(JSON.stringify(secret).slice(1, -1));
    }
    s = applyAction(db, s.attemptId, { type: "hint" });
    expect(s.hints).toEqual([mcq.hints[0]]);
    expect(s.reveal).toBeNull();
    if (mcq.hints.length > 1) expect(JSON.stringify(s)).not.toContain(JSON.stringify(mcq.hints[1]).slice(1, -1));
  });
});

describe("help level", () => {
  it("is the highest help used", () => {
    expect(helpLevelOf({ referenceOpened: false, hintsRevealed: 0 })).toBe(0);
    expect(helpLevelOf({ referenceOpened: true, hintsRevealed: 0 })).toBe(1);
    expect(helpLevelOf({ referenceOpened: false, hintsRevealed: 1 })).toBe(2);
    expect(helpLevelOf({ referenceOpened: true, hintsRevealed: 3 })).toBe(2);
  });

  it("is tracked on the server and never goes down", () => {
    const { db, mcq } = freshDb();
    let s = startAttempt(db, mcq.id);
    expect(s.helpLevel).toBe(0);
    s = applyAction(db, s.attemptId, { type: "hint" });
    expect(s.helpLevel).toBe(2);
    s = applyAction(db, s.attemptId, { type: "reference" });
    expect(s.helpLevel).toBe(2);
    // a reload reads the same state back from the server
    expect(getAttemptState(db, s.attemptId).helpLevel).toBe(2);
  });

  it("reveals hints one at a time with no cap, and stops quietly at the last one", () => {
    const { db } = freshDb();
    const id = insertQuestion(db, { ...SEED_QUESTIONS[0], prompt: "many hints", hints: ["h1", "h2", "h3", "h4", "h5", "h6", "h7"] });
    let s = startAttempt(db, id);
    for (let i = 1; i <= 7; i++) {
      s = applyAction(db, s.attemptId, { type: "hint" });
      expect(s.hints).toHaveLength(i);
    }
    s = applyAction(db, s.attemptId, { type: "hint" });
    expect(s.hints).toEqual(["h1", "h2", "h3", "h4", "h5", "h6", "h7"]);
    expect(s.helpLevel).toBe(2);
  });

  it("freezes at the moment of answering: help opened afterwards does not change the recorded level", () => {
    const { db, mcq } = freshDb();
    let s = startAttempt(db, mcq.id);
    s = applyAction(db, s.attemptId, { type: "answer", option: mcq.correctOption! });
    expect(s.result!.helpLevel).toBe(0);
    s = applyAction(db, s.attemptId, { type: "reference" });
    s = applyAction(db, s.attemptId, { type: "hint" });
    expect(s.helpLevel).toBe(0);
    expect(s.result!.helpLevel).toBe(0);
    expect(listAttempts(db)[0].helpLevel).toBe(0);
    expect(s.reference).toBe(mcq.referenceCard);
  });
});

describe("attempt state machine", () => {
  it("mcq: a correct answer is completed, correct, counted, and reveals everything", () => {
    const { db, mcq } = freshDb();
    let s = startAttempt(db, mcq.id, 1_000);
    s = applyAction(db, s.attemptId, { type: "answer", option: mcq.correctOption! }, 31_000);
    expect(s.phase).toBe("done");
    expect(s.result).toEqual({ outcome: "completed", correct: true, helpLevel: 0, durationMs: 30_000, counted: true });
    expect(s.reveal!.correctOption).toBe(mcq.correctOption);
    expect(s.reveal!.optionReasons).toEqual(mcq.optionReasons);
    expect(s.reveal!.steps).toBe(mcq.steps);
    expect(s.submitted).toEqual({ option: mcq.correctOption });
    expect(getCounters(db)).toEqual({ [mcq.categoryId]: 1 });
  });

  it("mcq: a wrong answer is completed and counted, but marked wrong", () => {
    const { db, mcq } = freshDb();
    const wrong = (mcq.correctOption! + 1) % mcq.options!.length;
    let s = startAttempt(db, mcq.id);
    s = applyAction(db, s.attemptId, { type: "answer", option: wrong });
    expect(s.result!.outcome).toBe("completed");
    expect(s.result!.correct).toBe(false);
    expect(s.result!.counted).toBe(true);
  });

  it("mcq: rejects a missing or out-of-range option without finishing the attempt", () => {
    const { db, mcq } = freshDb();
    const s = startAttempt(db, mcq.id);
    for (const option of [undefined, -1, mcq.options!.length, 1.5, "1"]) {
      expect(() => applyAction(db, s.attemptId, { type: "answer", option })).toThrow(PracticeError);
    }
    expect(getAttemptState(db, s.attemptId).phase).toBe("open");
    expect(listAttempts(db)).toHaveLength(0);
  });

  it("numeric: checks typed text with the stored tolerance", () => {
    const { db, numeric } = freshDb();
    // the first numeric seed question is the two-dice question: 1/6 with 1% tolerance
    expect(numeric.correctValue).toBeCloseTo(1 / 6, 12);
    let s = startAttempt(db, numeric.id);
    s = applyAction(db, s.attemptId, { type: "answer", value: "1/6" });
    expect(s.result!.correct).toBe(true);
    expect(s.reveal!.correctValue).toBeCloseTo(1 / 6, 12);
    expect(s.submitted!.value).toBeCloseTo(1 / 6, 12);

    s = startAttempt(db, numeric.id);
    s = applyAction(db, s.attemptId, { type: "answer", value: "0.167" });
    expect(s.result!.correct).toBe(true);

    s = startAttempt(db, numeric.id);
    s = applyAction(db, s.attemptId, { type: "answer", value: "0.17" });
    expect(s.result!.correct).toBe(false);
    expect(s.result!.outcome).toBe("completed");
  });

  it("numeric: handles a correct value of 0", () => {
    const { db } = freshDb();
    const id = insertQuestion(db, { ...SEED_QUESTIONS[0], prompt: "zero answer", correctValue: 0, tolerance: 0.01 });
    let s = applyAction(db, startAttempt(db, id).attemptId, { type: "answer", value: "0" });
    expect(s.result!.correct).toBe(true);
    s = applyAction(db, startAttempt(db, id).attemptId, { type: "answer", value: "0.005" });
    expect(s.result!.correct).toBe(true);
    s = applyAction(db, startAttempt(db, id).attemptId, { type: "answer", value: "0.5" });
    expect(s.result!.correct).toBe(false);
  });

  it("numeric: rejects text that is not a number without finishing the attempt", () => {
    const { db, numeric } = freshDb();
    const s = startAttempt(db, numeric.id);
    for (const value of ["", "abc", undefined, null]) {
      expect(() => applyAction(db, s.attemptId, { type: "answer", value })).toThrow(PracticeError);
    }
    expect(getAttemptState(db, s.attemptId).phase).toBe("open");
  });

  it("long: submit reveals the solution and rubric, then the ticks decide right or wrong", () => {
    const { db, long } = freshDb();
    let s = startAttempt(db, long.id);
    expect(() => applyAction(db, s.attemptId, { type: "answer", text: "   " })).toThrow(PracticeError);
    s = applyAction(db, s.attemptId, { type: "answer", text: "HH takes 6, HT takes 4." });
    expect(s.phase).toBe("self_check");
    expect(s.reveal!.rubric).toEqual(long.rubric);
    expect(s.reveal!.ticksNeeded).toBe(2);
    // completed as soon as it is submitted, result still open
    expect(s.result).toMatchObject({ outcome: "completed", correct: null, counted: true });
    expect(getCounters(db)).toEqual({ [long.categoryId]: 1 });

    expect(() => applyAction(db, s.attemptId, { type: "self_check", ticks: [true] })).toThrow(PracticeError);
    s = applyAction(db, s.attemptId, { type: "self_check", ticks: [true, true, false] });
    expect(s.phase).toBe("done");
    expect(s.result!.correct).toBe(true);
    expect(s.ticks).toEqual([true, true, false]);
    expect(listAttempts(db)).toHaveLength(1);

    let t = startAttempt(db, long.id);
    t = applyAction(db, t.attemptId, { type: "answer", text: "no idea" });
    t = applyAction(db, t.attemptId, { type: "self_check", ticks: [true, false, false] });
    expect(t.result).toMatchObject({ outcome: "completed", correct: false, counted: true });
  });

  it("give up records gave_up with the help level used so far, and does not count", () => {
    const { db, mcq } = freshDb();
    let s = startAttempt(db, mcq.id);
    s = applyAction(db, s.attemptId, { type: "reference" });
    s = applyAction(db, s.attemptId, { type: "give_up" });
    expect(s.phase).toBe("done");
    expect(s.result).toMatchObject({ outcome: "gave_up", correct: null, helpLevel: 1, counted: false });
    expect(s.reveal!.shortAnswer).toBe(mcq.shortAnswer);
    expect(getCounters(db)).toEqual({});
  });

  it("show solution records gave_up with help level 3, and does not count", () => {
    const { db, numeric } = freshDb();
    let s = startAttempt(db, numeric.id);
    s = applyAction(db, s.attemptId, { type: "solution" });
    expect(s.result).toMatchObject({ outcome: "gave_up", helpLevel: 3, counted: false });
    expect(s.helpLevel).toBe(3);
    expect(s.reveal!.correctValue).toBe(numeric.correctValue);
    expect(getCounters(db)).toEqual({});
    expect(listAttempts(db)[0]).toMatchObject({ outcome: "gave_up", helpLevel: 3 });
  });

  it("a finished attempt cannot be answered, given up, or shown again", () => {
    const { db, mcq } = freshDb();
    let s = startAttempt(db, mcq.id);
    s = applyAction(db, s.attemptId, { type: "solution" });
    expect(() => applyAction(db, s.attemptId, { type: "answer", option: mcq.correctOption! })).toThrow(/already finished/);
    expect(() => applyAction(db, s.attemptId, { type: "give_up" })).toThrow(PracticeError);
    expect(() => applyAction(db, s.attemptId, { type: "solution" })).toThrow(PracticeError);
    expect(() => applyAction(db, s.attemptId, { type: "self_check", ticks: [] })).toThrow(PracticeError);
    // still exactly one attempt, still not counted
    expect(listAttempts(db)).toHaveLength(1);
    expect(getCounters(db)).toEqual({});
  });

  it("assisted answers (reference, hints) still count, with the level recorded", () => {
    const { db, mcq } = freshDb();
    let s = startAttempt(db, mcq.id);
    s = applyAction(db, s.attemptId, { type: "hint" });
    s = applyAction(db, s.attemptId, { type: "answer", option: mcq.correctOption! });
    expect(s.result).toMatchObject({ outcome: "completed", helpLevel: 2, counted: true });
    expect(getCounters(db)).toEqual({ [mcq.categoryId]: 1 });
  });

  it("records time from the server clock, and accepts a smaller active time from the browser", () => {
    const { db, mcq } = freshDb();
    let s = startAttempt(db, mcq.id, 0);
    s = applyAction(db, s.attemptId, { type: "give_up" }, 90_000);
    expect(s.result!.durationMs).toBe(90_000);

    s = startAttempt(db, mcq.id, 0);
    s = applyAction(db, s.attemptId, { type: "give_up", activeMs: 20_000 }, 90_000);
    expect(s.result!.durationMs).toBe(20_000);

    // the browser cannot claim more time than really passed
    s = startAttempt(db, mcq.id, 0);
    s = applyAction(db, s.attemptId, { type: "give_up", activeMs: 999_999_999 }, 90_000);
    expect(s.result!.durationMs).toBe(90_000);
  });

  it("rejects unknown attempts, unknown questions, and unknown actions", () => {
    const { db, mcq } = freshDb();
    expect(() => getAttemptState(db, "nope")).toThrow(PracticeError);
    expect(() => startAttempt(db, 99999)).toThrow(PracticeError);
    const s = startAttempt(db, mcq.id);
    expect(() => applyAction(db, s.attemptId, { type: "explode" } as never)).toThrow(PracticeError);
  });
});

describe("startNextAttempt", () => {
  it("serves a question through the selector and never an unverified one", () => {
    const { db } = freshDb();
    const unverified = insertQuestion(db, { ...SEED_QUESTIONS[0], prompt: "generated, unverified", verified: false, parentId: 1 });
    const served = new Set<number>();
    for (let i = 0; i < 200; i++) {
      const s = startNextAttempt(db) as AttemptState;
      served.add(s.question.id);
      applyAction(db, s.attemptId, { type: "give_up" });
    }
    expect(served.has(unverified)).toBe(false);
    expect(served.size).toBeGreaterThan(20);
  });

  it("returns null when no category is eligible", () => {
    const { db } = freshDb();
    const weights: Record<number, number> = {};
    for (let id = 1; id <= 12; id++) weights[id] = 0;
    saveSettings(db, { ...DEFAULT_SETTINGS, weights });
    expect(startNextAttempt(db)).toBeNull();
  });

  it("an unverified question can still be opened directly and is flagged", () => {
    const { db } = freshDb();
    const id = insertQuestion(db, { ...SEED_QUESTIONS[0], prompt: "generated, unverified", verified: false, parentId: 1 });
    const s = startAttempt(db, id);
    expect(s.question.verified).toBe(false);
    expect(s.question.parentId).toBe(1);
    expect(getAttemptState(db, startAttempt(db, 1).attemptId).childId).toBe(id);
  });
});

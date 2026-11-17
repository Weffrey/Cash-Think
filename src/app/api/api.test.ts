/**
 * Tests that go through the real route handlers (the same functions Next.js calls),
 * against an in-memory database.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/server", () => ({ connection: async () => undefined }));

import { getQuestion, insertQuestion, listAiCalls, listQuestions } from "@/lib/db";
import type { AttemptState } from "@/lib/practice";
import { getDb, resetDbForTests } from "@/lib/server-db";
import { expectNoLeak } from "@/lib/test-helpers";
import type { Question } from "@/lib/types";
import * as attemptRoute from "./attempts/[id]/route";
import * as chatRoute from "./attempts/[id]/chat/route";
import * as attemptsRoute from "./attempts/route";
import * as favoritesRoute from "./favorites/route";
import * as nextRoute from "./next/route";
import * as favoriteRoute from "./questions/[id]/favorite/route";
import * as upgradeRoute from "./questions/[id]/upgrade/route";
import * as settingsRoute from "./settings/route";
import * as statsRoute from "./stats/route";

const post = (body?: unknown) =>
  new Request("http://localhost/api", { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });
const ctx = (id: string | number) => ({ params: Promise.resolve({ id: String(id) }) });

async function open(questionId: number): Promise<AttemptState> {
  const res = await attemptsRoute.POST(post({ questionId }));
  expect(res.status).toBe(200);
  return ((await res.json()) as { attempt: AttemptState }).attempt;
}
async function act(attemptId: string, body: unknown): Promise<{ status: number; attempt: AttemptState; error?: string }> {
  const res = await attemptRoute.POST(post(body), ctx(attemptId));
  const data = (await res.json()) as { attempt: AttemptState; error?: string };
  return { status: res.status, ...data };
}
async function balance() {
  const res = await settingsRoute.GET();
  const data = (await res.json()) as { balance: Array<{ categoryId: number; count: number; delta: number | null }> };
  return data.balance;
}
const countOf = async (categoryId: number) => (await balance()).find((b) => b.categoryId === categoryId)!.count;
const first = (format: Question["format"]) => listQuestions(getDb()).find((q) => q.format === format)!;

beforeEach(() => {
  process.env.DB_PATH = ":memory:";
  delete process.env.GROQ_API_KEY;
  delete process.env.GROQ_MODEL;
  delete process.env.GROQ_BASE_URL;
  resetDbForTests();
  vi.unstubAllGlobals();
});

describe("no-leak guarantee through the API", () => {
  it("POST /api/next sends a fresh attempt with no answer, breakdown, reference, or hints", async () => {
    for (let i = 0; i < 30; i++) {
      const res = await nextRoute.POST();
      const raw = await res.text();
      const { attempt } = JSON.parse(raw) as { attempt: AttemptState };
      const q = getQuestion(getDb(), attempt.question.id)!;
      expect(attempt.reveal).toBeNull();
      expect(attempt.reference).toBeNull();
      expect(attempt.hints).toEqual([]);
      expectNoLeak(JSON.parse(raw.replace('"reveal":null,', "")), q);
      // give up so the selector moves on to other questions
      await act(attempt.attemptId, { type: "give_up" });
    }
  });

  it("POST /api/attempts and GET /api/attempts/[id] leak nothing for any question in the bank", async () => {
    for (const q of listQuestions(getDb())) {
      const attempt = await open(q.id);
      expectNoLeak({ ...attempt, reveal: undefined }, q);
      expect(attempt.reveal).toBeNull();
      const res = await attemptRoute.GET(new Request("http://localhost/api"), ctx(attempt.attemptId));
      const again = ((await res.json()) as { attempt: AttemptState }).attempt;
      expectNoLeak({ ...again, reveal: undefined }, q);
      expect(again.reveal).toBeNull();
    }
  });

  it("the favorites list contains prompts only", async () => {
    const q = first("mcq");
    await favoriteRoute.POST(post({ on: true }), ctx(q.id));
    const res = await favoritesRoute.GET();
    const data = (await res.json()) as { favorites: Array<{ question: { id: number } }> };
    expect(data.favorites.map((f) => f.question.id)).toEqual([q.id]);
    expectNoLeak(data, q);
  });

  it("a client cannot ask for the solution without the action being recorded", async () => {
    const q = first("numeric");
    const attempt = await open(q.id);
    // made-up action names and extra fields do nothing
    const bad = await act(attempt.attemptId, { type: "reveal", reveal: true, phase: "done", helpLevel: 0 });
    expect(bad.status).toBe(400);
    const shown = await act(attempt.attemptId, { type: "solution" });
    expect(shown.attempt.reveal!.correctValue).toBe(q.correctValue);
    expect(shown.attempt.result).toMatchObject({ outcome: "gave_up", helpLevel: 3, counted: false });
  });
});

describe("counting rule through the API", () => {
  it("completed answers count; giving up and showing the solution do not", async () => {
    const q = first("mcq");
    expect(await countOf(q.categoryId)).toBe(0);

    // independent correct answer: counts
    let a = await open(q.id);
    await act(a.attemptId, { type: "answer", option: q.correctOption });
    expect(await countOf(q.categoryId)).toBe(1);

    // give up: does not count
    a = await open(q.id);
    await act(a.attemptId, { type: "give_up" });
    expect(await countOf(q.categoryId)).toBe(1);

    // show solution before answering: does not count, and cannot be answered afterwards
    a = await open(q.id);
    await act(a.attemptId, { type: "solution" });
    const late = await act(a.attemptId, { type: "answer", option: q.correctOption });
    expect(late.status).toBe(409);
    expect(await countOf(q.categoryId)).toBe(1);

    // reference then hint then answer: counts, flagged as hinted
    a = await open(q.id);
    await act(a.attemptId, { type: "reference" });
    await act(a.attemptId, { type: "hint" });
    const done = await act(a.attemptId, { type: "answer", option: q.correctOption });
    expect(done.attempt.result).toMatchObject({ helpLevel: 2, counted: true });
    expect(await countOf(q.categoryId)).toBe(2);

    // a wrong answer is still a completed question
    a = await open(q.id);
    const wrong = await act(a.attemptId, { type: "answer", option: (q.correctOption! + 1) % q.options!.length });
    expect(wrong.attempt.result).toMatchObject({ outcome: "completed", correct: false, counted: true });
    expect(await countOf(q.categoryId)).toBe(3);

    const stats = (await (await statsRoute.GET()).json()) as {
      categories: Array<{ categoryId: number; independent: number; hinted: number; theoryHelp: number; notCounted: number }>;
      history: Array<{ outcome: string; helpLevel: number }>;
    };
    expect(stats.categories.find((c) => c.categoryId === q.categoryId)).toMatchObject({
      independent: 2,
      theoryHelp: 0,
      hinted: 1,
      notCounted: 2,
    });
    expect(stats.history).toHaveLength(5);
    expect(stats.history.filter((h) => h.helpLevel === 3)).toHaveLength(1);
  });

  it("the help level sent by the client is ignored", async () => {
    const q = first("mcq");
    const a = await open(q.id);
    await act(a.attemptId, { type: "hint" });
    const done = await act(a.attemptId, { type: "answer", option: q.correctOption, helpLevel: 0, hintsRevealed: 0 });
    expect(done.attempt.result!.helpLevel).toBe(2);
  });

  it("a long answer counts on submit and the self-check sets right or wrong", async () => {
    const q = first("long");
    let a = await open(q.id);
    const submitted = await act(a.attemptId, { type: "answer", text: "my reasoning" });
    expect(submitted.attempt.phase).toBe("self_check");
    expect(await countOf(q.categoryId)).toBe(1);
    const checked = await act(a.attemptId, { type: "self_check", ticks: q.rubric!.map(() => true) });
    expect(checked.attempt.result).toMatchObject({ outcome: "completed", correct: true });
    expect(await countOf(q.categoryId)).toBe(1);

    a = await open(q.id);
    const empty = await act(a.attemptId, { type: "answer", text: "" });
    expect(empty.status).toBe(400);
  });

  it("returns 404 for an unknown attempt", async () => {
    const res = await act("does-not-exist", { type: "hint" });
    expect(res.status).toBe(404);
  });
});

describe("settings API", () => {
  it("saves valid settings and reports the balance against target shares", async () => {
    const res = await settingsRoute.PUT(
      new Request("http://localhost/api", {
        method: "PUT",
        body: JSON.stringify({ baseDifficulty: 2, stretchPct: 35, weights: { 1: 2, 3: 0, 5: 1 }, pinnedCategories: [4, 1, 4] }),
      }),
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      settings: { baseDifficulty: number; stretchPct: number; weights: Record<string, number>; pinnedCategories: number[] };
      balance: Array<{ categoryId: number; share: number; target: number | null }>;
      bank: Record<string, number>;
    };
    expect(data.settings).toEqual({ baseDifficulty: 2, stretchPct: 35, weights: { 1: 2, 3: 0 }, pinnedCategories: [1, 4] });
    // 12 categories: one has weight 2, one is excluded, ten have weight 1, so the weights sum to 12
    expect(data.balance.find((b) => b.categoryId === 1)!.share).toBeCloseTo(2 / 12, 12);
    expect(data.balance.find((b) => b.categoryId === 3)).toMatchObject({ share: 0, target: null });
    expect(Object.values(data.bank).reduce((a, b) => a + b, 0)).toBe(listQuestions(getDb(), { verifiedOnly: true }).length);
  });

  it("rejects invalid settings and keeps the old ones", async () => {
    for (const body of [
      { baseDifficulty: 0, stretchPct: 20 },
      { baseDifficulty: 6, stretchPct: 20 },
      { baseDifficulty: 2.5, stretchPct: 20 },
      { baseDifficulty: 1, stretchPct: 101 },
      { baseDifficulty: 1, stretchPct: 20, weights: { 1: -1 } },
      { baseDifficulty: 1, stretchPct: 20, weights: { 99: 1 } },
      { baseDifficulty: 1, stretchPct: 20, pinnedCategories: [13] },
      "nonsense",
    ]) {
      const res = await settingsRoute.PUT(new Request("http://localhost/api", { method: "PUT", body: JSON.stringify(body) }));
      expect(res.status).toBe(400);
    }
    const data = (await (await settingsRoute.GET()).json()) as { settings: { baseDifficulty: number } };
    expect(data.settings.baseDifficulty).toBe(1);
  });

  it("a pinned category is the only one served", async () => {
    await settingsRoute.PUT(
      new Request("http://localhost/api", {
        method: "PUT",
        body: JSON.stringify({ baseDifficulty: 1, stretchPct: 0, weights: {}, pinnedCategories: [7] }),
      }),
    );
    for (let i = 0; i < 8; i++) {
      const { attempt } = (await (await nextRoute.POST()).json()) as { attempt: AttemptState };
      expect(attempt.question.categoryId).toBe(7);
      await act(attempt.attemptId, { type: "give_up" });
    }
  });
});

describe("favorites API", () => {
  it("adds and removes a favorite and reflects it in the attempt state", async () => {
    const q = first("numeric");
    let res = await favoriteRoute.POST(post({ on: true }), ctx(q.id));
    expect(await res.json()).toEqual({ favorite: true });
    expect((await open(q.id)).favorite).toBe(true);
    res = await favoriteRoute.POST(post({ on: false }), ctx(q.id));
    expect(await res.json()).toEqual({ favorite: false });
    expect((await open(q.id)).favorite).toBe(false);
    res = await favoriteRoute.POST(post({ on: true }), ctx(987654));
    expect(res.status).toBe(404);
  });
});

describe("AI features without a key", () => {
  it("the attempt reports AI as disabled, and chat and upgrade answer 503 without crashing", async () => {
    const q = first("mcq");
    const a = await open(q.id);
    expect(a.ai.enabled).toBe(false);
    const chat = await chatRoute.POST(post({ message: "help" }), ctx(a.attemptId));
    expect(chat.status).toBe(503);
    expect(((await chat.json()) as { code: string }).code).toBe("ai_disabled");
    const up = await upgradeRoute.POST(post(), ctx(q.id));
    expect(up.status).toBe(503);
    expect(listAiCalls(getDb())).toHaveLength(0);
  });

  it("upgrade opens an existing harder version without needing the AI", async () => {
    const q = first("mcq");
    const childId = insertQuestion(getDb(), { ...q, prompt: "harder version", difficulty: q.difficulty + 1, parentId: q.id, verified: false });
    const up = await upgradeRoute.POST(post(), ctx(q.id));
    expect(up.status).toBe(200);
    expect(await up.json()).toEqual({ questionId: childId, created: false });
  });
});

describe("AI features with a key (provider mocked)", () => {
  const reply = (content: string) =>
    new Response(
      JSON.stringify({
        model: "openai/gpt-oss-120b",
        choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }],
        usage: { prompt_tokens: 321, completion_tokens: 45, total_tokens: 366 },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );

  it("chat stores both messages, logs the call, and never changes the help level or the counters", async () => {
    process.env.GROQ_API_KEY = "test-key";
    const fetchMock = vi.fn(async () => reply("What does the product rule say?"));
    vi.stubGlobal("fetch", fetchMock);
    const q = first("numeric");
    const a = await open(q.id);
    const res = await chatRoute.POST(post({ message: "I am stuck" }), ctx(a.attemptId));
    expect(res.status).toBe(200);
    const raw = await res.text();
    expect(raw).not.toContain("test-key");
    expect((JSON.parse(raw) as { chat: unknown }).chat).toEqual([
      { role: "user", content: "I am stuck" },
      { role: "assistant", content: "What does the product rule say?" },
    ]);
    const state = ((await (await attemptRoute.GET(new Request("http://localhost/api"), ctx(a.attemptId))).json()) as { attempt: AttemptState })
      .attempt;
    expect(state.helpLevel).toBe(0);
    expect(state.phase).toBe("open");
    expect(state.reveal).toBeNull();
    expect(state.chat).toHaveLength(2);
    expect(state.ai.enabled).toBe(true);
    expect(JSON.stringify(state)).not.toContain("test-key");
    expect(await countOf(q.categoryId)).toBe(0);
    expect(listAiCalls(getDb())).toEqual([
      { purpose: "chat", provider: "groq", model: "openai/gpt-oss-120b", inputTokens: 321, outputTokens: 45 },
    ]);
    // answering afterwards is still independent
    const done = await act(a.attemptId, { type: "answer", value: String(q.correctValue) });
    expect(done.attempt.result).toMatchObject({ helpLevel: 0, correct: true, counted: true });
  });

  it("upgrade saves a validated, unverified child and the selector never serves it", async () => {
    process.env.GROQ_API_KEY = "test-key";
    const q = first("numeric");
    const generated = {
      prompt: "Three fair dice are rolled. What is the probability that the sum is 10?",
      options: null,
      correctOption: null,
      optionReasons: null,
      correctValue: 0.125,
      tolerance: 0.01,
      unit: null,
      rubric: null,
      referenceCard: "Count favorable outcomes over 216.",
      hints: ["Count ordered triples."],
      shortAnswer: "27/216 = 0.125.",
      steps: "1. 216 outcomes.\n2. 27 sum to 10.",
      theory: "Classical probability.",
      intuition: "10 and 11 are the most likely sums.",
    };
    vi.stubGlobal("fetch", vi.fn(async () => reply(JSON.stringify(generated))));
    const up = await upgradeRoute.POST(post(), ctx(q.id));
    expect(up.status).toBe(200);
    const { questionId, created } = (await up.json()) as { questionId: number; created: boolean };
    expect(created).toBe(true);
    const child = getQuestion(getDb(), questionId)!;
    expect(child).toMatchObject({
      parentId: q.id,
      verified: false,
      difficulty: q.difficulty + 1,
      categoryId: q.categoryId,
      format: "numeric",
      correctValue: 0.125,
    });
    expect(listAiCalls(getDb()).map((c) => c.purpose)).toEqual(["upgrade"]);

    // opening it works and shows it as unverified, without leaking its answer
    const a = await open(questionId);
    expect(a.question.verified).toBe(false);
    expectNoLeak({ ...a, reveal: undefined }, child);

    // the selector never serves it
    for (let i = 0; i < 150; i++) {
      const { attempt } = (await (await nextRoute.POST()).json()) as { attempt: AttemptState };
      expect(attempt.question.id).not.toBe(questionId);
      await act(attempt.attemptId, { type: "give_up" });
    }

    // a second press reuses the child and makes no new AI call
    const again = await upgradeRoute.POST(post(), ctx(q.id));
    expect(await again.json()).toEqual({ questionId, created: false });
    expect(listAiCalls(getDb())).toHaveLength(1);
  });

  it("malformed model output is rejected with a clear message and nothing is saved", async () => {
    process.env.GROQ_API_KEY = "test-key";
    const q = first("mcq");
    const before = listQuestions(getDb()).length;
    for (const bad of ["Sure! Here is a harder question:", "{\"prompt\": \"x\"}", "[1,2,3]", "{\"prompt\": 5, \"options\": \"no\"}"]) {
      vi.stubGlobal("fetch", vi.fn(async () => reply(bad)));
      const up = await upgradeRoute.POST(post(), ctx(q.id));
      expect(up.status).toBe(502);
      expect(((await up.json()) as { error: string }).error).toMatch(/did not pass validation/);
    }
    expect(listQuestions(getDb())).toHaveLength(before);
  });

  it("provider failures become friendly errors", async () => {
    process.env.GROQ_API_KEY = "test-key";
    const q = first("mcq");
    const a = await open(q.id);
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 429 })));
    let res = await chatRoute.POST(post({ message: "hi" }), ctx(a.attemptId));
    expect(res.status).toBe(429);
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("network down"); }));
    res = await chatRoute.POST(post({ message: "hi" }), ctx(a.attemptId));
    expect(res.status).toBe(502);
    // failed calls leave no half-written chat
    const state = ((await (await attemptRoute.GET(new Request("http://localhost/api"), ctx(a.attemptId))).json()) as { attempt: AttemptState })
      .attempt;
    expect(state.chat).toEqual([]);
  });
});

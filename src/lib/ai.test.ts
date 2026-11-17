import { describe, expect, it, vi } from "vitest";
import { SEED_QUESTIONS } from "../data/seed-questions";
import { AiError, aiStatus, complete } from "./ai";
import { computeBalance, normalizeSettings } from "./balance";
import { buildTutorMessages, CHAT_HISTORY_LIMIT } from "./tutor";
import { DEFAULT_SETTINGS, type Question } from "./types";
import { buildUpgradeMessages, parseGeneratedQuestion } from "./upgrade";

const asQuestion = (i: number, id = i + 1): Question => ({ ...SEED_QUESTIONS[i], id });
const MCQ = asQuestion(SEED_QUESTIONS.findIndex((q) => q.format === "mcq"));
const NUMERIC = asQuestion(SEED_QUESTIONS.findIndex((q) => q.format === "numeric"));
const LONG = asQuestion(SEED_QUESTIONS.findIndex((q) => q.format === "long"));

describe("aiStatus", () => {
  it("is disabled without a key and uses the default model", () => {
    expect(aiStatus({})).toEqual({ enabled: false, provider: "groq", model: "openai/gpt-oss-120b" });
    expect(aiStatus({ GROQ_API_KEY: "   " }).enabled).toBe(false);
  });

  it("is enabled with a key and honors the model override", () => {
    expect(aiStatus({ GROQ_API_KEY: "k", GROQ_MODEL: "llama-3.3-70b-versatile" })).toEqual({
      enabled: true,
      provider: "groq",
      model: "llama-3.3-70b-versatile",
    });
  });
});

describe("complete", () => {
  const okResponse = () =>
    new Response(
      JSON.stringify({
        model: "openai/gpt-oss-120b",
        choices: [{ message: { role: "assistant", content: "hello" } }],
        usage: { prompt_tokens: 12, completion_tokens: 3 },
      }),
      { status: 200 },
    );

  it("throws a disabled error without calling the network when there is no key", async () => {
    const fetchMock = vi.fn();
    await expect(complete({ messages: [], maxTokens: 10 }, { env: {}, fetch: fetchMock })).rejects.toMatchObject({
      kind: "disabled",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends the documented Groq request shape and reads text and token usage", async () => {
    const fetchMock = vi.fn(async (...args: [string, RequestInit]) => {
      void args;
      return okResponse();
    });
    const out = await complete(
      { messages: [{ role: "user", content: "hi" }], maxTokens: 77, json: true },
      { env: { GROQ_API_KEY: "secret-key" }, fetch: fetchMock as unknown as typeof fetch },
    );
    expect(out).toEqual({ text: "hello", provider: "groq", model: "openai/gpt-oss-120b", inputTokens: 12, outputTokens: 3 });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.groq.com/openai/v1/chat/completions");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer secret-key");
    expect(JSON.parse(init.body as string)).toEqual({
      model: "openai/gpt-oss-120b",
      messages: [{ role: "user", content: "hi" }],
      max_completion_tokens: 77,
      temperature: 0.4,
      stream: false,
      response_format: { type: "json_object" },
      reasoning_effort: "low",
    });
  });

  it("does not send reasoning_effort to other models unless asked", async () => {
    const fetchMock = vi.fn(async (...args: [string, RequestInit]) => {
      void args;
      return okResponse();
    });
    await complete(
      { messages: [], maxTokens: 5 },
      { env: { GROQ_API_KEY: "k", GROQ_MODEL: "llama-3.3-70b-versatile" }, fetch: fetchMock as unknown as typeof fetch },
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string) as Record<string, unknown>;
    expect(body.model).toBe("llama-3.3-70b-versatile");
    expect("reasoning_effort" in body).toBe(false);
    expect("response_format" in body).toBe(false);
  });

  it("maps provider failures to AiError without leaking the key", async () => {
    const env = { GROQ_API_KEY: "secret-key" };
    const cases: Array<[() => Promise<Response>, string]> = [
      [async () => new Response("{}", { status: 429 }), "rate_limited"],
      [async () => new Response("{}", { status: 401 }), "provider"],
      [async () => new Response(JSON.stringify({ error: { message: "model not found" } }), { status: 404 }), "provider"],
      [async () => new Response("not json", { status: 200 }), "provider"],
      [async () => new Response(JSON.stringify({ choices: [] }), { status: 200 }), "provider"],
      [async () => new Response(JSON.stringify({ choices: [{ message: { content: "" } }] }), { status: 200 }), "provider"],
      [async () => {
        throw new Error("secret-key leaked in a network error");
      }, "provider"],
    ];
    for (const [impl, kind] of cases) {
      const err = await complete({ messages: [], maxTokens: 5 }, { env, fetch: impl as unknown as typeof fetch }).catch((e) => e);
      expect(err).toBeInstanceOf(AiError);
      expect(err.kind).toBe(kind);
      expect(err.message).not.toContain("secret-key");
    }
  });
});

describe("tutor prompt", () => {
  it("includes the question and its stored solution, and withholds permission to reveal before finishing", () => {
    const open = buildTutorMessages(NUMERIC, false, [{ role: "user", content: "hi" }]);
    expect(open[0].role).toBe("system");
    expect(open[0].content).toContain(NUMERIC.prompt);
    expect(open[0].content).toContain(NUMERIC.steps);
    expect(open[0].content).toContain("patient");
    expect(open[0].content).toMatch(/NOT finished/);
    const done = buildTutorMessages(NUMERIC, true, []);
    expect(done[0].content).not.toMatch(/NOT finished/);
    expect(done[0].content).toMatch(/discuss the full solution/);
  });

  it("trims the history to the last several messages", () => {
    const history = Array.from({ length: 40 }, (_, i) => ({ role: i % 2 ? ("assistant" as const) : ("user" as const), content: `m${i}` }));
    const messages = buildTutorMessages(MCQ, false, history);
    expect(messages).toHaveLength(CHAT_HISTORY_LIMIT + 1);
    expect(messages[messages.length - 1].content).toBe("m39");
    expect(messages[1].content).toBe(`m${40 - CHAT_HISTORY_LIMIT}`);
  });
});

describe("upgrade validation", () => {
  const common = {
    referenceCard: "ref",
    hints: ["h1", "h2"],
    shortAnswer: "short",
    steps: "1. a\n2. b",
    theory: "theory",
    intuition: "intuition",
  };
  const goodMcq = {
    ...common,
    prompt: "A harder question?",
    options: ["a", "b", "c", "d"],
    correctOption: 3,
    optionReasons: ["ra", "rb", "rc", "rd"],
  };

  it("accepts a well-formed mcq and forces parent, category, format, difficulty + 1, unverified", () => {
    const out = parseGeneratedQuestion(JSON.stringify({ ...goodMcq, categoryId: 99, difficulty: 1, verified: true, parentId: 5 }), MCQ);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.question).toMatchObject({
      categoryId: MCQ.categoryId,
      format: "mcq",
      difficulty: MCQ.difficulty + 1,
      parentId: MCQ.id,
      verified: false,
      correctOption: 3,
      correctValue: null,
      rubric: null,
    });
  });

  it("accepts JSON wrapped in a code fence and steps given as a list", () => {
    const out = parseGeneratedQuestion("```json\n" + JSON.stringify({ ...goodMcq, steps: ["first", "second"] }) + "\n```", MCQ);
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.question.steps).toBe("first\nsecond");
  });

  it("caps difficulty at 5", () => {
    const out = parseGeneratedQuestion(JSON.stringify(goodMcq), { ...MCQ, difficulty: 5 });
    expect(out.ok && out.question.difficulty).toBe(5);
  });

  it("rejects malformed mcq output", () => {
    const bad: Array<Record<string, unknown>> = [
      { ...goodMcq, correctOption: 4 },
      { ...goodMcq, correctOption: "3" },
      { ...goodMcq, correctOption: 1.5 },
      { ...goodMcq, options: ["a"] },
      { ...goodMcq, options: ["a", "a", "b", "c"] },
      { ...goodMcq, optionReasons: ["only one"] },
      { ...goodMcq, prompt: "" },
      { ...goodMcq, prompt: MCQ.prompt },
      { ...goodMcq, hints: [] },
      { ...goodMcq, hints: "a hint" },
      { ...goodMcq, steps: "" },
      { ...goodMcq, referenceCard: undefined },
      { ...goodMcq, format: "numeric" },
    ];
    for (const b of bad) expect(parseGeneratedQuestion(JSON.stringify(b), MCQ).ok).toBe(false);
    for (const text of ["", "not json", "null", "[]", "42", "{"]) expect(parseGeneratedQuestion(text, MCQ).ok).toBe(false);
  });

  it("validates numeric output", () => {
    const good = { ...common, prompt: "Harder numeric?", correctValue: 1.5, tolerance: 0.01, unit: "$" };
    const out = parseGeneratedQuestion(JSON.stringify(good), NUMERIC);
    expect(out.ok && out.question).toMatchObject({ format: "numeric", correctValue: 1.5, tolerance: 0.01, unit: "$", options: null });
    expect(parseGeneratedQuestion(JSON.stringify({ ...good, correctValue: 0, unit: null }), NUMERIC).ok).toBe(true);
    for (const b of [
      { ...good, correctValue: "1.5" },
      { ...good, correctValue: null },
      { ...good, tolerance: 0 },
      { ...good, tolerance: 0.9 },
      { ...good, tolerance: undefined },
      { ...good, unit: 5 },
    ]) {
      expect(parseGeneratedQuestion(JSON.stringify(b), NUMERIC).ok).toBe(false);
    }
  });

  it("validates long output", () => {
    const good = { ...common, prompt: "Harder long?", rubric: ["a", "b", "c"] };
    expect(parseGeneratedQuestion(JSON.stringify(good), LONG).ok).toBe(true);
    expect(parseGeneratedQuestion(JSON.stringify({ ...good, rubric: ["a", "b"] }), LONG).ok).toBe(false);
    expect(parseGeneratedQuestion(JSON.stringify({ ...good, rubric: null }), LONG).ok).toBe(false);
  });

  it("asks the model for JSON in the question shape", () => {
    const messages = buildUpgradeMessages(NUMERIC);
    expect(messages[0].content).toContain('"correctValue"');
    expect(messages[0].content).toContain('"referenceCard"');
    expect(messages[1].content).toContain(NUMERIC.prompt);
  });
});

describe("balance and settings validation", () => {
  it("computes targets from weights and marks ahead and behind", () => {
    const rows = computeBalance({ 1: 6, 2: 0 }, { ...DEFAULT_SETTINGS, weights: { 3: 0, 4: 2 } });
    // 12 categories, one excluded, one double: weights sum to 12, total counted is 6
    const row = (id: number) => rows.find((r) => r.categoryId === id)!;
    expect(row(1).target).toBeCloseTo(0.5, 12);
    expect(row(1).delta).toBeCloseTo(5.5, 12);
    expect(row(2).delta).toBeCloseTo(-0.5, 12);
    expect(row(4).target).toBeCloseTo(1, 12);
    expect(row(3)).toMatchObject({ share: 0, target: null, delta: null });
    expect(rows.reduce((s, r) => s + r.share, 0)).toBeCloseTo(1, 12);
  });

  it("does not count excluded categories toward the total", () => {
    const rows = computeBalance({ 1: 4, 3: 10 }, { ...DEFAULT_SETTINGS, weights: { 3: 0 } });
    expect(rows.find((r) => r.categoryId === 1)!.target).toBeCloseTo(4 / 11, 12);
  });

  it("normalizes settings", () => {
    expect(normalizeSettings({ baseDifficulty: 3, stretchPct: 12.4, weights: { 2: 1, 5: 0.5 }, pinnedCategories: [9, 2, 9] })).toEqual({
      baseDifficulty: 3,
      stretchPct: 12,
      weights: { 5: 0.5 },
      pinnedCategories: [2, 9],
    });
    expect(normalizeSettings(null)).toBeNull();
    expect(normalizeSettings({ baseDifficulty: "3", stretchPct: 10 })).toBeNull();
  });
});

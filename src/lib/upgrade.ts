/**
 * Upgrade: turn a question into a harder, more involved version using the AI.
 * The model's output is treated as untrusted: it is parsed and validated strictly,
 * saved with verified = false, and therefore never served by the selector.
 */
import { complete, type AiDeps, type AiMessage } from "./ai";
import { CATEGORIES } from "./categories";
import { getChildQuestionId, getQuestion, insertQuestion, logAiCall, type Db } from "./db";
import { PracticeError } from "./practice";
import { MAX_DIFFICULTY } from "./selector";
import type { NewQuestion, Question } from "./types";

export const UPGRADE_MAX_TOKENS = 4000;

const SHAPE = `{
  "prompt": string,
  "options": string[] | null,          // mcq only: exactly 4 options
  "correctOption": number | null,      // mcq only: zero-based index into options
  "optionReasons": string[] | null,    // mcq only: one reason per option, same order
  "correctValue": number | null,       // numeric only
  "tolerance": number | null,          // numeric only: relative tolerance, e.g. 0.01
  "unit": string | null,               // numeric only, null if there is no unit
  "rubric": string[] | null,           // long only: 3 to 6 key insights
  "referenceCard": string,             // formulas or theory needed, without giving the answer away
  "hints": string[],                   // 2 to 4 hints, gentlest first
  "shortAnswer": string,
  "steps": string,                     // numbered steps separated by \\n
  "theory": string,
  "intuition": string
}`;

export function buildUpgradeMessages(q: Question): AiMessage[] {
  const category = CATEGORIES.find((c) => c.id === q.categoryId)?.name ?? String(q.categoryId);
  const original = {
    prompt: q.prompt,
    options: q.options,
    correctOption: q.correctOption,
    correctValue: q.correctValue,
    unit: q.unit,
    rubric: q.rubric,
    shortAnswer: q.shortAnswer,
    steps: q.steps,
  };
  return [
    {
      role: "system",
      content: [
        "You write practice questions for quant trading and finance interviews.",
        "Given a question, write ONE harder, more involved version of it: add steps, add a constraint, or add a follow-up, so it is one difficulty level harder. Keep the same topic and the same answer format.",
        "The answer must be unambiguous and you must compute it carefully, step by step, before writing the final JSON. Do not depend on current market data.",
        "Use plain text for formulas, like x^2 or e^(-rT). No markdown.",
        "Reply with a single JSON object and nothing else, in exactly this shape (fields that do not apply to the format must be null):",
        SHAPE,
      ].join("\n"),
    },
    {
      role: "user",
      content: `Category: ${category}\nFormat: ${q.format}\nCurrent difficulty: ${q.difficulty} of 5\nOriginal question as JSON:\n${JSON.stringify(original, null, 2)}`,
    },
  ];
}

type Parsed = { ok: true; question: NewQuestion } | { ok: false; errors: string[] };

const isText = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;
const isTextList = (v: unknown): v is string[] => Array.isArray(v) && v.every(isText);

/** Strictly validate model output into a NewQuestion that is a child of `parent`. */
export function parseGeneratedQuestion(raw: string, parent: Question): Parsed {
  let text = raw.trim();
  const fenced = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced) text = fenced[1];
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, errors: ["reply was not valid JSON"] };
  }
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return { ok: false, errors: ["reply was not a JSON object"] };
  }
  const d = data as Record<string, unknown>;
  const errors: string[] = [];

  if (d.format !== undefined && d.format !== parent.format) errors.push("format differs from the original");
  for (const key of ["prompt", "referenceCard", "shortAnswer", "theory", "intuition"] as const) {
    if (!isText(d[key])) errors.push(`${key} must be a non-empty string`);
  }
  if (isText(d.prompt) && d.prompt.trim() === parent.prompt.trim()) errors.push("prompt is identical to the original");
  const steps = isTextList(d.steps) && d.steps.length > 0 ? d.steps.join("\n") : d.steps;
  if (!isText(steps)) errors.push("steps must be a non-empty string");
  if (!isTextList(d.hints) || d.hints.length < 1 || d.hints.length > 10) errors.push("hints must be 1 to 10 non-empty strings");

  const q: NewQuestion = {
    categoryId: parent.categoryId,
    format: parent.format,
    difficulty: Math.min(MAX_DIFFICULTY, parent.difficulty + 1),
    prompt: isText(d.prompt) ? d.prompt.trim() : "",
    options: null,
    correctOption: null,
    optionReasons: null,
    correctValue: null,
    tolerance: null,
    unit: null,
    rubric: null,
    referenceCard: isText(d.referenceCard) ? d.referenceCard.trim() : "",
    hints: isTextList(d.hints) ? d.hints.map((h) => h.trim()) : [],
    shortAnswer: isText(d.shortAnswer) ? d.shortAnswer.trim() : "",
    steps: isText(steps) ? steps.trim() : "",
    theory: isText(d.theory) ? d.theory.trim() : "",
    intuition: isText(d.intuition) ? d.intuition.trim() : "",
    parentId: parent.id,
    verified: false,
  };

  if (parent.format === "mcq") {
    const options = d.options;
    if (!isTextList(options) || options.length < 2 || options.length > 6) {
      errors.push("options must be 2 to 6 non-empty strings");
    } else {
      const trimmed = options.map((o) => o.trim());
      if (new Set(trimmed).size !== trimmed.length) errors.push("options must be distinct");
      q.options = trimmed;
      const c = d.correctOption;
      if (typeof c !== "number" || !Number.isInteger(c) || c < 0 || c >= trimmed.length) {
        errors.push("correctOption must be a zero-based index into options");
      } else {
        q.correctOption = c;
      }
      if (!isTextList(d.optionReasons) || d.optionReasons.length !== trimmed.length) {
        errors.push("optionReasons must have one reason per option");
      } else {
        q.optionReasons = d.optionReasons.map((r) => r.trim());
      }
    }
  } else if (parent.format === "numeric") {
    if (typeof d.correctValue !== "number" || !Number.isFinite(d.correctValue)) {
      errors.push("correctValue must be a finite number");
    } else {
      q.correctValue = d.correctValue;
    }
    if (typeof d.tolerance !== "number" || !(d.tolerance > 0) || d.tolerance > 0.2) {
      errors.push("tolerance must be a number above 0 and at most 0.2");
    } else {
      q.tolerance = d.tolerance;
    }
    if (d.unit === null || d.unit === undefined || d.unit === "") q.unit = null;
    else if (typeof d.unit === "string" && d.unit.length <= 30) q.unit = d.unit.trim();
    else errors.push("unit must be a short string or null");
  } else {
    if (!isTextList(d.rubric) || d.rubric.length < 3 || d.rubric.length > 6) {
      errors.push("rubric must be 3 to 6 non-empty strings");
    } else {
      q.rubric = d.rubric.map((r) => r.trim());
    }
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true, question: q };
}

export interface UpgradeResult {
  questionId: number;
  /** false when an existing upgraded version was reused */
  created: boolean;
}

/** Open the existing harder version if there is one, otherwise generate, validate, and save one. */
export async function upgradeQuestion(db: Db, questionId: number, deps: AiDeps = {}): Promise<UpgradeResult> {
  const q = Number.isInteger(questionId) ? getQuestion(db, questionId) : null;
  if (!q) throw new PracticeError("That question does not exist.", 404);
  const existing = getChildQuestionId(db, q.id);
  if (existing !== null) return { questionId: existing, created: false };
  if (q.difficulty >= MAX_DIFFICULTY) {
    throw new PracticeError("This question is already at the highest difficulty.", 409);
  }
  const reply = await complete({ messages: buildUpgradeMessages(q), maxTokens: UPGRADE_MAX_TOKENS, json: true, temperature: 0.6 }, deps);
  logAiCall(db, {
    purpose: "upgrade",
    provider: reply.provider,
    model: reply.model,
    inputTokens: reply.inputTokens,
    outputTokens: reply.outputTokens,
  });
  const parsed = parseGeneratedQuestion(reply.text, q);
  if (!parsed.ok) {
    throw new PracticeError(
      `The AI wrote a harder version that did not pass validation (${parsed.errors.slice(0, 3).join("; ")}). Nothing was saved. Try again.`,
      502,
    );
  }
  return { questionId: insertQuestion(db, parsed.question), created: true };
}

import { expect } from "vitest";
import type { Question } from "./types";

/** Every stored text or value that must stay on the server until it is revealed. */
export function secretsOf(q: Question): string[] {
  return [q.referenceCard, ...q.hints, q.shortAnswer, q.steps, q.theory, q.intuition, ...(q.optionReasons ?? []), ...(q.rubric ?? [])];
}

const SECRET_KEYS = [
  "correctOption",
  "optionReasons",
  "correctValue",
  "rubric",
  "referenceCard",
  "shortAnswer",
  "steps",
  "theory",
  "intuition",
];

export function expectNoLeak(payload: unknown, q: Question) {
  const text = JSON.stringify(payload);
  for (const secret of secretsOf(q)) expect(text).not.toContain(JSON.stringify(secret).slice(1, -1));
  const walk = (v: unknown) => {
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") {
      for (const [k, child] of Object.entries(v)) {
        if (SECRET_KEYS.includes(k)) throw new Error(`secret key ${k} present in payload`);
        walk(child);
      }
    }
  };
  walk(payload);
}

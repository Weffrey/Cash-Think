import { SEED_QUESTIONS } from "../data/seed-questions";
import { insertQuestion, listQuestions, type Db } from "./db";

/**
 * Add any seed question that is not in the database yet (matched by prompt).
 * Safe to run repeatedly: existing questions, attempts, and favorites are untouched.
 * Returns how many questions were added.
 */
export function syncSeedQuestions(db: Db): number {
  const have = new Set(listQuestions(db).map((q) => q.prompt));
  const missing = SEED_QUESTIONS.filter((q) => !have.has(q.prompt));
  const insert = db.transaction(() => {
    for (const q of missing) insertQuestion(db, q);
  });
  insert();
  return missing.length;
}

import { guard, ok, readJson } from "@/lib/http";
import { startAttempt } from "@/lib/practice";
import { getDb } from "@/lib/server-db";

/** Open an attempt on a specific question (favorites, upgraded questions). */
export async function POST(request: Request) {
  return guard(async () => {
    const body = await readJson(request);
    return ok({ attempt: startAttempt(getDb(), Number(body.questionId)) });
  });
}

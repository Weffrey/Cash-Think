import { connection } from "next/server";
import { getQuestion, listAttempts, listFavoriteIds } from "@/lib/db";
import { guard, ok } from "@/lib/http";
import { toPublicQuestion } from "@/lib/practice";
import { getDb } from "@/lib/server-db";

export async function GET() {
  await connection();
  return guard(() => {
    const db = getDb();
    const attempts = listAttempts(db);
    const favorites = listFavoriteIds(db)
      .reverse()
      .flatMap((id) => {
        const q = getQuestion(db, id);
        if (!q) return [];
        const mine = attempts.filter((a) => a.questionId === id);
        const last = mine[mine.length - 1];
        return [
          {
            question: toPublicQuestion(q),
            attempts: mine.length,
            last: last ? { outcome: last.outcome, correct: last.correct, helpLevel: last.helpLevel, createdAt: last.createdAt } : null,
          },
        ];
      });
    return ok({ favorites });
  });
}

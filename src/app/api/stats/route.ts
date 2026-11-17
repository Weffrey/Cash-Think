import { connection } from "next/server";
import { listAttempts, listQuestions } from "@/lib/db";
import { guard, ok } from "@/lib/http";
import { getDb } from "@/lib/server-db";
import { computeStats } from "@/lib/stats";

export async function GET() {
  await connection();
  return guard(() => {
    const db = getDb();
    return ok(computeStats(listAttempts(db), listQuestions(db)));
  });
}

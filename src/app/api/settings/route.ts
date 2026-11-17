import { connection } from "next/server";
import { aiStatus } from "@/lib/ai";
import { computeBalance, normalizeSettings } from "@/lib/balance";
import { getCounters, getSettings, listQuestions, saveSettings, type Db } from "@/lib/db";
import { fail, guard, ok, readJson } from "@/lib/http";
import { getDb } from "@/lib/server-db";

function payload(db: Db) {
  const settings = getSettings(db);
  const bank: Record<number, number> = {};
  for (const q of listQuestions(db, { verifiedOnly: true })) bank[q.categoryId] = (bank[q.categoryId] ?? 0) + 1;
  return { settings, balance: computeBalance(getCounters(db), settings), bank, ai: aiStatus() };
}

/** Settings plus the read-only category counters. */
export async function GET() {
  await connection();
  return guard(() => ok(payload(getDb())));
}

export async function PUT(request: Request) {
  return guard(async () => {
    const settings = normalizeSettings(await readJson(request));
    if (!settings) return fail("Those settings are not valid.", 400);
    const db = getDb();
    saveSettings(db, settings);
    return ok(payload(db));
  });
}

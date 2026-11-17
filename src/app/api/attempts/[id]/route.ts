import { connection } from "next/server";
import { guard, ok, readJson } from "@/lib/http";
import { applyAction, getAttemptState, type AttemptAction } from "@/lib/practice";
import { getDb } from "@/lib/server-db";

type Ctx = { params: Promise<{ id: string }> };

/** Current state of an attempt, used to resume after a page reload. */
export async function GET(_request: Request, ctx: Ctx) {
  await connection();
  const { id } = await ctx.params;
  return guard(() => ok({ attempt: getAttemptState(getDb(), id) }));
}

/** Apply one action: reference, hint, solution, give_up, answer, self_check. */
export async function POST(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  return guard(async () => {
    const body = await readJson(request);
    return ok({ attempt: applyAction(getDb(), id, body as unknown as AttemptAction) });
  });
}

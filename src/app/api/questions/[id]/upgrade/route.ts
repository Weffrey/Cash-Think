import { guard, ok } from "@/lib/http";
import { getDb } from "@/lib/server-db";
import { upgradeQuestion } from "@/lib/upgrade";

type Ctx = { params: Promise<{ id: string }> };

/** Open the existing harder version, or generate one with the AI (saved unverified). */
export async function POST(_request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  return guard(async () => ok(await upgradeQuestion(getDb(), Number(id))));
}

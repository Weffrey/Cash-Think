import { guard, ok, readJson } from "@/lib/http";
import { getDb } from "@/lib/server-db";
import { sendChatMessage } from "@/lib/tutor";

type Ctx = { params: Promise<{ id: string }> };

/** Send one chat message about this attempt's question. Never changes the help level. */
export async function POST(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  return guard(async () => {
    const body = await readJson(request);
    return ok({ chat: await sendChatMessage(getDb(), id, body.message) });
  });
}

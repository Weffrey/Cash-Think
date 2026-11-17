import { getQuestion, isFavorite, setFavorite } from "@/lib/db";
import { fail, guard, ok, readJson } from "@/lib/http";
import { getDb } from "@/lib/server-db";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  return guard(async () => {
    const db = getDb();
    const questionId = Number(id);
    if (!Number.isInteger(questionId) || !getQuestion(db, questionId)) return fail("That question does not exist.", 404);
    const body = await readJson(request);
    setFavorite(db, questionId, body.on === true);
    return ok({ favorite: isFavorite(db, questionId) });
  });
}

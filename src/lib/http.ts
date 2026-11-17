import { AiError } from "./ai";
import { PracticeError } from "./practice";

const NO_STORE = { "Cache-Control": "no-store" };

export function ok(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: NO_STORE });
}

export function fail(message: string, status: number, code?: string): Response {
  return Response.json({ error: message, code }, { status, headers: NO_STORE });
}

/** Read a JSON body; an empty or invalid body becomes an empty object. */
export async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const data: unknown = await request.json();
    return typeof data === "object" && data !== null && !Array.isArray(data) ? (data as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** Run a route handler body and turn known errors into JSON error responses. */
export async function guard(fn: () => Response | Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof PracticeError) return fail(e.message, e.status);
    if (e instanceof AiError) {
      return fail(e.message, e.kind === "disabled" ? 503 : e.kind === "rate_limited" ? 429 : 502, `ai_${e.kind}`);
    }
    console.error(e);
    return fail("Something went wrong on the server.", 500);
  }
}

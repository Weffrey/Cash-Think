/**
 * The only file that knows which AI provider is used. Swap the provider by
 * changing this file. Server only: the key is read from the environment and is
 * never sent to the browser.
 *
 * Provider: Groq, OpenAI-compatible chat completions.
 * Request and response fields follow https://console.groq.com/docs/api-reference#chat-create
 */

export const AI_PROVIDER = "groq";
const DEFAULT_BASE_URL = "https://api.groq.com/openai/v1";
const DEFAULT_MODEL = "openai/gpt-oss-120b";

type Env = Record<string, string | undefined>;

export interface AiStatus {
  enabled: boolean;
  provider: string;
  model: string;
}

export function aiStatus(env: Env = process.env): AiStatus {
  return {
    enabled: Boolean(env.GROQ_API_KEY && env.GROQ_API_KEY.trim() !== ""),
    provider: AI_PROVIDER,
    model: env.GROQ_MODEL?.trim() || DEFAULT_MODEL,
  };
}

export interface AiMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AiRequest {
  messages: AiMessage[];
  /** cap on generated tokens (includes the model's hidden reasoning tokens) */
  maxTokens: number;
  /** ask for a single JSON object as the reply */
  json?: boolean;
  temperature?: number;
}

export interface AiReply {
  text: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

export class AiError extends Error {
  constructor(
    message: string,
    /** "disabled" no key, "rate_limited" 429, "provider" any other failure */
    public readonly kind: "disabled" | "rate_limited" | "provider",
  ) {
    super(message);
    this.name = "AiError";
  }
}

export interface AiDeps {
  fetch?: typeof fetch;
  env?: Env;
}

/** One chat completion. Throws AiError; never throws anything containing the key. */
export async function complete(req: AiRequest, deps: AiDeps = {}): Promise<AiReply> {
  const env = deps.env ?? process.env;
  const doFetch = deps.fetch ?? fetch;
  const status = aiStatus(env);
  if (!status.enabled) {
    throw new AiError("AI is not configured. Add GROQ_API_KEY to .env.local to enable it.", "disabled");
  }

  const body: Record<string, unknown> = {
    model: status.model,
    messages: req.messages,
    max_completion_tokens: req.maxTokens,
    temperature: req.temperature ?? 0.4,
    stream: false,
  };
  if (req.json) body.response_format = { type: "json_object" };
  // gpt-oss models reason before answering; "low" keeps replies fast and cheap. Other models reject the field.
  const effort = env.GROQ_REASONING_EFFORT?.trim() || (status.model.startsWith("openai/gpt-oss") ? "low" : "");
  if (effort) body.reasoning_effort = effort;

  const base = (env.GROQ_BASE_URL?.trim() || DEFAULT_BASE_URL).replace(/\/+$/, "");
  let res: Response;
  try {
    res = await doFetch(`${base}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.GROQ_API_KEY!.trim()}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60_000),
    });
  } catch {
    throw new AiError("Could not reach the AI provider. Check your connection and try again.", "provider");
  }
  if (res.status === 429) {
    throw new AiError("The free AI tier is rate limited right now. Wait a minute and try again.", "rate_limited");
  }
  if (res.status === 401 || res.status === 403) {
    throw new AiError("The AI provider rejected the key. Check GROQ_API_KEY in .env.local.", "provider");
  }
  if (!res.ok) {
    let detail = "";
    try {
      const err = (await res.json()) as { error?: { message?: unknown } };
      if (typeof err?.error?.message === "string") detail = `: ${err.error.message.slice(0, 200)}`;
    } catch {
      // ignore an unreadable error body
    }
    throw new AiError(`The AI provider returned an error (${res.status})${detail}`, "provider");
  }
  let data: unknown;
  try {
    data = await res.json();
  } catch {
    throw new AiError("The AI provider sent a reply that could not be read.", "provider");
  }
  const d = data as {
    model?: unknown;
    choices?: Array<{ message?: { content?: unknown } }>;
    usage?: { prompt_tokens?: unknown; completion_tokens?: unknown };
  };
  const text = d?.choices?.[0]?.message?.content;
  if (typeof text !== "string" || text.trim() === "") {
    throw new AiError("The AI provider sent an empty reply. Try again.", "provider");
  }
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  return {
    text,
    provider: AI_PROVIDER,
    model: typeof d.model === "string" ? d.model : status.model,
    inputTokens: num(d.usage?.prompt_tokens),
    outputTokens: num(d.usage?.completion_tokens),
  };
}

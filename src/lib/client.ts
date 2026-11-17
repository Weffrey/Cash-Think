/** Browser-side helpers. Nothing here touches the database or the AI key. */

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function api<T>(path: string, init?: { method?: "GET" | "POST" | "PUT"; body?: unknown }): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: init?.method ?? "GET",
      headers: init?.body === undefined ? undefined : { "Content-Type": "application/json" },
      body: init?.body === undefined ? undefined : JSON.stringify(init.body),
      cache: "no-store",
    });
  } catch {
    throw new ApiError("Could not reach the app server. Is it still running?", 0);
  }
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    // fall through with null
  }
  if (!res.ok) {
    const err = (data ?? {}) as { error?: string; code?: string };
    throw new ApiError(err.error ?? `Request failed (${res.status}).`, res.status, err.code);
  }
  return data as T;
}

export const HELP_LABELS = ["Independent", "Reference used", "Hinted", "Solution shown"] as const;
export const FORMAT_LABELS = { mcq: "Multiple choice", numeric: "Numeric", long: "Written" } as const;

export function formatDuration(ms: number | null): string {
  if (ms === null) return "–";
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (m >= 60) return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Up to 6 significant digits, without trailing zeros or float noise. */
export function formatNumber(v: number): string {
  if (!Number.isFinite(v)) return String(v);
  if (v === 0) return "0";
  const abs = Math.abs(v);
  if (abs >= 1e9 || abs < 1e-6) return v.toExponential(3);
  const rounded = Number(v.toPrecision(6));
  return rounded.toLocaleString("en-US", { maximumFractionDigits: 8 });
}

export function withUnit(value: string, unit: string | null): string {
  if (!unit) return value;
  if (unit === "$") return value.startsWith("-") ? `-$${value.slice(1)}` : `$${value}`;
  if (unit === "%") return `${value}%`;
  if (unit.startsWith("$ ")) return `$${value} ${unit.slice(2)}`;
  return `${value} ${unit}`;
}

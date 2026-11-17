"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { categoryName, two } from "@/components/Badges";
import { AiOffNotice } from "@/components/ChatPanel";
import { Icon } from "@/components/Icon";
import { LoadError, PageHeader } from "@/components/PageHeader";
import type { AiStatus } from "@/lib/ai";
import type { BalanceRow } from "@/lib/balance";
import { api, ApiError } from "@/lib/client";
import type { Settings } from "@/lib/types";

interface Payload {
  settings: Settings;
  balance: BalanceRow[];
  bank: Record<string, number>;
  ai: AiStatus;
}

const WEIGHT_STEPS = [0, 0.5, 1, 1.5, 2, 3, 4, 5];
type SaveState = "idle" | "saving" | "saved" | "error";

function deltaText(row: BalanceRow): { text: string; tone: string } {
  if (row.delta === null) return { text: "excluded", tone: "text-ink-3" };
  if (Math.abs(row.delta) < 0.05) return { text: "on target", tone: "text-ink-2" };
  return row.delta > 0
    ? { text: `${row.delta.toFixed(1)} ahead`, tone: "text-ink" }
    : { text: `${Math.abs(row.delta).toFixed(1)} behind`, tone: "text-ink" };
}

export default function SettingsPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [save, setSave] = useState<SaveState>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<Settings | null>(null);

  const load = useCallback(() => {
    return api<Payload>("/api/settings")
      .then((d) => {
        setData(d);
        if (pending.current === null) setSettings(d.settings);
        setError(null);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : "Could not load settings."));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const flush = useCallback(async () => {
    const next = pending.current;
    if (!next) return;
    pending.current = null;
    setSave("saving");
    try {
      const d = await api<Payload>("/api/settings", { method: "PUT", body: next });
      setData(d);
      setSave(pending.current ? "saving" : "saved");
    } catch {
      setSave("error");
    }
  }, []);

  // Save shortly after the last change, and immediately when leaving the page.
  const update = (next: Settings) => {
    setSettings(next);
    pending.current = next;
    setSave("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), 350);
  };
  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
      void flush();
    };
  }, [flush]);

  if (error && !data) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader title="Settings" lead="Difficulty, category mix, and the category counters." />
        <LoadError message={error} retry={load} />
      </div>
    );
  }
  if (!data || !settings) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader title="Settings" lead="Difficulty, category mix, and the category counters." />
        <div className="card h-64 animate-pulse" aria-busy="true" />
      </div>
    );
  }

  const weightOf = (id: number) => settings.weights[id] ?? 1;
  const setWeight = (id: number, w: number) => {
    const weights = { ...settings.weights };
    if (w === 1) delete weights[id];
    else weights[id] = w;
    update({ ...settings, weights });
  };
  const togglePin = (id: number) => {
    const has = settings.pinnedCategories.includes(id);
    const pinnedCategories = has ? settings.pinnedCategories.filter((p) => p !== id) : [...settings.pinnedCategories, id].sort((a, b) => a - b);
    update({ ...settings, pinnedCategories });
  };

  const base = settings.baseDifficulty;
  const stretch = settings.stretchPct;
  const pinned = settings.pinnedCategories;
  const activeCount = data.balance.filter((r) => weightOf(r.categoryId) > 0 && (pinned.length === 0 || pinned.includes(r.categoryId))).length;
  const scale = Math.max(1, ...data.balance.map((r) => Math.max(r.count, r.target ?? 0)));
  const total = data.balance.reduce((s, r) => s + r.count, 0);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Settings"
        lead="Difficulty, category mix, and the category counters. Changes save on their own."
        aside={
          <span
            className={`chip ${save === "error" ? "border-bad text-bad" : save === "saved" ? "border-accent text-accent" : ""}`}
            role="status"
            aria-live="polite"
          >
            {save === "saving" ? "Saving…" : save === "saved" ? "Saved" : save === "error" ? "Not saved" : "Up to date"}
          </span>
        }
      />

      {/* ── difficulty */}
      <section className="card p-4 sm:p-6" aria-labelledby="difficulty-heading">
        <h2 id="difficulty-heading" className="label">
          Difficulty
        </h2>
        <div className="mt-3 grid gap-6 sm:grid-cols-2">
          <div>
            <div className="text-sm font-medium">Base level</div>
            <div className="mt-2 grid grid-cols-5 gap-1.5" role="radiogroup" aria-label="Base difficulty level">
              {[1, 2, 3, 4, 5].map((level) => (
                <button
                  key={level}
                  type="button"
                  role="radio"
                  aria-checked={base === level}
                  onClick={() => update({ ...settings, baseDifficulty: level })}
                  className={`flex h-14 flex-col items-center justify-center gap-1 rounded-lg border font-mono text-sm transition-colors ${
                    base === level ? "border-accent bg-accent-soft text-ink" : "border-line text-ink-2 hover:border-line-strong"
                  }`}
                >
                  <span className="flex h-3 items-end gap-[2px]" aria-hidden="true">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <span
                        key={i}
                        className={`w-[3px] rounded-[1px] ${i <= level ? "bg-warn" : "bg-line-strong"}`}
                        style={{ height: `${4 + i * 1.6}px` }}
                      />
                    ))}
                  </span>
                  {level}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-ink-3">1 is easiest, 5 is hardest. Most questions come at this level.</p>
          </div>
          <div>
            <div className="flex items-baseline justify-between">
              <label htmlFor="stretch" className="text-sm font-medium">
                Stretch
              </label>
              <span className="font-mono text-sm tabular-nums">{stretch}%</span>
            </div>
            <input
              id="stretch"
              type="range"
              min={0}
              max={100}
              step={5}
              value={stretch}
              onChange={(e) => update({ ...settings, stretchPct: Number(e.target.value) })}
              className="mt-3 w-full"
            />
            <p className="mt-2 text-xs text-ink-3">
              {base >= 5
                ? "The base is already the top level, so stretch has no effect."
                : stretch === 0
                  ? `Every question is level ${base}.`
                  : `About ${stretch} in 100 questions are level ${base + 1}, one level above the base. The rest are level ${base}.`}
            </p>
          </div>
        </div>
      </section>

      {/* ── category mix */}
      <section className="card mt-4 p-4 sm:p-6" aria-labelledby="mix-heading">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="mix-heading" className="label">
            Category mix
          </h2>
          <span className="font-mono text-[11px] text-ink-3">
            {activeCount} of 12 in play{pinned.length > 0 ? ` · ${pinned.length} pinned` : ""}
          </span>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-ink-2">
          Weight sets each category&apos;s target share: 1 is the even default, 2 means twice as many, 0 excludes it. Pin categories to
          practice only those for now; counters keep updating, so the balance catches up later.
        </p>
        {pinned.length > 0 && (
          <button type="button" className="btn btn-sm mt-3" onClick={() => update({ ...settings, pinnedCategories: [] })}>
            <Icon name="x" size={14} />
            Clear pins
          </button>
        )}
        <ul className="mt-3 divide-y divide-line">
          {data.balance.map((row) => {
            const id = row.categoryId;
            const w = weightOf(id);
            const idx = WEIGHT_STEPS.indexOf(w);
            const isPinned = pinned.includes(id);
            const dimmed = w === 0 || (pinned.length > 0 && !isPinned);
            return (
              <li key={id} className="flex items-center gap-2 py-2.5 sm:gap-3">
                <button
                  type="button"
                  onClick={() => togglePin(id)}
                  aria-pressed={isPinned}
                  aria-label={`${isPinned ? "Unpin" : "Pin"} ${categoryName(id)}`}
                  title={isPinned ? "Pinned: click to unpin" : "Pin: practice only pinned categories"}
                  className={`btn btn-icon btn-sm h-9 w-9 shrink-0 ${isPinned ? "border-accent bg-accent-soft text-accent" : "btn-ghost text-ink-3"}`}
                >
                  <Icon name="pin" size={16} filled={isPinned} />
                </button>
                <div className={`min-w-0 flex-1 ${dimmed ? "opacity-50" : ""}`}>
                  <div className="text-[0.9375rem] leading-snug sm:truncate">
                    <span className="mr-2 font-mono text-xs text-accent">{two(id)}</span>
                    {categoryName(id)}
                  </div>
                  <div className="font-mono text-[11px] text-ink-3">
                    {data.bank[id] ?? 0} questions{w === 0 ? " · excluded" : ` · ${(row.share * 100).toFixed(0)}% share`}
                  </div>
                </div>
                <div className="flex shrink-0 items-center rounded-lg border border-line" role="group" aria-label={`Weight for ${categoryName(id)}`}>
                  <button
                    type="button"
                    className="grid h-9 w-9 place-items-center text-lg text-ink-2 disabled:opacity-30"
                    disabled={idx <= 0}
                    onClick={() => setWeight(id, WEIGHT_STEPS[Math.max(0, idx - 1)])}
                    aria-label="Lower weight"
                  >
                    −
                  </button>
                  <span className={`w-10 text-center font-mono text-sm tabular-nums ${w === 0 ? "text-ink-3" : ""}`}>{w === 0 ? "off" : `${w}×`}</span>
                  <button
                    type="button"
                    className="grid h-9 w-9 place-items-center text-lg text-ink-2 disabled:opacity-30"
                    disabled={idx === WEIGHT_STEPS.length - 1}
                    onClick={() => setWeight(id, WEIGHT_STEPS[idx < 0 ? 2 : idx + 1])}
                    aria-label="Raise weight"
                  >
                    +
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* ── counters (read-only) */}
      <section className="card mt-4 p-4 sm:p-6" aria-labelledby="counters-heading">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="counters-heading" className="label">
            Category counters
          </h2>
          <span className="font-mono text-[11px] text-ink-3">{total} counted in total · read-only</span>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-ink-2">
          Completed questions per category. Giving up and showing the solution first do not count. The tick marks each category&apos;s
          target at its current weight; the next question comes from the category furthest behind.
        </p>
        <ul className="mt-4 space-y-2.5">
          {data.balance.map((row) => {
            const d = deltaText(row);
            const behind = row.delta !== null && row.delta < -0.05;
            return (
              <li key={row.categoryId} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 sm:grid-cols-[15.5rem_minmax(0,1fr)_7.5rem]">
                <div className={`truncate text-sm ${row.target === null ? "opacity-50" : ""}`}>
                  <span className="mr-2 font-mono text-xs text-ink-3">{two(row.categoryId)}</span>
                  {categoryName(row.categoryId)}
                </div>
                <div className={`text-right font-mono text-xs tabular-nums sm:order-3 ${d.tone}`}>
                  <span className="mr-2 text-sm font-semibold text-ink">{row.count}</span>
                  {behind && <span aria-hidden="true">▾ </span>}
                  {row.delta !== null && row.delta > 0.05 && <span aria-hidden="true">▴ </span>}
                  {d.text}
                </div>
                <div
                  className="relative col-span-2 h-2.5 rounded-full bg-surface-2 sm:order-2 sm:col-span-1"
                  role="img"
                  aria-label={`${row.count} done${row.target !== null ? `, target ${row.target.toFixed(1)}` : ""}`}
                >
                  <div
                    className={`h-full rounded-full ${row.target === null ? "bg-line-strong" : "bg-series-1"}`}
                    style={{ width: `${(row.count / scale) * 100}%`, minWidth: row.count > 0 ? "6px" : 0 }}
                  />
                  {row.target !== null && total > 0 && (
                    <span
                      className="absolute -top-1 h-[18px] w-0.5 rounded bg-ink"
                      style={{ left: `calc(${(row.target / scale) * 100}% - 1px)` }}
                      title={`Target ${row.target.toFixed(1)}`}
                    />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        <p className="mt-4 text-xs text-ink-3">Counters cannot be reset.</p>
      </section>

      {/* ── AI */}
      <section className="card mt-4 p-4 sm:p-6" aria-labelledby="ai-heading">
        <h2 id="ai-heading" className="label">
          AI tutor and upgrade
        </h2>
        {data.ai.enabled ? (
          <p className="mt-2 text-sm leading-relaxed text-ink-2">
            On. Chat and Upgrade use <span className="font-mono text-ink">{data.ai.model}</span> through {data.ai.provider}. The key stays
            on the server.
          </p>
        ) : (
          <div className="mt-3">
            <AiOffNotice what="AI chat and Upgrade" />
          </div>
        )}
      </section>
    </div>
  );
}

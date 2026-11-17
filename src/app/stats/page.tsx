"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { categoryName, SHORT_NAMES, two } from "@/components/Badges";
import { Icon } from "@/components/Icon";
import { LoadError, PageHeader } from "@/components/PageHeader";
import { RichText } from "@/components/RichText";
import { api, ApiError, FORMAT_LABELS, formatDuration, HELP_LABELS } from "@/lib/client";
import type { CategoryStats, HistoryRow, Stats } from "@/lib/stats";

const SERIES = [
  { key: "independent", label: "Independent", cls: "bg-series-1" },
  { key: "theoryHelp", label: "Reference used", cls: "bg-series-2" },
  { key: "hinted", label: "Hinted", cls: "bg-series-3" },
  { key: "notCounted", label: "Not counted (gave up or solution shown)", cls: "hatch" },
] as const;

function Tile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="card px-4 py-3.5">
      <div className="label">{label}</div>
      <div className="mt-1 font-serif text-[2rem] leading-none tabular-nums">{value}</div>
      {note && <div className="mt-1.5 text-xs text-ink-3">{note}</div>}
    </div>
  );
}

function CategoryBar({ c, scale }: { c: CategoryStats; scale: number }) {
  const total = c.independent + c.theoryHelp + c.hinted + c.notCounted;
  const completed = c.independent + c.theoryHelp + c.hinted;
  const summary = `${categoryName(c.categoryId)}: ${c.independent} independent, ${c.theoryHelp} with reference, ${c.hinted} hinted, ${c.notCounted} not counted`;
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 sm:grid-cols-[15.5rem_minmax(0,1fr)_11.5rem]">
      <div className="truncate text-sm">
        <span className="mr-2 font-mono text-xs text-ink-3">{two(c.categoryId)}</span>
        {categoryName(c.categoryId)}
      </div>
      <div className="text-right font-mono text-xs text-ink-2 tabular-nums sm:order-3">
        {total === 0 ? (
          <span className="text-ink-3">no attempts</span>
        ) : (
          <>
            <span className="font-semibold text-ink">{completed === 0 ? "–" : `${Math.round((c.independent / completed) * 100)}%`}</span> indep.
            · {c.graded === 0 ? "–" : `${c.correct}/${c.graded}`} right
          </>
        )}
      </div>
      <div className="col-span-2 flex h-3.5 gap-[2px] sm:order-2 sm:col-span-1" role="img" aria-label={summary}>
        {total === 0 ? (
          <div className="h-full w-full rounded-[4px] bg-surface-2" />
        ) : (
          SERIES.map((s) => {
            const n = c[s.key];
            if (n === 0) return null;
            return (
              <div
                key={s.key}
                className={`h-full rounded-[4px] ${s.cls}`}
                style={{ width: `${(n / scale) * 100}%`, minWidth: "8px" }}
                title={`${categoryName(c.categoryId)} · ${s.label}: ${n}`}
              />
            );
          })
        )}
      </div>
    </li>
  );
}

function resultOf(h: HistoryRow): { text: string; tone: "good" | "bad" | "neutral" } {
  if (h.outcome === "gave_up") return { text: h.helpLevel === 3 ? "Solution shown" : "Gave up", tone: "neutral" };
  if (h.correct === null) return { text: "Submitted", tone: "neutral" };
  return h.correct ? { text: "Correct", tone: "good" } : { text: "Wrong", tone: "bad" };
}

const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export default function StatsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [limit, setLimit] = useState(30);

  const load = useCallback(() => {
    return api<Stats>("/api/stats")
      .then((d) => {
        setStats(d);
        setError(null);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : "Could not load stats."));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const lead = "How independently you solve each category, and every attempt you have made.";
  if (error && !stats) {
    return (
      <div className="mx-auto max-w-4xl">
        <PageHeader title="Stats" lead={lead} />
        <LoadError message={error} retry={load} />
      </div>
    );
  }
  if (!stats) {
    return (
      <div className="mx-auto max-w-4xl">
        <PageHeader title="Stats" lead={lead} />
        <div className="card h-64 animate-pulse" aria-busy="true" />
      </div>
    );
  }

  const t = stats.totals;
  const scale = Math.max(1, ...stats.categories.map((c) => c.independent + c.theoryHelp + c.hinted + c.notCounted));
  const graded = stats.categories.reduce((s, c) => s + c.graded, 0);
  const correct = stats.categories.reduce((s, c) => s + c.correct, 0);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Stats" lead={lead} />

      {t.attempts === 0 ? (
        <div className="card p-8 text-center">
          <Icon name="stats" size={28} className="mx-auto text-ink-3" />
          <p className="mt-3 font-serif text-2xl">No attempts yet</p>
          <p className="mt-1 text-sm text-ink-2">Answer a question and it will show up here.</p>
          <Link href="/" className="btn btn-primary mt-5">
            Go to practice
          </Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Tile label="Attempts" value={String(t.attempts)} note={`${t.counted} counted, ${t.notCounted} not`} />
            <Tile
              label="Independent"
              value={t.counted === 0 ? "–" : `${Math.round((t.independent / t.counted) * 100)}%`}
              note={`${t.independent} of ${t.counted} completed`}
            />
            <Tile label="Assisted" value={String(t.assisted)} note="completed with reference or hints" />
            <Tile label="Right" value={graded === 0 ? "–" : `${Math.round((correct / graded) * 100)}%`} note={`${correct} of ${graded} graded`} />
          </div>

          <section className="card mt-4 p-4 sm:p-6" aria-labelledby="by-category">
            <h2 id="by-category" className="label">
              Independent vs assisted, by category
            </h2>
            <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-ink-2" aria-label="Legend">
              {SERIES.map((s) => (
                <li key={s.key} className="flex items-center gap-1.5">
                  <span className={`h-2.5 w-2.5 rounded-[3px] ${s.cls}`} />
                  {s.label}
                </li>
              ))}
            </ul>
            <ul className="mt-4 space-y-2.5">
              {stats.categories.map((c) => (
                <CategoryBar key={c.categoryId} c={c} scale={scale} />
              ))}
            </ul>
            <p className="mt-4 text-xs text-ink-3">
              A category where you often need the reference card points to a gap in theory, not in problem solving.
            </p>
          </section>

          <section className="card mt-4 overflow-hidden" aria-labelledby="history">
            <div className="flex items-baseline justify-between gap-3 px-4 pt-4 sm:px-6 sm:pt-6">
              <h2 id="history" className="label">
                Question history
              </h2>
              <span className="font-mono text-[11px] text-ink-3">{stats.history.length} attempts · newest first</span>
            </div>
            <ul className="mt-3 divide-y divide-line">
              {stats.history.slice(0, limit).map((h) => {
                const r = resultOf(h);
                return (
                  <li key={h.attemptId} className="flex gap-3 px-4 py-3 sm:px-6">
                    <span
                      className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full ${
                        r.tone === "good" ? "bg-accent-soft text-accent" : r.tone === "bad" ? "bg-bad-soft text-bad" : "bg-surface-2 text-ink-3"
                      }`}
                      aria-hidden="true"
                    >
                      <Icon name={r.tone === "good" ? "check" : r.tone === "bad" ? "x" : h.outcome === "gave_up" ? "flag" : "clock"} size={13} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <RichText text={h.prompt.split("\n")[0]} className="line-clamp-2 text-[0.9375rem] leading-snug" />
                      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[11px] text-ink-3">
                        <span className={r.tone === "good" ? "text-accent" : r.tone === "bad" ? "text-bad" : "text-ink-2"}>{r.text}</span>
                        <span>
                          Help {h.helpLevel} · {HELP_LABELS[h.helpLevel]}
                        </span>
                        <span>{formatDuration(h.durationMs)}</span>
                        <span>
                          {two(h.categoryId)} {SHORT_NAMES[h.categoryId]} · {FORMAT_LABELS[h.format]} · L{h.difficulty}
                        </span>
                        {h.attemptNumber > 1 && <span>attempt {h.attemptNumber}</span>}
                        {!h.counted && <span>not counted</span>}
                        {!h.verified && <span className="text-warn">unverified</span>}
                        <span>{dateFmt.format(h.createdAt)}</span>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
            {stats.history.length > limit && (
              <div className="border-t border-line p-3 text-center">
                <button type="button" className="btn btn-sm" onClick={() => setLimit((n) => n + 50)}>
                  Show more
                </button>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

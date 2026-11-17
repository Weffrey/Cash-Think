"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { api, ApiError, formatDuration, formatNumber, HELP_LABELS, withUnit } from "@/lib/client";
import type { AttemptAction, AttemptState } from "@/lib/practice";
import { CategoryChip, categoryName, DifficultyBadge, FormatChip } from "./Badges";
import { AiOffNotice, ChatPanel } from "./ChatPanel";
import { Icon } from "./Icon";
import { RichText } from "./RichText";

const LETTERS = ["A", "B", "C", "D", "E", "F"];

/** Seconds on the clock: time since the attempt opened, not counting time the tab was hidden. */
function useActiveClock(baseMs: number, running: boolean) {
  const [mountedAt] = useState(() => Date.now());
  const [now, setNow] = useState(mountedAt);
  const [hiddenMs, setHiddenMs] = useState(0);
  useEffect(() => {
    if (!running) return;
    const tick = setInterval(() => setNow(Date.now()), 1000);
    let hiddenAt: number | null = document.hidden ? Date.now() : null;
    const onVisibility = () => {
      if (document.hidden) {
        hiddenAt = Date.now();
      } else if (hiddenAt !== null) {
        const gap = Date.now() - hiddenAt;
        hiddenAt = null;
        setHiddenMs((h) => h + gap);
        setNow(Date.now());
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(tick);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [running]);
  const read = (at: number) => Math.max(0, baseMs + (at - mountedAt) - hiddenMs);
  return { elapsedMs: read(now), readNow: () => read(Date.now()) };
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1.5 border-t border-line py-4 first:border-t-0 first:pt-0 last:pb-0 sm:grid-cols-[7.5rem_minmax(0,1fr)] sm:gap-4">
      <div className="label pt-1">{label}</div>
      <div className="min-w-0 text-[0.9875rem] leading-relaxed">{children}</div>
    </div>
  );
}

export interface AttemptViewProps {
  initial: AttemptState;
  /** true when this attempt was reloaded from the server instead of freshly opened */
  resumed: boolean;
  /** label and action of the main footer button once the attempt is finished */
  nextLabel: string;
  onNext: () => void;
  /** open another question (upgraded version, original, try again) */
  onOpenQuestion: (questionId: number) => void;
  onBack?: { label: string; run: () => void };
  /** called whenever the server state of the attempt changes (used to refresh counters) */
  onChange?: (state: AttemptState) => void;
}

export function AttemptView({ initial, resumed, nextLabel, onNext, onOpenQuestion, onBack, onChange }: AttemptViewProps) {
  const [state, setState] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [option, setOption] = useState<number | null>(null);
  const [numberText, setNumberText] = useState("");
  const [longText, setLongText] = useState("");
  const [ticks, setTicks] = useState<boolean[]>([]);
  const [referenceOpen, setReferenceOpen] = useState(initial.reference !== null && initial.phase === "open");
  const [confirming, setConfirming] = useState<"solution" | "give_up" | null>(null);
  const [upgrade, setUpgrade] = useState<{ status: "idle" | "working" | "off" | "error"; message?: string }>({ status: "idle" });
  const [chatOpen, setChatOpen] = useState(
    () => initial.question.format === "long" && initial.phase === "open" && window.matchMedia("(min-width: 1024px)").matches,
  );
  const [startBase] = useState(() => (resumed ? Math.max(0, Date.now() - initial.startedAt) : 0));

  const resultRef = useRef<HTMLDivElement>(null);
  const [startPhase] = useState(initial.phase);

  const q = state.question;
  const open = state.phase === "open";
  const done = state.phase === "done";
  const clock = useActiveClock(startBase, open);
  const shownMs = state.result?.durationMs ?? clock.elapsedMs;

  async function act(action: AttemptAction): Promise<boolean> {
    if (busy) return false;
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ attempt: AttemptState }>(`/api/attempts/${state.attemptId}`, { method: "POST", body: action });
      setState(res.attempt);
      onChange?.(res.attempt);
      return true;
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  const submit = () => {
    const activeMs = clock.readNow();
    if (q.format === "mcq") return act({ type: "answer", option: option ?? undefined, activeMs });
    if (q.format === "numeric") return act({ type: "answer", value: numberText, activeMs });
    return act({ type: "answer", text: longText, activeMs });
  };

  async function toggleFavorite() {
    const on = !state.favorite;
    setState((s) => ({ ...s, favorite: on }));
    try {
      const res = await api<{ favorite: boolean }>(`/api/questions/${q.id}/favorite`, { method: "POST", body: { on } });
      setState((s) => ({ ...s, favorite: res.favorite }));
    } catch {
      setState((s) => ({ ...s, favorite: !on }));
      setError("Could not update the favorite.");
    }
  }

  async function runUpgrade() {
    if (state.childId !== null) return onOpenQuestion(state.childId);
    if (!state.ai.enabled) return setUpgrade((u) => ({ status: u.status === "off" ? "idle" : "off" }));
    setUpgrade({ status: "working" });
    try {
      const res = await api<{ questionId: number }>(`/api/questions/${q.id}/upgrade`, { method: "POST" });
      setUpgrade({ status: "idle" });
      onOpenQuestion(res.questionId);
    } catch (e) {
      setUpgrade({ status: "error", message: e instanceof ApiError ? e.message : "The upgrade failed." });
    }
  }

  // When the attempt finishes, bring the result into view.
  useEffect(() => {
    if (state.phase === startPhase || state.phase === "done" && startPhase === "self_check") return;
    const el = resultRef.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }, [state.phase, startPhase]);

  // Keyboard: A to D (or 1 to 4) picks an option, Enter confirms.
  const optionCount = q.options?.length ?? 0;
  useEffect(() => {
    if (!open || q.format !== "mcq") return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "TEXTAREA" || target.tagName === "INPUT" || target.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      const idx = k >= "1" && k <= "9" ? Number(k) - 1 : k.length === 1 && k >= "a" && k <= "f" ? k.charCodeAt(0) - 97 : -1;
      if (idx >= 0 && idx < optionCount) setOption(idx);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, q.format, optionCount]);

  const reveal = state.reveal;
  const result = state.result;
  const hintsLeft = state.hintsTotal - state.hints.length;
  const canSubmit =
    open && !busy && (q.format === "mcq" ? option !== null : q.format === "numeric" ? numberText.trim() !== "" : longText.trim() !== "");
  const rubricTicks = state.ticks ?? ticks;
  const tickCount = rubricTicks.filter(Boolean).length;

  // ── result banner
  let banner: { tone: "good" | "bad" | "neutral"; title: string } | null = null;
  if (result) {
    if (result.outcome === "gave_up") {
      banner = { tone: "neutral", title: result.helpLevel === 3 ? "Solution shown" : "Gave up" };
    } else if (result.correct === null) {
      banner = { tone: "neutral", title: "Submitted. Now check yourself." };
    } else if (result.correct) {
      banner = { tone: "good", title: "Correct" };
    } else {
      banner = { tone: "bad", title: q.format === "long" ? "Not there yet" : "Not quite" };
    }
  }
  const toneClass = { good: "border-accent bg-accent-soft", bad: "border-bad bg-bad-soft", neutral: "border-line-strong bg-surface-2" };

  return (
    <div className={chatOpen ? "lg:grid lg:grid-cols-[minmax(0,1fr)_23rem] lg:items-start lg:gap-6" : ""}>
      <article className={`card rise min-w-0 ${chatOpen ? "" : "mx-auto max-w-3xl"}`}>
        {/* ── header */}
        <header className="flex flex-wrap items-center gap-x-2 gap-y-2 border-b border-line px-4 py-3 sm:px-6">
          <CategoryChip id={q.categoryId} />
          <FormatChip format={q.format} />
          <DifficultyBadge level={q.difficulty} compact />
          {!q.verified && (
            <span className="chip border-warn bg-warn-soft text-warn" title="Written by AI and not checked. It may contain mistakes.">
              Unverified
            </span>
          )}
          <span className="chip tabular-nums" title="Time on this question">
            <Icon name="clock" size={12} />
            {formatDuration(shownMs)}
          </span>
          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              className={`btn btn-ghost btn-icon ${state.favorite ? "text-warn" : ""}`}
              onClick={toggleFavorite}
              aria-pressed={state.favorite}
              aria-label={state.favorite ? "Remove from favorites" : "Add to favorites"}
              title={state.favorite ? "Remove from favorites" : "Add to favorites"}
            >
              <Icon name="star" size={19} filled={state.favorite} />
            </button>
            <button
              type="button"
              className="btn btn-sm"
              onClick={runUpgrade}
              disabled={upgrade.status === "working" || (state.childId === null && q.difficulty >= 5)}
              title={
                state.childId !== null
                  ? "Open the harder version of this question"
                  : q.difficulty >= 5
                    ? "Already at the highest difficulty"
                    : "Make a harder, more involved version of this question"
              }
              aria-label={state.childId !== null ? "Open harder version" : "Upgrade to a harder version"}
            >
              <Icon name="up" size={15} />
              <span className="hidden sm:inline">
                {upgrade.status === "working" ? "Writing…" : state.childId !== null ? "Harder version" : "Upgrade"}
              </span>
            </button>
            <button
              type="button"
              className={`btn btn-sm ${chatOpen ? "border-accent text-accent" : ""}`}
              onClick={() => setChatOpen((v) => !v)}
              aria-pressed={chatOpen}
              aria-label={chatOpen ? "Close tutor chat" : "Open tutor chat"}
              title="Tutor chat"
            >
              <Icon name="chat" size={15} />
              <span className="hidden sm:inline">Chat</span>
            </button>
          </div>
        </header>

        <div className="space-y-5 px-4 py-5 sm:px-6 sm:py-6">
          {upgrade.status === "working" && (
            <p className="rounded-lg bg-surface-2 px-3 py-2 text-sm text-ink-2" role="status">
              Writing a harder version. This can take up to a minute.
            </p>
          )}
          {upgrade.status === "off" && <AiOffNotice what="Upgrade" />}
          {upgrade.status === "error" && (
            <p role="alert" className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">
              {upgrade.message}
            </p>
          )}
          {!q.verified && (
            <p className="rounded-lg border border-warn/40 bg-warn-soft px-3 py-2 text-sm text-ink">
              <strong className="font-semibold text-warn">Unverified.</strong> This harder version was written by AI and has not been
              checked, so its answer may be wrong. It is never picked for you automatically.
              {q.parentId !== null && (
                <button type="button" className="ml-1 underline underline-offset-2" onClick={() => onOpenQuestion(q.parentId as number)}>
                  Open the original.
                </button>
              )}
            </p>
          )}

          {/* ── question body */}
          <RichText text={q.prompt} className="prose-q" />

          {/* ── answer area */}
          {q.format === "mcq" && q.options && (
            <div role="radiogroup" aria-label="Answer options" className="space-y-2.5">
              {q.options.map((text, i) => {
                const chosen = (state.submitted?.option ?? option) === i;
                const isCorrect = reveal?.correctOption === i;
                const wrongPick = reveal !== null && chosen && !isCorrect && state.submitted?.option === i;
                let cls = "border-line bg-surface hover:border-line-strong";
                if (reveal) cls = isCorrect ? "border-accent bg-accent-soft" : wrongPick ? "border-bad bg-bad-soft" : "border-line bg-surface";
                else if (chosen) cls = "border-accent bg-accent-soft";
                return (
                  <button
                    key={i}
                    type="button"
                    role="radio"
                    aria-checked={chosen}
                    disabled={!open || busy}
                    onClick={() => setOption(i)}
                    className={`flex w-full items-start gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors disabled:cursor-default ${cls}`}
                  >
                    <span
                      className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md border font-mono text-xs ${
                        (reveal ? isCorrect : chosen)
                          ? "border-accent bg-accent text-accent-ink"
                          : wrongPick
                            ? "border-bad bg-bad text-surface"
                            : "border-line-strong text-ink-2"
                      }`}
                    >
                      {reveal && isCorrect ? <Icon name="check" size={14} /> : wrongPick ? <Icon name="x" size={14} /> : LETTERS[i]}
                    </span>
                    <span className="min-w-0 flex-1">
                      <RichText text={text} className="text-[1.0125rem] leading-snug" />
                      {reveal?.optionReasons?.[i] && (
                        <RichText text={reveal.optionReasons[i]} className="mt-1.5 text-sm leading-relaxed text-ink-2" />
                      )}
                    </span>
                    {reveal && state.submitted?.option === i && <span className="label shrink-0 pt-1">Your pick</span>}
                  </button>
                );
              })}
            </div>
          )}

          {q.format === "numeric" && open && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (canSubmit) void submit();
              }}
            >
              <label className="label mb-1.5 block" htmlFor="numeric-answer">
                Your answer{q.unit ? ` (${q.unit})` : ""}
              </label>
              <div className="flex items-stretch gap-2">
                <div className="relative flex-1">
                  {q.unit === "$" && <span className="absolute top-1/2 left-3.5 -translate-y-1/2 font-mono text-ink-3">$</span>}
                  <input
                    id="numeric-answer"
                    className={`field font-mono text-lg ${q.unit === "$" ? "pl-8" : ""}`}
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder="Type a number"
                    value={numberText}
                    onChange={(e) => setNumberText(e.target.value)}
                  />
                </div>
                {q.unit && q.unit !== "$" && (
                  <span className="grid place-items-center rounded-[10px] border border-line bg-surface-2 px-3 font-mono text-sm text-ink-2">
                    {q.unit}
                  </span>
                )}
              </div>
              <p className="mt-1.5 text-xs text-ink-3">
                Decimals or fractions like 1/6 are fine.
                {q.tolerance !== null && ` Accepted within ${formatNumber(q.tolerance * 100)}% of the exact value.`}
              </p>
            </form>
          )}

          {q.format === "numeric" && reveal && (
            <div className="grid grid-cols-2 gap-3">
              <div className={`rounded-xl border p-3.5 ${result?.outcome === "completed" ? (result.correct ? toneClass.good : toneClass.bad) : toneClass.neutral}`}>
                <div className="label">Your answer</div>
                <div className="mt-1 font-mono text-xl break-words tabular-nums">
                  {state.submitted?.value !== undefined ? withUnit(formatNumber(state.submitted.value), q.unit) : "–"}
                </div>
              </div>
              <div className="rounded-xl border border-accent bg-accent-soft p-3.5">
                <div className="label">Correct answer</div>
                <div className="mt-1 font-mono text-xl break-words tabular-nums">
                  {reveal.correctValue !== null ? withUnit(formatNumber(reveal.correctValue), q.unit) : "–"}
                </div>
              </div>
            </div>
          )}

          {q.format === "long" && open && (
            <div>
              <label className="label mb-1.5 block" htmlFor="long-answer">
                Your answer
              </label>
              <textarea
                id="long-answer"
                className="field min-h-[11rem] leading-relaxed"
                placeholder="Write out your reasoning. You will check it against the key points afterwards."
                value={longText}
                onChange={(e) => setLongText(e.target.value)}
              />
            </div>
          )}

          {q.format === "long" && state.submitted?.text && (
            <div className="rounded-xl border border-line bg-bg p-3.5">
              <div className="label mb-1">Your answer</div>
              <p className="text-[0.9675rem] leading-relaxed whitespace-pre-wrap">{state.submitted.text}</p>
            </div>
          )}

          {/* ── help tray */}
          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="label">Help</span>
              <span className="font-mono text-[11px] text-ink-3" aria-live="polite">
                Level {state.helpLevel} · {HELP_LABELS[state.helpLevel]}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                className={`btn btn-sm sm:min-h-11 ${referenceOpen ? "border-warn text-warn" : ""}`}
                aria-expanded={referenceOpen}
                disabled={busy}
                onClick={async () => {
                  if (referenceOpen) return setReferenceOpen(false);
                  if (state.reference !== null || (await act({ type: "reference" }))) setReferenceOpen(true);
                }}
              >
                <Icon name="book" size={15} className="hidden sm:block" />
                Reference
              </button>
              <button type="button" className="btn btn-sm sm:min-h-11" disabled={busy || hintsLeft <= 0} onClick={() => act({ type: "hint" })}>
                <Icon name="bulb" size={15} className="hidden sm:block" />
                Hint
                <span className="font-mono text-[11px] text-ink-3 tabular-nums">
                  {state.hints.length}/{state.hintsTotal}
                </span>
              </button>
              <button
                type="button"
                className={`btn btn-sm sm:min-h-11 ${confirming === "solution" ? "border-warn text-warn" : ""}`}
                disabled={busy || !open}
                onClick={() => setConfirming((c) => (c === "solution" ? null : "solution"))}
              >
                <Icon name="eye" size={15} className="hidden sm:block" />
                <span className="sm:hidden">Solution</span>
                <span className="hidden sm:inline">Show solution</span>
              </button>
            </div>

            {confirming && open && (
              <div className="rise mt-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-warn/50 bg-warn-soft px-3.5 py-2.5 text-sm">
                <span>
                  {confirming === "solution"
                    ? "Showing the solution ends this attempt. It will not count toward the category."
                    : "Giving up ends this attempt. It will not count toward the category."}
                </span>
                <span className="flex gap-2">
                  <button type="button" className="btn btn-sm btn-ghost" onClick={() => setConfirming(null)}>
                    Keep trying
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm"
                    disabled={busy}
                    onClick={async () => {
                      const kind = confirming;
                      setConfirming(null);
                      await act({ type: kind, activeMs: clock.readNow() });
                    }}
                  >
                    {confirming === "solution" ? "Show it" : "Give up"}
                  </button>
                </span>
              </div>
            )}

            {referenceOpen && state.reference !== null && (
              <div className="rise mt-2 rounded-xl border border-warn/40 bg-warn-soft px-4 py-3">
                <div className="label mb-1 !text-warn">Reference card</div>
                <RichText text={state.reference} className="text-[0.9675rem] leading-relaxed" />
              </div>
            )}
            {state.hints.length > 0 && (
              <ol className="mt-2 space-y-2">
                {state.hints.map((h, i) => (
                  <li key={i} className="rise flex gap-3 rounded-xl border border-line bg-surface-2/70 px-4 py-3">
                    <span className="label shrink-0 pt-0.5">Hint {i + 1}</span>
                    <RichText text={h} className="min-w-0 flex-1 text-[0.9675rem] leading-relaxed" />
                  </li>
                ))}
              </ol>
            )}
          </div>

          {error && (
            <p role="alert" className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">
              {error}
            </p>
          )}

          {/* ── submit row */}
          {open && (
            <div className="flex items-center justify-between gap-3 border-t border-line pt-4">
              <button
                type="button"
                className="btn btn-ghost"
                disabled={busy}
                onClick={() => setConfirming((c) => (c === "give_up" ? null : "give_up"))}
              >
                <Icon name="flag" size={15} />
                Give up
              </button>
              <button type="button" className="btn btn-primary min-w-[9rem]" disabled={!canSubmit} onClick={submit}>
                {q.format === "mcq" ? "Confirm" : "Submit"}
              </button>
            </div>
          )}

          {/* ── result and breakdown */}
          {banner && result && (
            <div ref={resultRef} className={`rise scroll-mt-20 rounded-xl border px-4 py-3.5 ${toneClass[banner.tone]}`} role="status">
              <div className="flex items-center gap-2 font-serif text-2xl leading-tight">
                {banner.tone === "good" && <Icon name="check" size={22} className="text-accent" />}
                {banner.tone === "bad" && <Icon name="x" size={22} className="text-bad" />}
                {banner.title}
              </div>
              <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs text-ink-2">
                <span>
                  Help level {result.helpLevel} · {HELP_LABELS[result.helpLevel]}
                </span>
                <span>Time {formatDuration(result.durationMs)}</span>
                <span>{result.counted ? `Counted toward ${categoryName(q.categoryId)}` : "Not counted toward the category"}</span>
              </div>
            </div>
          )}

          {q.format === "long" && reveal?.rubric && result?.outcome === "completed" && (
            <div className="rounded-xl border border-line p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="label">Self-check</div>
                <div className="font-mono text-xs text-ink-2 tabular-nums">
                  {tickCount} of {reveal.rubric.length} ticked · {reveal.ticksNeeded} needed
                </div>
              </div>
              <p className="mt-1 text-sm text-ink-2">
                {done ? "The key points, with the ones you ticked." : "Compare your answer with the solution below, then tick each key point you covered."}
              </p>
              <ul className="mt-3 space-y-2">
                {reveal.rubric.map((item, i) => {
                  const on = rubricTicks[i] ?? false;
                  return (
                    <li key={i}>
                      <label
                        className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 ${done ? "" : "cursor-pointer"} ${
                          on ? "border-accent bg-accent-soft" : "border-line"
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="mt-1 h-4 w-4 shrink-0 accent-[var(--accent)]"
                          checked={on}
                          disabled={done || busy}
                          onChange={(e) => {
                            const next = reveal.rubric!.map((_, j) => (j === i ? e.target.checked : (ticks[j] ?? false)));
                            setTicks(next);
                          }}
                        />
                        <RichText text={item} className="min-w-0 flex-1 text-[0.9675rem] leading-relaxed" />
                      </label>
                    </li>
                  );
                })}
              </ul>
              {!done && (
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={busy}
                    onClick={() => act({ type: "self_check", ticks: reveal.rubric!.map((_, j) => ticks[j] ?? false) })}
                  >
                    Save self-check
                  </button>
                </div>
              )}
            </div>
          )}

          {reveal && (
            <div className="rise rounded-xl border border-line bg-surface p-4 sm:p-5">
              <Section label="Short answer">
                <RichText text={reveal.shortAnswer} className="font-serif text-xl leading-snug" />
              </Section>
              <Section label="Steps">
                <RichText text={reveal.steps} />
              </Section>
              <Section label="Theory">
                <RichText text={reveal.theory} />
              </Section>
              <Section label="Intuition">
                <RichText text={reveal.intuition} />
              </Section>
            </div>
          )}

          {/* ── footer */}
          {!open && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
              <div className="flex gap-2">
                {onBack && (
                  <button type="button" className="btn btn-ghost" onClick={onBack.run}>
                    <Icon name="arrowLeft" size={15} />
                    {onBack.label}
                  </button>
                )}
                <button type="button" className="btn btn-ghost" onClick={() => onOpenQuestion(q.id)} title="Start a fresh attempt at this question">
                  <Icon name="retry" size={15} />
                  Try again
                </button>
              </div>
              <button type="button" className="btn btn-primary ml-auto min-w-[10rem]" onClick={onNext} disabled={state.phase === "self_check"}>
                {nextLabel}
                <Icon name="arrowRight" size={16} />
              </button>
            </div>
          )}
        </div>
      </article>

      {/* ── chat: side panel on desktop, bottom sheet on phones */}
      {chatOpen && (
        <>
          <button
            type="button"
            aria-label="Close chat"
            className="fixed inset-0 z-40 bg-black/45 lg:hidden"
            onClick={() => setChatOpen(false)}
          />
          <aside className="sheet-up card fixed inset-x-0 bottom-0 z-50 h-[80dvh] overflow-hidden rounded-b-none lg:sticky lg:top-20 lg:z-auto lg:h-[min(40rem,calc(100dvh-7rem))] lg:animate-none lg:rounded-b-[14px]">
            <ChatPanel attemptId={state.attemptId} ai={state.ai} initial={state.chat}
              onMessages={(chat) => setState((s) => ({ ...s, chat }))}
              onClose={() => setChatOpen(false)} />
          </aside>
        </>
      )}
    </div>
  );
}

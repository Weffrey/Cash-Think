"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/client";
import type { AttemptState } from "@/lib/practice";
import { AttemptView } from "./AttemptView";
import { Icon } from "./Icon";

const STORAGE_KEY = "dqt.attempt";

type Loaded = { attempt: AttemptState; resumed: boolean };
type View = { kind: "loading" } | { kind: "ready"; data: Loaded } | { kind: "empty" } | { kind: "error"; message: string };

function remember(id: string) {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // storage unavailable: a reload will simply load a new question
  }
}

function recall(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/** Next question from the selector. Null when no category is eligible. */
async function requestNext(): Promise<Loaded | null> {
  const res = await api<{ attempt: AttemptState | null }>("/api/next", { method: "POST" });
  return res.attempt ? { attempt: res.attempt, resumed: false } : null;
}

async function requestQuestion(id: number): Promise<Loaded> {
  const res = await api<{ attempt: AttemptState }>("/api/attempts", { method: "POST", body: { questionId: id } });
  return { attempt: res.attempt, resumed: false };
}

/** After a page reload, pick up the unfinished attempt if there is one; otherwise ask for the next question. */
async function requestResumeOrNext(): Promise<Loaded | null> {
  const stored = recall();
  if (stored) {
    try {
      const res = await api<{ attempt: AttemptState }>(`/api/attempts/${encodeURIComponent(stored)}`);
      if (res.attempt.phase !== "done") return { attempt: res.attempt, resumed: true };
    } catch {
      // the stored attempt is gone: fall through to a new question
    }
  }
  return requestNext();
}

/**
 * Loads attempts and shows them one at a time.
 * - selector mode (no questionId): asks the selector for the next question, and
 *   resumes an unfinished attempt after a page reload.
 * - question mode: opens the given question (used by Favorites).
 */
export function QuestionRunner({
  questionId,
  onBack,
  onAttemptChange,
}: {
  questionId?: number;
  onBack?: { label: string; run: () => void };
  onAttemptChange?: (state: AttemptState | null) => void;
}) {
  const selectorMode = questionId === undefined;
  const [view, setView] = useState<View>({ kind: "loading" });
  const started = useRef(false);
  const notify = useRef(onAttemptChange);
  useEffect(() => {
    notify.current = onAttemptChange;
  });

  const settle = useCallback(
    (request: Promise<Loaded | null>) => {
      request
        .then((data) => {
          if (data === null) {
            setView({ kind: "empty" });
            notify.current?.(null);
            return;
          }
          if (selectorMode) remember(data.attempt.attemptId);
          setView({ kind: "ready", data });
          notify.current?.(data.attempt);
          window.scrollTo({ top: 0 });
        })
        .catch((e: unknown) => {
          setView({ kind: "error", message: e instanceof ApiError ? e.message : "Could not load a question." });
        });
    },
    [selectorMode],
  );

  useEffect(() => {
    // Runs once. The router can hide and show this page again without losing the attempt.
    if (started.current) return;
    started.current = true;
    settle(questionId === undefined ? requestResumeOrNext() : requestQuestion(questionId));
  }, [questionId, settle]);

  const loadNext = () => {
    setView({ kind: "loading" });
    settle(requestNext());
  };
  const openQuestion = (id: number) => {
    setView({ kind: "loading" });
    settle(requestQuestion(id));
  };

  if (view.kind === "loading") {
    return (
      <div className="card mx-auto max-w-3xl p-6" aria-busy="true" aria-label="Loading question">
        <div className="flex gap-2">
          {[5.5, 4, 3.5].map((w) => (
            <div key={w} className="h-6 animate-pulse rounded-full bg-surface-2" style={{ width: `${w}rem` }} />
          ))}
        </div>
        <div className="mt-6 space-y-3">
          <div className="h-6 w-11/12 animate-pulse rounded bg-surface-2" />
          <div className="h-6 w-8/12 animate-pulse rounded bg-surface-2" />
        </div>
        <div className="mt-8 h-28 animate-pulse rounded-xl bg-surface-2" />
      </div>
    );
  }

  if (view.kind === "error") {
    return (
      <div className="card mx-auto max-w-xl p-6 text-center">
        <p className="font-serif text-2xl">That did not load</p>
        <p className="mt-2 text-sm text-ink-2">{view.message}</p>
        <button type="button" className="btn btn-primary mt-5" onClick={() => (questionId === undefined ? loadNext() : openQuestion(questionId))}>
          <Icon name="retry" size={15} />
          Try again
        </button>
      </div>
    );
  }

  if (view.kind === "empty") {
    return (
      <div className="card mx-auto max-w-xl p-6 text-center">
        <p className="font-serif text-2xl">No question to serve</p>
        <p className="mt-2 text-sm leading-relaxed text-ink-2">
          Every category is excluded, or the pinned categories have no questions. Give at least one category a weight above 0, or clear
          the pins.
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <Link href="/settings" className="btn btn-primary">
            <Icon name="settings" size={15} />
            Open settings
          </Link>
          <button type="button" className="btn" onClick={loadNext}>
            <Icon name="retry" size={15} />
            Try again
          </button>
        </div>
      </div>
    );
  }

  const { attempt, resumed } = view.data;
  return (
    <AttemptView
      key={attempt.attemptId}
      initial={attempt}
      resumed={resumed}
      nextLabel={selectorMode ? "Next question" : "Done"}
      onNext={selectorMode ? loadNext : (onBack?.run ?? (() => openQuestion(attempt.question.id)))}
      onOpenQuestion={openQuestion}
      onBack={onBack}
      onChange={(s) => {
        // Keep the latest server state here too, so a remount never shows a stale, reopened attempt.
        setView({ kind: "ready", data: { attempt: s, resumed: true } });
        notify.current?.(s);
      }}
    />
  );
}

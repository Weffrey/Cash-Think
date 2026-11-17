"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CategoryChip, DifficultyBadge, FormatChip } from "@/components/Badges";
import { Icon } from "@/components/Icon";
import { LoadError, PageHeader } from "@/components/PageHeader";
import { QuestionRunner } from "@/components/QuestionRunner";
import { RichText } from "@/components/RichText";
import { api, ApiError, HELP_LABELS } from "@/lib/client";
import type { PublicQuestion } from "@/lib/practice";
import type { HelpLevel, Outcome } from "@/lib/types";

interface Favorite {
  question: PublicQuestion;
  attempts: number;
  last: { outcome: Outcome; correct: boolean | null; helpLevel: HelpLevel; createdAt: number } | null;
}

function lastLine(f: Favorite): string {
  if (!f.last) return "Not attempted yet";
  const result =
    f.last.outcome === "gave_up"
      ? f.last.helpLevel === 3
        ? "solution shown"
        : "gave up"
      : f.last.correct === null
        ? "submitted"
        : f.last.correct
          ? "correct"
          : "wrong";
  const tries = f.attempts === 1 ? "1 attempt" : `${f.attempts} attempts`;
  return `${tries} · last: ${result}${f.last.outcome === "completed" ? `, ${HELP_LABELS[f.last.helpLevel].toLowerCase()}` : ""}`;
}

export default function FavoritesPage() {
  const [favorites, setFavorites] = useState<Favorite[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);

  const load = useCallback(() => {
    return api<{ favorites: Favorite[] }>("/api/favorites")
      .then((d) => {
        setFavorites(d.favorites);
        setError(null);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : "Could not load favorites."));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function remove(id: number) {
    setFavorites((list) => list?.filter((f) => f.question.id !== id) ?? null);
    try {
      await api(`/api/questions/${id}/favorite`, { method: "POST", body: { on: false } });
    } catch {
      void load();
    }
  }

  if (openId !== null) {
    const back = () => {
      setOpenId(null);
      void load();
    };
    return (
      <div className="space-y-4">
        <button type="button" className="btn btn-ghost btn-sm" onClick={back}>
          <Icon name="arrowLeft" size={15} />
          Favorites
        </button>
        <QuestionRunner key={openId} questionId={openId} onBack={{ label: "Favorites", run: back }} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Favorites" lead="Questions you starred. Open one to practice it again with a fresh attempt." />
      {error && <LoadError message={error} retry={load} />}
      {!error && favorites === null && <div className="card h-32 animate-pulse" aria-busy="true" />}
      {!error && favorites?.length === 0 && (
        <div className="card p-8 text-center">
          <Icon name="star" size={28} className="mx-auto text-ink-3" />
          <p className="mt-3 font-serif text-2xl">Nothing starred yet</p>
          <p className="mt-1 text-sm text-ink-2">Tap the star on any question to keep it here.</p>
          <Link href="/" className="btn btn-primary mt-5">
            Go to practice
          </Link>
        </div>
      )}
      <ul className="space-y-3">
        {favorites?.map((f) => (
          <li key={f.question.id} className="card rise overflow-hidden">
            <div className="flex flex-wrap items-center gap-2 px-4 pt-3.5 sm:px-5">
              <CategoryChip id={f.question.categoryId} />
              <FormatChip format={f.question.format} />
              <DifficultyBadge level={f.question.difficulty} compact />
              {!f.question.verified && <span className="chip border-warn bg-warn-soft text-warn">Unverified</span>}
            </div>
            <div className="px-4 pt-3 sm:px-5">
              <RichText text={f.question.prompt} className="line-clamp-3 font-serif text-[1.15rem] leading-snug" />
              <p className="mt-2 font-mono text-[11px] text-ink-3">{lastLine(f)}</p>
            </div>
            <div className="mt-3 flex items-center justify-between gap-2 border-t border-line px-3 py-2.5 sm:px-4">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => remove(f.question.id)}>
                <Icon name="star" size={15} filled className="text-warn" />
                Remove
              </button>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => setOpenId(f.question.id)}>
                Practice
                <Icon name="arrowRight" size={15} />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

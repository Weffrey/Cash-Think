"use client";

import { useEffect, useState } from "react";
import type { BalanceRow } from "@/lib/balance";
import { api } from "@/lib/client";
import type { Settings } from "@/lib/types";
import { categoryName, SHORT_NAMES, two } from "./Badges";

interface Payload {
  settings: Settings;
  balance: BalanceRow[];
}

/**
 * The compact strip above a practice question: one cell per category with its counter,
 * the current category highlighted, and the difficulty mix at the end.
 */
export function BalanceTape({ currentCategoryId, refreshKey }: { currentCategoryId: number | null; refreshKey: number }) {
  const [data, setData] = useState<Payload | null>(null);

  useEffect(() => {
    let live = true;
    api<Payload>("/api/settings")
      .then((d) => live && setData(d))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [refreshKey]);

  if (!data) return <div className="h-8" aria-hidden="true" />;
  const pinned = data.settings.pinnedCategories;
  const { baseDifficulty, stretchPct } = data.settings;
  return (
    <div
      className="scroll-slim -mx-4 flex items-center gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0"
      aria-label="Completed questions per category"
    >
      <span className="label shrink-0 pr-1">Balance</span>
      {data.balance.map((row) => {
        const current = row.categoryId === currentCategoryId;
        const off = row.weight === 0 || (pinned.length > 0 && !pinned.includes(row.categoryId));
        const delta = row.delta === null ? "excluded" : `${row.delta >= 0 ? "+" : ""}${row.delta.toFixed(1)} vs target`;
        return (
          <span
            key={row.categoryId}
            title={`${categoryName(row.categoryId)}: ${row.count} done (${delta})`}
            className={`flex h-7 shrink-0 items-center gap-1.5 rounded-md border px-2 font-mono text-[11px] ${
              current ? "border-accent bg-accent-soft text-ink" : "border-line bg-surface text-ink-2"
            } ${off ? "opacity-40" : ""}`}
          >
            <span className={current ? "text-accent" : "text-ink-3"}>{two(row.categoryId)}</span>
            {current && <span className="font-sans text-xs">{SHORT_NAMES[row.categoryId]}</span>}
            <span className="font-semibold tabular-nums">{row.count}</span>
          </span>
        );
      })}
      <span
        className="ml-1 flex h-7 shrink-0 items-center rounded-md border border-dashed border-line-strong px-2 font-mono text-[11px] text-ink-2"
        title={`Base difficulty ${baseDifficulty}, ${stretchPct}% of questions one level harder`}
      >
        L{baseDifficulty}
        {stretchPct > 0 && baseDifficulty < 5 ? ` · ${stretchPct}% L${baseDifficulty + 1}` : ""}
      </span>
    </div>
  );
}

import { CATEGORIES } from "@/lib/categories";
import type { Format } from "@/lib/types";

/** Short category names for chips and narrow screens. */
export const SHORT_NAMES: Record<number, string> = {
  1: "Probability",
  2: "Math",
  3: "Markets",
  4: "Pricing",
  5: "Risk",
  6: "Corp fin",
  7: "Accounting",
  8: "Macro",
  9: "Structure",
  10: "Programming",
  11: "Judgment",
  12: "Industry",
};

export const categoryName = (id: number) => CATEGORIES.find((c) => c.id === id)?.name ?? `Category ${id}`;
export const two = (n: number) => String(n).padStart(2, "0");

export function CategoryChip({ id }: { id: number }) {
  return (
    <span className="chip" title={categoryName(id)}>
      <span className="text-accent">{two(id)}</span>
      <span className="sm:hidden">{SHORT_NAMES[id] ?? categoryName(id)}</span>
      <span className="hidden sm:inline">{categoryName(id)}</span>
    </span>
  );
}

const FORMAT_SHORT: Record<Format, string> = { mcq: "MCQ", numeric: "Numeric", long: "Written" };

export function FormatChip({ format }: { format: Format }) {
  return <span className="chip uppercase">{FORMAT_SHORT[format]}</span>;
}

/** Difficulty 1 to 5 as rising bars plus the number. */
export function DifficultyBadge({ level, compact = false }: { level: number; compact?: boolean }) {
  return (
    <span className="chip" title={`Difficulty ${level} of 5`} aria-label={`Difficulty ${level} of 5`}>
      <span className="flex h-3 items-end gap-[2px]" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((i) => (
          <span
            key={i}
            className={`w-[3px] rounded-[1px] ${i <= level ? "bg-warn" : "bg-line-strong"}`}
            style={{ height: `${4 + i * 1.6}px` }}
          />
        ))}
      </span>
      <span>{compact ? `L${level}` : `Level ${level}`}</span>
    </span>
  );
}

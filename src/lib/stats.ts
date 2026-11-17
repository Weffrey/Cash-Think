import { CATEGORIES } from "./categories";
import { countsTowardCategory } from "./selector";
import type { Attempt, Format, HelpLevel, Outcome, Question } from "./types";

export interface CategoryStats {
  categoryId: number;
  name: string;
  /** completed with no help (level 0) */
  independent: number;
  /** completed after opening the reference card (level 1) */
  theoryHelp: number;
  /** completed after a hint (level 2) */
  hinted: number;
  /** gave up or showed the solution first: not counted */
  notCounted: number;
  /** of the completed attempts that have a result, how many were right */
  correct: number;
  graded: number;
}

export interface HistoryRow {
  attemptId: number;
  questionId: number;
  categoryId: number;
  format: Format;
  difficulty: number;
  prompt: string;
  outcome: Outcome;
  correct: boolean | null;
  helpLevel: HelpLevel;
  durationMs: number | null;
  createdAt: number;
  counted: boolean;
  /** which attempt at this question this was, starting at 1 */
  attemptNumber: number;
  verified: boolean;
}

export interface Stats {
  categories: CategoryStats[];
  /** newest first */
  history: HistoryRow[];
  totals: { attempts: number; counted: number; independent: number; assisted: number; notCounted: number };
}

export function computeStats(attempts: Attempt[], questions: Question[]): Stats {
  const byId = new Map(questions.map((q) => [q.id, q]));
  const categories: CategoryStats[] = CATEGORIES.map((c) => ({
    categoryId: c.id,
    name: c.name,
    independent: 0,
    theoryHelp: 0,
    hinted: 0,
    notCounted: 0,
    correct: 0,
    graded: 0,
  }));
  const cat = new Map(categories.map((c) => [c.categoryId, c]));
  const seen = new Map<number, number>();
  const history: HistoryRow[] = [];
  for (const a of [...attempts].sort((x, y) => x.id - y.id)) {
    const c = cat.get(a.categoryId);
    const counted = countsTowardCategory(a);
    if (c) {
      if (!counted) c.notCounted++;
      else if (a.helpLevel === 0) c.independent++;
      else if (a.helpLevel === 1) c.theoryHelp++;
      else c.hinted++;
      if (a.outcome === "completed" && a.correct !== null) {
        c.graded++;
        if (a.correct) c.correct++;
      }
    }
    const n = (seen.get(a.questionId) ?? 0) + 1;
    seen.set(a.questionId, n);
    const q = byId.get(a.questionId);
    history.push({
      attemptId: a.id,
      questionId: a.questionId,
      categoryId: a.categoryId,
      format: q?.format ?? "mcq",
      difficulty: q?.difficulty ?? 1,
      prompt: q?.prompt ?? "(question removed)",
      outcome: a.outcome,
      correct: a.correct,
      helpLevel: a.helpLevel,
      durationMs: a.durationMs,
      createdAt: a.createdAt,
      counted,
      attemptNumber: n,
      verified: q?.verified ?? true,
    });
  }
  history.reverse();
  const sum = (f: (c: CategoryStats) => number) => categories.reduce((s, c) => s + f(c), 0);
  const independent = sum((c) => c.independent);
  const assisted = sum((c) => c.theoryHelp + c.hinted);
  const notCounted = sum((c) => c.notCounted);
  return {
    categories,
    history,
    totals: { attempts: attempts.length, counted: independent + assisted, independent, assisted, notCounted },
  };
}

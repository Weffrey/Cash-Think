export type Format = "mcq" | "numeric" | "long";
export type Outcome = "completed" | "gave_up";
/** 0 independent, 1 reference card opened, 2 hint used, 3 solution shown before answering */
export type HelpLevel = 0 | 1 | 2 | 3;

export interface Question {
  id: number;
  categoryId: number;
  format: Format;
  /** 1 (easiest) to 5 (hardest) */
  difficulty: number;
  prompt: string;
  // MCQ
  options: string[] | null;
  correctOption: number | null;
  optionReasons: string[] | null;
  // Numeric
  correctValue: number | null;
  /** relative tolerance, 0.01 means within 1% */
  tolerance: number | null;
  unit: string | null;
  // Long written answer
  rubric: string[] | null;
  // Help tray (all stored text, no AI)
  referenceCard: string;
  hints: string[];
  // Breakdown
  shortAnswer: string;
  steps: string;
  theory: string;
  intuition: string;
  parentId: number | null;
  verified: boolean;
}

export type NewQuestion = Omit<Question, "id">;

export interface Attempt {
  id: number;
  questionId: number;
  categoryId: number;
  outcome: Outcome;
  helpLevel: HelpLevel;
  durationMs: number | null;
  correct: boolean | null;
  createdAt: number;
}

export interface Settings {
  /** 1 to 5 */
  baseDifficulty: number;
  /** percent of questions served one level above the base level, 0 to 100 */
  stretchPct: number;
  /** per-category weight, missing means 1, 0 excludes the category */
  weights: Record<number, number>;
  /** if non-empty, only these categories are used */
  pinnedCategories: number[];
}

export const DEFAULT_SETTINGS: Settings = {
  baseDifficulty: 1,
  stretchPct: 20,
  weights: {},
  pinnedCategories: [],
};

export type Counters = Record<number, number>;

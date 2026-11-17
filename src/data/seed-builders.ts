import type { NewQuestion } from "../lib/types";

type Common = {
  categoryId: number;
  difficulty: number;
  prompt: string;
  referenceCard: string;
  hints: string[];
  shortAnswer: string;
  steps: string;
  theory: string;
  intuition: string;
};

const base = {
  options: null,
  correctOption: null,
  optionReasons: null,
  correctValue: null,
  tolerance: null,
  unit: null,
  rubric: null,
  parentId: null,
  verified: true,
};

/** correctOption is a zero-based index into options. */
export function mcq(c: Common & { options: string[]; correctOption: number; optionReasons: string[] }): NewQuestion {
  return { ...base, ...c, format: "mcq" };
}

/** tolerance is relative: 0.01 means within 1% of correctValue. */
export function numeric(c: Common & { correctValue: number; tolerance: number; unit: string | null }): NewQuestion {
  return { ...base, ...c, format: "numeric" };
}

export function long(c: Common & { rubric: string[] }): NewQuestion {
  return { ...base, ...c, format: "long" };
}

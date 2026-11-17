/**
 * Answer checking. Pure functions, no database and no AI.
 */

/** Zero-based option index against the stored correct option. */
export function checkMcq(correctOption: number, chosen: number): boolean {
  return Number.isInteger(chosen) && chosen === correctOption;
}

/**
 * Relative tolerance check: |value - correct| <= tolerance * |correct|.
 * A relative tolerance is meaningless when the correct value is 0, so in that
 * case the tolerance is used as an absolute band: |value| <= tolerance.
 */
export function checkNumeric(correct: number, tolerance: number, value: number): boolean {
  if (!Number.isFinite(value) || !Number.isFinite(correct)) return false;
  const tol = Math.max(0, tolerance);
  const band = correct === 0 ? tol : tol * Math.abs(correct);
  // The tiny slack keeps answers exactly on the edge of the band from failing on float rounding.
  return Math.abs(value - correct) <= band + 1e-12;
}

/**
 * Parse what the user typed into the number field. Accepts plain numbers, thousands
 * separators, a leading currency sign, simple fractions like 1/6, and a trailing percent
 * sign. "12%" means 12 when the question's unit is already percent, otherwise 0.12.
 * Returns null when the text is not a number.
 */
export function parseNumericInput(raw: string, unit: string | null = null): number | null {
  let s = raw
    .trim()
    .replace(/[\s,_]/g, "")
    .replace(/^([+-]?)[$€£]/, "$1");
  if (s === "") return null;
  let percent = false;
  if (s.endsWith("%")) {
    percent = true;
    s = s.slice(0, -1);
  }
  const NUM = /^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i;
  let value: number;
  const parts = s.split("/");
  if (parts.length === 2) {
    if (!NUM.test(parts[0]) || !NUM.test(parts[1])) return null;
    const den = Number(parts[1]);
    if (den === 0) return null;
    value = Number(parts[0]) / den;
  } else if (parts.length === 1 && NUM.test(s)) {
    value = Number(s);
  } else {
    return null;
  }
  if (!Number.isFinite(value)) return null;
  if (percent && !(unit ?? "").includes("%")) value /= 100;
  return value;
}

/** Number of rubric items that must be ticked for a long answer to count as correct: two thirds, rounded up. */
export function ticksNeeded(rubricLength: number): number {
  return Math.ceil((2 * rubricLength) / 3);
}

/** Long answers are self-checked: correct when at least two thirds of the rubric is ticked. */
export function checkSelfTicks(ticks: boolean[]): boolean {
  if (ticks.length === 0) return false;
  return ticks.filter(Boolean).length >= ticksNeeded(ticks.length);
}

import { describe, expect, it } from "vitest";
import { checkMcq, checkNumeric, checkSelfTicks, parseNumericInput, ticksNeeded } from "./checking";

describe("checkMcq", () => {
  it("accepts only the stored option", () => {
    expect(checkMcq(2, 2)).toBe(true);
    expect(checkMcq(2, 0)).toBe(false);
    expect(checkMcq(0, 0)).toBe(true);
  });

  it("rejects values that are not option indexes", () => {
    expect(checkMcq(1, 1.5)).toBe(false);
    expect(checkMcq(1, Number.NaN)).toBe(false);
  });
});

describe("checkNumeric", () => {
  it("accepts the exact value and values inside the relative band", () => {
    expect(checkNumeric(100, 0.01, 100)).toBe(true);
    expect(checkNumeric(100, 0.01, 100.9)).toBe(true);
    expect(checkNumeric(100, 0.01, 99.1)).toBe(true);
  });

  it("accepts values exactly on the edge of the band and rejects values just outside", () => {
    expect(checkNumeric(100, 0.01, 101)).toBe(true);
    expect(checkNumeric(100, 0.01, 99)).toBe(true);
    expect(checkNumeric(100, 0.01, 101.01)).toBe(false);
    expect(checkNumeric(100, 0.01, 98.99)).toBe(false);
    // 0.1 * 3 is 0.30000000000000004 in floating point; the edge must still pass
    expect(checkNumeric(0.3, 0, 0.1 * 3)).toBe(true);
  });

  it("uses the size of the correct value, so negative answers work", () => {
    expect(checkNumeric(-50, 0.02, -50.9)).toBe(true);
    expect(checkNumeric(-50, 0.02, -51.1)).toBe(false);
    expect(checkNumeric(-50, 0.02, 50)).toBe(false);
  });

  it("treats the tolerance as an absolute band when the correct value is 0", () => {
    expect(checkNumeric(0, 0.01, 0)).toBe(true);
    expect(checkNumeric(0, 0.01, 0.005)).toBe(true);
    expect(checkNumeric(0, 0.01, -0.01)).toBe(true);
    expect(checkNumeric(0, 0.01, 0.02)).toBe(false);
    expect(checkNumeric(0, 0.01, -0.5)).toBe(false);
  });

  it("works for very small and very large correct values", () => {
    expect(checkNumeric(0.0004, 0.01, 0.000403)).toBe(true);
    expect(checkNumeric(0.0004, 0.01, 0.00041)).toBe(false);
    expect(checkNumeric(1e9, 0.001, 1.0005e9)).toBe(true);
    expect(checkNumeric(1e9, 0.001, 1.002e9)).toBe(false);
  });

  it("rejects answers that are not finite numbers", () => {
    expect(checkNumeric(1, 0.01, Number.NaN)).toBe(false);
    expect(checkNumeric(1, 0.01, Infinity)).toBe(false);
    expect(checkNumeric(0, 0.01, Number.NaN)).toBe(false);
  });

  it("a zero tolerance demands the exact value", () => {
    expect(checkNumeric(20, 0, 20)).toBe(true);
    expect(checkNumeric(20, 0, 20.001)).toBe(false);
  });
});

describe("parseNumericInput", () => {
  it("reads plain numbers, signs, and scientific notation", () => {
    expect(parseNumericInput("4.25")).toBe(4.25);
    expect(parseNumericInput("  -3 ")).toBe(-3);
    expect(parseNumericInput(".5")).toBe(0.5);
    expect(parseNumericInput("1e3")).toBe(1000);
    expect(parseNumericInput("0")).toBe(0);
  });

  it("reads thousands separators and currency signs", () => {
    expect(parseNumericInput("46,600")).toBe(46600);
    expect(parseNumericInput("$1,250.50")).toBe(1250.5);
    expect(parseNumericInput("-$4")).toBe(-4);
  });

  it("reads simple fractions", () => {
    expect(parseNumericInput("1/6")).toBeCloseTo(1 / 6, 12);
    expect(parseNumericInput("161 / 36")).toBeCloseTo(161 / 36, 12);
    expect(parseNumericInput("1/0")).toBeNull();
    expect(parseNumericInput("1/2/3")).toBeNull();
  });

  it("reads a percent sign according to the unit of the question", () => {
    expect(parseNumericInput("7.5%", "%")).toBe(7.5);
    expect(parseNumericInput("20%", null)).toBeCloseTo(0.2, 12);
    expect(parseNumericInput("20%", "$")).toBeCloseTo(0.2, 12);
  });

  it("returns null for anything that is not a number", () => {
    for (const bad of ["", "   ", "abc", "1.2.3", "12abc", "--4", "1e", "$", "%", "Infinity", "NaN", "0x10"]) {
      expect(parseNumericInput(bad)).toBeNull();
    }
  });
});

describe("self-check rule for long answers", () => {
  it("needs two thirds of the rubric, rounded up", () => {
    expect(ticksNeeded(3)).toBe(2);
    expect(ticksNeeded(4)).toBe(3);
    expect(ticksNeeded(5)).toBe(4);
    expect(ticksNeeded(6)).toBe(4);
  });

  it("marks the answer correct only at or above that number of ticks", () => {
    expect(checkSelfTicks([true, true, false])).toBe(true);
    expect(checkSelfTicks([true, false, false])).toBe(false);
    expect(checkSelfTicks([true, true, true, false])).toBe(true);
    expect(checkSelfTicks([true, true, false, false])).toBe(false);
    expect(checkSelfTicks([false, false, false])).toBe(false);
    expect(checkSelfTicks([])).toBe(false);
  });
});

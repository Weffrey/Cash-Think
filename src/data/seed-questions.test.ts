import { describe, expect, it } from "vitest";
import { CATEGORY_IDS } from "../lib/categories";
import { SEED_QUESTIONS } from "./seed-questions";

/** Prompts of the questions whose answers were looked up (and so recomputed) by a test in this file. */
const checked = new Set<string>();

function find(prefix: string) {
  const matches = SEED_QUESTIONS.filter((x) => x.prompt.startsWith(prefix));
  if (matches.length !== 1) {
    throw new Error(`Expected exactly one seed question starting with "${prefix}", found ${matches.length}`);
  }
  checked.add(matches[0].prompt);
  return matches[0];
}

describe("seed question structure", () => {
  it("covers every category", () => {
    const covered = new Set(SEED_QUESTIONS.map((q) => q.categoryId));
    for (const id of CATEGORY_IDS) expect(covered.has(id)).toBe(true);
  });

  it("gives every question a reference card, a breakdown, and a valid difficulty", () => {
    for (const q of SEED_QUESTIONS) {
      expect(q.referenceCard.length).toBeGreaterThan(0);
      expect(q.shortAnswer.length).toBeGreaterThan(0);
      expect(q.steps.length).toBeGreaterThan(0);
      expect(q.theory.length).toBeGreaterThan(0);
      expect(q.intuition.length).toBeGreaterThan(0);
      expect(q.difficulty).toBeGreaterThanOrEqual(1);
      expect(q.difficulty).toBeLessThanOrEqual(5);
    }
  });

  it("has well-formed multiple choice questions", () => {
    for (const q of SEED_QUESTIONS.filter((x) => x.format === "mcq")) {
      expect(q.options).not.toBeNull();
      expect(q.optionReasons).toHaveLength(q.options!.length);
      expect(q.correctOption).toBeGreaterThanOrEqual(0);
      expect(q.correctOption).toBeLessThan(q.options!.length);
    }
  });

  it("has numeric answers with a tolerance and long answers with a rubric", () => {
    for (const q of SEED_QUESTIONS.filter((x) => x.format === "numeric")) {
      expect(q.correctValue).not.toBeNull();
      expect(q.tolerance).toBeGreaterThan(0);
    }
    for (const q of SEED_QUESTIONS.filter((x) => x.format === "long")) {
      expect(q.rubric!.length).toBeGreaterThanOrEqual(3);
    }
  });
});

describe("seed answers, recomputed independently", () => {
  it("two dice summing to 7", () => {
    let hits = 0;
    for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) if (a + b === 7) hits++;
    expect(find("Two fair six-sided dice").correctValue).toBeCloseTo(hits / 36, 10);
  });

  it("Bayes disease test", () => {
    const posterior = (0.99 * 0.01) / (0.99 * 0.01 + 0.05 * 0.99);
    expect(posterior).toBeCloseTo(0.1667, 3);
    expect(find("A disease affects").correctOption).toBe(2);
  });

  it("derivative of x^2 e^x at 1, by finite differences", () => {
    const f = (x: number) => x * x * Math.exp(x);
    const h = 1e-6;
    const numerical = (f(1 + h) - f(1 - h)) / (2 * h);
    expect(find("Let f(x)").correctValue).toBeCloseTo(numerical, 4);
  });

  it("one-period binomial call price by replication", () => {
    // Replicate with delta shares and bond: delta = (20 - 0) / (120 - 80)
    const delta = 20 / 40;
    const bond = (0 - delta * 80) / 1.05;
    const price = delta * 100 + bond;
    expect(find("A stock is at $100").correctValue).toBeCloseTo(price, 8);
  });

  it("Sharpe ratio and equity value", () => {
    expect(find("A portfolio returned").correctValue).toBeCloseTo((0.12 - 0.02) / 0.2, 10);
    expect(find("A company has an enterprise value").correctValue).toBe(500 - 200 + 50);
  });

  it("die with one optional re-roll", () => {
    let ev = 0;
    for (let first = 1; first <= 6; first++) ev += Math.max(first, 3.5) / 6;
    expect(find("You roll a fair six-sided die").correctValue).toBeCloseTo(ev, 10);
  });

  it("expected flips for HH and HT, by simulation", () => {
    let s = 12345;
    const rand = () => {
      s = (s * 1664525 + 1013904223) % 4294967296;
      return s / 4294967296;
    };
    const wait = (pattern: string) => {
      let total = 0;
      const trials = 40000;
      for (let t = 0; t < trials; t++) {
        let seq = "";
        let flips = 0;
        while (!seq.endsWith(pattern)) {
          seq += rand() < 0.5 ? "H" : "T";
          flips++;
          if (seq.length > 2) seq = seq.slice(-2);
        }
        total += flips;
      }
      return total / trials;
    };
    expect(wait("HH")).toBeGreaterThan(5.9);
    expect(wait("HH")).toBeLessThan(6.1);
    expect(wait("HT")).toBeGreaterThan(3.9);
    expect(wait("HT")).toBeLessThan(4.1);
  });

  it("put-call parity numerically", () => {
    // Black-Scholes call and put satisfy C - P = S - K e^(-rT)
    const S = 100, K = 95, r = 0.04, T = 0.75, sigma = 0.3;
    const N = (x: number) => 0.5 * (1 + erf(x / Math.SQRT2));
    function erf(x: number) {
      const t = 1 / (1 + 0.3275911 * Math.abs(x));
      const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
      return x >= 0 ? y : -y;
    }
    const d1 = (Math.log(S / K) + (r + (sigma * sigma) / 2) * T) / (sigma * Math.sqrt(T));
    const d2 = d1 - sigma * Math.sqrt(T);
    const C = S * N(d1) - K * Math.exp(-r * T) * N(d2);
    const P = K * Math.exp(-r * T) * N(-d2) - S * N(-d1);
    expect(C - P).toBeCloseTo(S - K * Math.exp(-r * T), 4);
    expect(find("For European options").correctOption).toBe(1);
  });
});

// Shared numerical helpers for the recomputations below.
function erfApprox(x: number) {
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return x >= 0 ? y : -y;
}
const normCdf = (x: number) => 0.5 * (1 + erfApprox(x / Math.SQRT2));
function bsCall(S: number, K: number, r: number, sigma: number, T: number) {
  const d1 = (Math.log(S / K) + (r + (sigma * sigma) / 2) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);
  return { price: S * normCdf(d1) - K * Math.exp(-r * T) * normCdf(d2), delta: normCdf(d1) };
}
/** Index of the single option that matches the pattern. */
function optionMatching(options: string[], pattern: RegExp) {
  const hits = options.map((o, i) => ({ o, i })).filter(({ o }) => pattern.test(o));
  expect(hits).toHaveLength(1);
  return hits[0].i;
}

describe("second batch of seed answers, recomputed independently", () => {
  it("has at least 40 questions, at least 3 per category, and all three formats", () => {
    expect(SEED_QUESTIONS.length).toBeGreaterThanOrEqual(40);
    for (const id of CATEGORY_IDS) {
      expect(SEED_QUESTIONS.filter((q) => q.categoryId === id).length).toBeGreaterThanOrEqual(3);
    }
    for (const f of ["mcq", "numeric", "long"]) {
      expect(SEED_QUESTIONS.filter((q) => q.format === f).length).toBeGreaterThanOrEqual(4);
    }
    expect(new Set(SEED_QUESTIONS.map((q) => q.prompt)).size).toBe(SEED_QUESTIONS.length);
    for (const q of SEED_QUESTIONS) {
      expect(q.hints.length).toBeGreaterThanOrEqual(1);
      expect(q.verified).toBe(true);
      expect(q.parentId).toBeNull();
    }
  });

  it("exactly 5 heads in 10 flips, by enumerating all 1024 sequences", () => {
    let hits = 0;
    for (let mask = 0; mask < 1024; mask++) {
      let heads = 0;
      for (let b = 0; b < 10; b++) if (mask & (1 << b)) heads++;
      if (heads === 5) hits++;
    }
    expect(find("A fair coin is flipped 10 times").correctValue).toBeCloseTo(hits / 1024, 12);
  });

  it("Kelly fraction, by maximizing expected log growth on a grid", () => {
    let best = 0;
    let bestGrowth = -Infinity;
    for (let f = 0; f < 0.999; f += 0.0005) {
      const g = 0.6 * Math.log(1 + f) + 0.4 * Math.log(1 - f);
      if (g > bestGrowth) {
        bestGrowth = g;
        best = f;
      }
    }
    expect(find("You can bet repeatedly").correctValue).toBeCloseTo(best, 3);
  });

  it("eigenvalues of [[2,1],[1,2]]: only the correct option solves the characteristic equation", () => {
    const q = find("What are the eigenvalues");
    const A = [
      [2, 1],
      [1, 2],
    ];
    const isEigen = (l: number) => Math.abs((A[0][0] - l) * (A[1][1] - l) - A[0][1] * A[1][0]) < 1e-12;
    const valid = q.options!.map((o) => {
      const nums = o.match(/-?\d+(\.\d+)?/g)!.map(Number);
      // both listed numbers must be eigenvalues and together they must account for the trace
      return nums.every(isEigen) && nums.reduce((a, b) => a + b, 0) === A[0][0] + A[1][1];
    });
    expect(valid.filter(Boolean)).toHaveLength(1);
    expect(q.correctOption).toBe(valid.indexOf(true));
  });

  it("integral of 3x^2 from 0 to 2, by the midpoint rule", () => {
    const n = 200000;
    let sum = 0;
    for (let i = 0; i < n; i++) {
      const x = ((i + 0.5) * 2) / n;
      sum += 3 * x * x * (2 / n);
    }
    expect(find("Compute the definite integral").correctValue).toBeCloseTo(sum, 6);
  });

  it("drift of ln S under GBM, by integrating one small Euler step over the normal density", () => {
    const mu = 0.1, sigma = 0.2, dt = 1e-4;
    // E[ln(S_{t+dt} / S_t)] / dt with S_{t+dt} = S_t (1 + mu dt + sigma sqrt(dt) Z), Z standard normal
    let mean = 0;
    const h = 0.001;
    for (let z = -8; z <= 8; z += h) {
      const density = Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI);
      mean += Math.log(1 + mu * dt + sigma * Math.sqrt(dt) * z) * density * h;
    }
    const drift = mean / dt;
    expect(drift).toBeCloseTo(0.08, 3);
    expect(find("A stock follows geometric Brownian motion").correctValue).toBeCloseTo(drift, 3);
  });

  it("zero-coupon bond price, by growing the price forward", () => {
    const price = find("A zero-coupon bond pays").correctValue!;
    expect(price * 1.05 * 1.05).toBeCloseTo(1000, 8);
    expect(price).toBeCloseTo(907.03, 2);
  });

  it("at-the-money one-month call delta is about 0.5 across plausible inputs", () => {
    const q = find("A stock trades at $100. Roughly what is the delta");
    for (const sigma of [0.15, 0.25, 0.4]) {
      for (const r of [0, 0.03, 0.05]) {
        const { delta } = bsCall(100, 100, r, sigma, 1 / 12);
        expect(delta).toBeGreaterThan(0.5);
        expect(delta).toBeLessThan(0.56);
      }
    }
    expect(q.correctOption).toBe(optionMatching(q.options!, /^About 0\.5$/));
  });

  it("forward price, as the limit of compounding the financing cost many times", () => {
    const n = 1e6;
    const financed = 100 * Math.pow(1 + 0.04 / n, n * 0.5);
    const q = find("A stock that pays no dividends trades at $100. The risk-free rate is 4%");
    expect(q.correctValue).toBeCloseTo(financed, 4);
    expect(q.correctValue).toBeCloseTo(102.02, 2);
  });

  it("risk-neutral expected return equals the risk-free rate in the binomial example", () => {
    const q = find("Under the risk-neutral measure");
    // The probability that prices the stock itself correctly: up * 120 + (1 - up) * 80 = 100 * 1.05
    const up = (100 * 1.05 - 80) / (120 - 80);
    const expectedReturn = (up * 120 + (1 - up) * 80) / 100 - 1;
    expect(expectedReturn).toBeCloseTo(0.05, 12);
    expect(q.correctOption).toBe(optionMatching(q.options!, /^The risk-free rate$/));
  });

  it("put price from parity, checked by payoff replication", () => {
    // call + K/(1+r) in bonds - one share pays max(K - S_T, 0), the put payoff, in every state
    for (const sT of [0, 40, 99, 100, 101, 180]) {
      const payoff = Math.max(sT - 100, 0) + 100 - sT;
      expect(payoff).toBeCloseTo(Math.max(100 - sT, 0), 12);
    }
    const cost = 8 + 100 / 1.05 - 100;
    const q = find("A stock that pays no dividends trades at $100. A 1-year European call");
    expect(q.correctValue).toBeCloseTo(cost, 10);
    expect(q.correctValue).toBeCloseTo(3.24, 2);
  });

  it("Black-Scholes call price, from the formula and from numerical integration of the payoff", () => {
    const q = find("Use Black-Scholes");
    const formula = bsCall(100, 100, 0.05, 0.2, 1).price;
    // Risk-neutral expectation: S_T = 100 exp((r - sigma^2/2) + sigma Z)
    let integral = 0;
    const h = 0.0005;
    for (let z = -10; z <= 10; z += h) {
      const sT = 100 * Math.exp(0.05 - 0.02 + 0.2 * z);
      integral += Math.max(sT - 100, 0) * (Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI)) * h;
    }
    integral *= Math.exp(-0.05);
    expect(formula).toBeCloseTo(integral, 3);
    expect(q.correctValue).toBeCloseTo(integral, 3);
    // The rounded table values given in the prompt must land inside the tolerance.
    const withTable = 100 * 0.6368 - 100 * 0.9512 * 0.5596;
    expect(Math.abs(withTable - q.correctValue!) / q.correctValue!).toBeLessThan(q.tolerance!);
  });

  it("two-asset portfolio volatility, from the covariance matrix", () => {
    const w = [0.5, 0.5];
    const cov = [
      [0.2 * 0.2, 0],
      [0, 0.1 * 0.1],
    ];
    let variance = 0;
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) variance += w[i] * cov[i][j] * w[j];
    const q = find("A portfolio holds 50% in asset A");
    expect(q.correctValue).toBeCloseTo(Math.sqrt(variance) * 100, 10);
    expect(q.correctValue).toBeCloseTo(11.18, 2);
  });

  it("CAPM expected return", () => {
    const q = find("The risk-free rate is 3%, the expected return of the market is 9%");
    const expected = 3 + 1.5 * (9 - 3);
    expect(expected).toBe(12);
    expect(q.correctOption).toBe(optionMatching(q.options!, /^12%$/));
  });

  it("99% one-day VaR, with z found by bisection on the normal CDF", () => {
    let lo = 0, hi = 5;
    for (let i = 0; i < 60; i++) {
      const mid = (lo + hi) / 2;
      if (normCdf(mid) < 0.99) lo = mid;
      else hi = mid;
    }
    const q = find("A portfolio is worth $1,000,000");
    expect(lo).toBeCloseTo(2.33, 2);
    expect(q.correctValue).toBeCloseTo(2.33 * 0.02 * 1_000_000, 6);
    // An answer using the exact quantile is still inside the tolerance.
    expect(Math.abs(lo * 20000 - q.correctValue!) / q.correctValue!).toBeLessThan(q.tolerance!);
  });

  it("WACC", () => {
    const wacc = 0.6 * 10 + 0.4 * 5 * (1 - 0.25);
    expect(find("A company is financed with 60% equity").correctValue).toBeCloseTo(wacc, 10);
  });

  it("growing perpetuity, by summing the discounted cash flows", () => {
    let pv = 0;
    let cf = 100;
    for (let t = 1; t <= 3000; t++) {
      pv += cf / Math.pow(1.1, t);
      cf *= 1.02;
    }
    expect(find("In a DCF, next year's free cash flow").correctValue).toBeCloseTo(pv, 6);
  });

  it("IRR for doubling in 5 years", () => {
    const q = find("A private equity fund doubles its money");
    const irr = (Math.pow(2, 1 / 5) - 1) * 100;
    expect(irr).toBeCloseTo(14.87, 2);
    // the correct option is the listed percentage closest to the true IRR
    const listed = q.options!.map((o) => Number(o.match(/(\d+)%/)![1]));
    const closest = listed.indexOf(listed.reduce((a, b) => (Math.abs(b - irr) < Math.abs(a - irr) ? b : a)));
    expect(q.correctOption).toBe(closest);
    expect(Math.pow(1.1, 7)).toBeLessThan(2); // the reason given for the 10% option
    expect(Math.pow(1.1, 8)).toBeGreaterThan(2);
  });

  it("inventory purchase and deferred revenue, by double-entry bookkeeping", () => {
    // Inventory bought for cash: cash -10, inventory +10, no income statement effect.
    const inv = { cash: -10, inventory: +10, netIncome: 0 };
    expect(inv.cash + inv.inventory).toBe(inv.netIncome); // assets change only by net income
    const q1 = find("A company buys $10 of inventory");
    expect(q1.correctOption).toBe(optionMatching(q1.options!, /^Net income is unchanged and cash falls by \$10$/));

    // Prepaid subscription: cash +120 must be matched by a liability, because no revenue is earned yet.
    const sub = { cash: +120, deferredRevenue: +120, revenue: 0 };
    expect(sub.cash).toBe(sub.deferredRevenue + sub.revenue);
    const q2 = find("A customer pays $120 in cash today");
    expect(q2.correctOption).toBe(optionMatching(q2.options!, /deferred revenue/i));
  });

  it("extra depreciation with a 40% tax rate, walked through the three statements", () => {
    const pretax = -10;
    const tax = 0.4 * pretax;
    const netIncome = pretax - tax;
    const cashChange = netIncome + 10; // add back the non-cash charge
    expect(netIncome).toBeCloseTo(-6, 12);
    const assets = cashChange - 10; // cash up, PP&E down
    expect(assets).toBeCloseTo(netIncome, 12); // balance sheet balances through retained earnings
    expect(find("Depreciation expense increases by $10").correctValue).toBeCloseTo(cashChange, 12);
  });

  it("real rate: the approximation is the stored answer and the exact Fisher value is accepted", () => {
    const q = find("A one-year government bond yields 5%");
    expect(q.correctValue).toBe(5 - 3);
    const exact = (1.05 / 1.03 - 1) * 100;
    expect(Math.abs(exact - q.correctValue!) / q.correctValue!).toBeLessThan(q.tolerance!);
  });

  it("bond price moves opposite to yield (rate hike, QE, and inverted curve questions)", () => {
    const price = (y: number) => {
      let p = 0;
      for (let t = 1; t <= 10; t++) p += 3 / Math.pow(1 + y, t);
      return p + 100 / Math.pow(1 + y, 10);
    };
    expect(price(0.05)).toBeLessThan(price(0.03)); // higher yield, lower price
    const hike = find("A central bank unexpectedly raises");
    expect(hike.correctOption).toBe(optionMatching(hike.options!, /^Fall in price$/));
    const qe = find("A central bank starts quantitative easing");
    expect(qe.correctOption).toBe(optionMatching(qe.options!, /^Their prices rise and their yields fall$/));
    const inverted = find("What does it mean when the government bond yield curve is inverted");
    expect(inverted.correctOption).toBe(
      optionMatching(inverted.options!, /^Short-term yields are higher than long-term yields$/),
    );
  });

  it("bid-ask spread in basis points", () => {
    const bid = 49.99, ask = 50.01;
    const bps = ((ask - bid) / ((ask + bid) / 2)) * 10000;
    expect(find("A stock is quoted with a bid of $49.99").correctValue).toBeCloseTo(bps, 8);
  });

  it("Python list aliasing, reproduced with a shared array reference", () => {
    const a = [1, 2, 3];
    const b = a;
    b.push(4);
    const q = find("What does this Python code print?");
    expect(q.options![q.correctOption!]).toBe(String(a.length));
  });

  it("binary search worst case over every position of a 1,000,000 element array", () => {
    const n = 1_000_000;
    let worst = 0;
    for (let target = 0; target < n; target++) {
      let lo = 0, hi = n - 1, steps = 0;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        steps++;
        if (mid === target) break;
        if (mid < target) lo = mid + 1;
        else hi = mid - 1;
      }
      if (steps > worst) worst = steps;
    }
    expect(find("You run a standard binary search").correctValue).toBe(worst);
  });

  it("48 x 52 and the maximum of two dice", () => {
    expect(find("Mental math: what is 48 x 52").correctValue).toBe(48 * 52);
    let total = 0;
    for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) total += Math.max(a, b);
    expect(find("You roll two fair six-sided dice and are paid the larger").correctValue).toBeCloseTo(total / 36, 12);
  });

  it("Monty Hall, by enumerating every prize position, first pick, and host choice", () => {
    let stayWins = 0, switchWins = 0, weight = 0;
    for (let prize = 0; prize < 3; prize++) {
      for (let pick = 0; pick < 3; pick++) {
        const openable = [0, 1, 2].filter((d) => d !== pick && d !== prize);
        for (const opened of openable) {
          const p = 1 / 9 / openable.length;
          const other = [0, 1, 2].find((d) => d !== pick && d !== opened)!;
          weight += p;
          if (pick === prize) stayWins += p;
          if (other === prize) switchWins += p;
        }
      }
    }
    expect(weight).toBeCloseTo(1, 12);
    expect(stayWins).toBeCloseTo(1 / 3, 12);
    expect(switchWins).toBeCloseTo(2 / 3, 12);
    const q = find("A prize is behind one of three doors");
    expect(q.correctOption).toBe(optionMatching(q.options!, /^Switch.*2\/3$/));
  });

  it("net PnL after commissions", () => {
    const net = (50.35 - 50.0) * 1000 - 0.005 * 1000 * 2;
    expect(find("A trader buys 1,000 shares").correctValue).toBeCloseTo(net, 8);
  });

  it("depreciation without taxes leaves cash unchanged", () => {
    const netIncome = -100;
    const cash = netIncome + 100;
    expect(cash).toBe(0);
    const q = find("A company records $100 of depreciation expense");
    expect(q.correctOption).toBe(optionMatching(q.options!, /^Cash is unchanged$/));
  });

  it("definition questions: the stored correct option is the expected one", () => {
    // Standard definitions that cannot be computed. Each is restated here independently of the seed file.
    const expected: Array<[string, RegExp]> = [
      ["In central clearing", /buyer to every seller/],
      ["What is the average time complexity", /^O\(1\)$/],
      ["On the sell side of an investment bank", /^Sales and trading$/],
      ["You send a buy limit order", /only at \$50 or lower, and it may not execute/],
      ["What does the Volcker Rule", /proprietary trading/],
      ["In SQL, which clause filters groups", /^HAVING$/],
      ["In a bank, functions such as risk management", /^Middle office$/],
      ["What is the main difference between a proprietary trading firm", /trades its own capital/],
    ];
    for (const [prefix, pattern] of expected) {
      const q = find(prefix);
      expect(q.correctOption).toBe(optionMatching(q.options!, pattern));
    }
  });

  it("every numeric and multiple choice question was recomputed by a test in this file", () => {
    // Questions recomputed in the first describe block above (listed so this test also passes when run alone).
    for (const prefix of [
      "Two fair six-sided dice",
      "A disease affects",
      "Let f(x)",
      "A stock is at $100",
      "A portfolio returned",
      "A company has an enterprise value",
      "You roll a fair six-sided die",
      "For European options",
    ]) {
      find(prefix);
    }
    const unchecked = SEED_QUESTIONS.filter((q) => q.format !== "long" && !checked.has(q.prompt)).map((q) => q.prompt);
    expect(unchecked).toEqual([]);
  });
});

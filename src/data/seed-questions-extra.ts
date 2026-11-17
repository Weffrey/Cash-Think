import type { NewQuestion } from "../lib/types";
import { long, mcq, numeric } from "./seed-builders";

/**
 * Second batch of seed questions. Every numeric answer and every multiple choice
 * answer here is recomputed independently in seed-questions.test.ts.
 * Text inside backticks is shown as code.
 */
export const EXTRA_SEED_QUESTIONS: NewQuestion[] = [
  // ───────────────────────── 1 Probability and statistics
  numeric({
    categoryId: 1,
    difficulty: 2,
    prompt: "A fair coin is flipped 10 times. What is the probability of getting exactly 5 heads? Answer as a decimal.",
    correctValue: 252 / 1024,
    tolerance: 0.01,
    unit: null,
    referenceCard:
      "Binomial distribution: P(exactly k successes in n trials) = C(n, k) x p^k x (1 - p)^(n - k), where C(n, k) = n! / (k! (n - k)!).",
    hints: [
      "Every specific sequence of 10 flips has probability (1/2)^10.",
      "Count how many sequences have exactly 5 heads: that is C(10, 5).",
    ],
    shortAnswer: "252/1024, about 0.246.",
    steps:
      "1. Each sequence of 10 flips has probability (1/2)^10 = 1/1024.\n2. Sequences with exactly 5 heads: C(10, 5) = 252.\n3. Probability = 252 / 1024, about 0.246.",
    theory: "The number of heads in n independent fair flips follows a binomial distribution with p = 1/2.",
    intuition: "5 heads is the single most likely count, but it still happens less than a quarter of the time because nearby counts like 4 and 6 are almost as likely.",
  }),
  numeric({
    categoryId: 1,
    difficulty: 2,
    prompt:
      "You can bet repeatedly on a game that pays even money (win or lose the amount you stake) and you win with probability 60%. According to the Kelly criterion, what fraction of your bankroll should you stake each time? Answer as a decimal.",
    correctValue: 0.2,
    tolerance: 0.01,
    unit: null,
    referenceCard:
      "Kelly criterion: choose the fraction f that maximizes the expected log of wealth. For a bet that pays b to 1 with win probability p and loss probability q = 1 - p, f* = (b p - q) / b. For even money (b = 1), f* = p - q.",
    hints: ["Even money means b = 1.", "With b = 1 the formula reduces to p minus q."],
    shortAnswer: "0.2, which is 20% of the bankroll.",
    steps:
      "1. Even money, so b = 1. p = 0.6 and q = 0.4.\n2. f* = (b p - q) / b = (0.6 - 0.4) / 1 = 0.2.\n3. Check: expected log growth 0.6 ln(1 + f) + 0.4 ln(1 - f) has derivative 0.6 / (1 + f) - 0.4 / (1 - f), which is zero at f = 0.2.",
    theory: "The Kelly criterion maximizes the long-run growth rate of wealth, which is the expected logarithm of the per-bet return.",
    intuition: "Your edge is 20 cents per dollar staked at even odds, so you stake 20%. Betting more than Kelly raises risk and lowers long-run growth.",
  }),

  // ───────────────────────── 2 Math foundations
  mcq({
    categoryId: 2,
    difficulty: 1,
    prompt: "What are the eigenvalues of the matrix with rows (2, 1) and (1, 2)?",
    options: ["1 and 3", "2 and 2", "1 and 2", "0 and 4"],
    correctOption: 0,
    optionReasons: [
      "Correct. They add up to the trace (4) and multiply to the determinant (3).",
      "These are the diagonal entries. They are the eigenvalues only when the matrix is diagonal or triangular.",
      "These are just entries of the matrix. Their sum is 3, but the trace is 4.",
      "The sum matches the trace, but the product is 0 while the determinant is 3.",
    ],
    referenceCard:
      "Eigenvalues solve det(A - lambda I) = 0. For a 2 x 2 matrix: lambda^2 - (trace) lambda + (determinant) = 0. The eigenvalues add up to the trace and multiply to the determinant.",
    hints: ["Compute the trace and the determinant.", "Find two numbers with sum 4 and product 3."],
    shortAnswer: "1 and 3.",
    steps:
      "1. Trace = 2 + 2 = 4. Determinant = 2 x 2 - 1 x 1 = 3.\n2. Characteristic equation: lambda^2 - 4 lambda + 3 = 0.\n3. Factor: (lambda - 1)(lambda - 3) = 0, so lambda = 1 or 3.",
    theory: "An eigenvalue lambda satisfies A v = lambda v for some non-zero vector v. They are the roots of the characteristic polynomial.",
    intuition: "The matrix stretches the direction (1, 1) by 3 and the direction (1, -1) by 1. This is the shape of a 2-asset covariance matrix, where the big eigenvalue is the common factor.",
  }),
  numeric({
    categoryId: 2,
    difficulty: 1,
    prompt: "Compute the definite integral of 3x^2 from x = 0 to x = 2.",
    correctValue: 8,
    tolerance: 0.001,
    unit: null,
    referenceCard:
      "Power rule for integrals: the antiderivative of x^n is x^(n + 1) / (n + 1). A definite integral from a to b equals F(b) - F(a), where F is an antiderivative.",
    hints: ["Find an antiderivative of 3x^2.", "Evaluate it at 2 and at 0, then subtract."],
    shortAnswer: "8.",
    steps: "1. An antiderivative of 3x^2 is x^3.\n2. Evaluate: 2^3 - 0^3 = 8.",
    theory: "The fundamental theorem of calculus: integrating a function over an interval equals the change in its antiderivative.",
    intuition: "The integral is the area under the curve. The curve reaches 12 at x = 2, but it is low for most of the interval, so the area is well below 12 x 2.",
  }),
  numeric({
    categoryId: 2,
    difficulty: 3,
    prompt:
      "A stock follows geometric Brownian motion dS = 0.10 S dt + 0.20 S dW (drift 10% and volatility 20% per year). By Ito's lemma, ln S follows d(ln S) = m dt + 0.20 dW. What is m? Answer as a decimal.",
    correctValue: 0.08,
    tolerance: 0.01,
    unit: null,
    referenceCard:
      "Ito's lemma for f(S) when dS = mu S dt + sigma S dW: df = (f'(S) mu S + 0.5 f''(S) sigma^2 S^2) dt + f'(S) sigma S dW. The extra second-derivative term appears because (dW)^2 = dt.",
    hints: [
      "Take f(S) = ln S, so f'(S) = 1/S and f''(S) = -1/S^2.",
      "The second-derivative term contributes -0.5 sigma^2.",
    ],
    shortAnswer: "0.08, which is mu - sigma^2 / 2.",
    steps:
      "1. f(S) = ln S, f' = 1/S, f'' = -1/S^2.\n2. Drift of ln S = (1/S)(mu S) + 0.5 (-1/S^2)(sigma^2 S^2) = mu - sigma^2 / 2.\n3. = 0.10 - 0.5 x 0.04 = 0.08.",
    theory: "Ito's lemma is the chain rule for stochastic processes. It has an extra term from the quadratic variation of Brownian motion.",
    intuition: "Volatility drags down the growth of the log price. A stock that goes up 20% and then down 20% ends below where it started, so the typical (median) path grows slower than the average.",
  }),
  long({
    categoryId: 2,
    difficulty: 2,
    prompt:
      "You estimate an option price by Monte Carlo simulation with N independent paths. How does the standard error of the estimate depend on N, and how many paths do you need to cut the error in half? Name one way to reduce the error without adding paths.",
    rubric: [
      "States that the standard error is proportional to 1 / sqrt(N) (sample standard deviation divided by sqrt(N)).",
      "States that halving the error needs 4 times as many paths.",
      "Justifies it with the variance of an average of independent samples, or the central limit theorem.",
      "Names a variance reduction technique such as antithetic variates, control variates, or importance sampling.",
    ],
    referenceCard:
      "For N independent samples with standard deviation s, the sample mean has standard error s / sqrt(N). By the central limit theorem the estimate is approximately normal around the true value.",
    hints: [
      "What is the variance of the average of N independent samples?",
      "If the error goes like 1 / sqrt(N), what must happen to N for the error to halve?",
      "Think of tricks that make each sample less noisy, such as pairing each random draw with its negative.",
    ],
    shortAnswer: "Error scales as 1 / sqrt(N). Halving it takes 4 times the paths. Variance reduction (antithetic or control variates) lowers it without more paths.",
    steps:
      "1. The estimate is the average of N independent discounted payoffs.\n2. Var(average) = s^2 / N, so the standard error is s / sqrt(N).\n3. To halve s / sqrt(N), N must grow by a factor of 4.\n4. Alternatively shrink s: antithetic variates (use Z and -Z), control variates (subtract a correlated quantity whose mean is known), or importance sampling.",
    theory: "Monte Carlo convergence is governed by the central limit theorem, and the rate 1 / sqrt(N) does not depend on the dimension of the problem.",
    intuition: "Each extra digit of accuracy costs 100 times more paths, which is why variance reduction matters more than raw computing power.",
  }),

  // ───────────────────────── 3 Markets and instruments
  numeric({
    categoryId: 3,
    difficulty: 1,
    prompt:
      "A zero-coupon bond pays $1,000 in exactly 2 years. The yield is 5% per year, compounded annually. What is its price today, in dollars?",
    correctValue: 1000 / (1.05 * 1.05),
    tolerance: 0.005,
    unit: "$",
    referenceCard:
      "Present value with annual compounding: PV = cash flow / (1 + y)^t, where y is the yield per year and t is the number of years.",
    hints: ["There is only one cash flow to discount.", "Divide 1,000 by 1.05 twice."],
    shortAnswer: "About $907.03.",
    steps: "1. Price = 1000 / (1.05)^2.\n2. (1.05)^2 = 1.1025.\n3. 1000 / 1.1025 is about 907.03.",
    theory: "A bond's price is the present value of its cash flows. A zero-coupon bond has a single cash flow at maturity.",
    intuition: "Invest about $907 at 5% for two years and it grows to $1,000, so that is what the promise is worth today.",
  }),
  mcq({
    categoryId: 3,
    difficulty: 2,
    prompt:
      "A stock trades at $100. Roughly what is the delta of a one-month European call option with strike $100 (at the money)?",
    options: ["About 0", "About 0.5", "About 1", "About -0.5"],
    correctOption: 1,
    optionReasons: [
      "A delta near 0 belongs to a call that is far out of the money.",
      "Correct. An at-the-money call has roughly even odds of finishing in the money, and its delta is close to 0.5.",
      "A delta near 1 belongs to a call that is deep in the money and moves like the stock.",
      "A negative delta belongs to a put. An at-the-money put has a delta of about -0.5.",
    ],
    referenceCard:
      "Delta is the change in the option price for a $1 change in the stock price. Call deltas run from 0 (far out of the money) to 1 (deep in the money). In Black-Scholes, call delta = N(d1) and put delta = N(d1) - 1.",
    hints: [
      "Think about how the option's value changes when the stock moves by $1.",
      "At the money, the stock is about equally likely to finish above or below the strike.",
    ],
    shortAnswer: "About 0.5.",
    steps:
      "1. Call delta = N(d1).\n2. At the money with a short time to expiry, d1 is close to 0 (slightly positive).\n3. N(0) = 0.5, so delta is about 0.5 (slightly above).",
    theory: "Delta measures an option's sensitivity to the underlying price and is also the hedge ratio: the number of shares needed to hedge one option.",
    intuition: "An at-the-money call behaves like owning about half a share: it gains about 50 cents when the stock rises by $1.",
  }),
  numeric({
    categoryId: 3,
    difficulty: 2,
    prompt:
      "A stock that pays no dividends trades at $100. The risk-free rate is 4% per year, continuously compounded. What is the fair price of a forward contract for delivery in 6 months? Answer in dollars, to the nearest cent.",
    correctValue: 100 * Math.exp(0.04 * 0.5),
    tolerance: 0.0001,
    unit: "$",
    referenceCard:
      "Forward price with no dividends (cost of carry): F = S x e^(rT) with continuous compounding, where T is in years. Useful values: e^0.02 is about 1.0202.",
    hints: [
      "The seller can buy the stock today with borrowed money and deliver it later.",
      "What does a $100 loan grow to after half a year at 4%, continuously compounded?",
    ],
    shortAnswer: "About $102.02.",
    steps:
      "1. F = S x e^(rT) = 100 x e^(0.04 x 0.5) = 100 x e^0.02.\n2. e^0.02 is about 1.0202.\n3. F is about 102.02.",
    theory: "The forward price is set by no-arbitrage: buying the stock with borrowed money and delivering it must cost the same as the forward.",
    intuition: "The forward price is today's price plus the interest cost of holding the stock until delivery. It is not a forecast of where the stock will be.",
  }),

  // ───────────────────────── 4 Pricing and derivatives theory
  mcq({
    categoryId: 4,
    difficulty: 1,
    prompt: "Under the risk-neutral measure used for pricing derivatives, the expected return of a stock that pays no dividends is:",
    options: [
      "The stock's real-world expected return",
      "The risk-free rate",
      "Zero",
      "The risk-free rate plus a risk premium",
    ],
    correctOption: 1,
    optionReasons: [
      "The real-world expected return does not enter risk-neutral pricing at all.",
      "Correct. Under the risk-neutral measure every traded asset is expected to earn the risk-free rate.",
      "The discounted stock price has zero drift, but the stock itself grows at the risk-free rate.",
      "A risk premium is a real-world idea. The risk-neutral measure removes it.",
    ],
    referenceCard:
      "Risk-neutral pricing: price = discounted expected payoff under the measure Q, where every traded asset has expected return equal to the risk-free rate. Discounted asset prices are martingales under Q.",
    hints: ["Under this measure, investors are treated as if they did not demand compensation for risk."],
    shortAnswer: "The risk-free rate.",
    steps:
      "1. Risk-neutral pricing replaces real-world probabilities with ones under which no asset earns a risk premium.\n2. So every traded asset, including the stock, has expected return r.\n3. Example: stock at 100 going to 120 or 80 with r = 5% has risk-neutral up probability 0.625, and 0.625 x 120 + 0.375 x 80 = 105.",
    theory: "The risk-neutral measure is the set of probabilities under which discounted prices of traded assets are martingales. It exists when there is no arbitrage.",
    intuition: "Because an option can be hedged with the stock, its price cannot depend on how fast the stock is expected to grow, so we may pretend everything grows at the risk-free rate.",
  }),
  numeric({
    categoryId: 4,
    difficulty: 2,
    prompt:
      "A stock that pays no dividends trades at $100. A 1-year European call with strike $100 costs $8. The risk-free rate is 5% per year with annual compounding. What is the no-arbitrage price of the 1-year European put with the same strike, in dollars?",
    correctValue: 8 - 100 + 100 / 1.05,
    tolerance: 0.01,
    unit: "$",
    referenceCard:
      "Put-call parity: C + PV(K) = P + S, where PV(K) is the strike discounted at the risk-free rate. With annual compounding over one year, PV(K) = K / (1 + r).",
    hints: ["Rearrange put-call parity to isolate the put.", "Discount the strike: 100 / 1.05."],
    shortAnswer: "About $3.24.",
    steps: "1. PV(K) = 100 / 1.05, about 95.24.\n2. P = C + PV(K) - S = 8 + 95.24 - 100.\n3. P is about 3.24.",
    theory: "Put-call parity links European call and put prices with the same strike and expiry through a no-arbitrage argument.",
    intuition: "The put is cheaper than the call because the strike is paid later: the call holder benefits from interest on the strike, the put holder does not.",
  }),
  numeric({
    categoryId: 4,
    difficulty: 3,
    prompt:
      "Use Black-Scholes to price a 1-year European call on a stock that pays no dividends: S = 100, K = 100, r = 5% (continuously compounded), volatility 20%. You may use N(0.35) = 0.6368, N(0.15) = 0.5596, and e^(-0.05) = 0.9512. Answer in dollars.",
    correctValue: 10.4506,
    tolerance: 0.01,
    unit: "$",
    referenceCard:
      "Black-Scholes call: C = S N(d1) - K e^(-rT) N(d2), with d1 = (ln(S/K) + (r + sigma^2 / 2) T) / (sigma sqrt(T)) and d2 = d1 - sigma sqrt(T). N is the standard normal cumulative distribution.",
    hints: [
      "ln(S/K) is ln(1) = 0 here, which simplifies d1.",
      "d1 = (0.05 + 0.02) / 0.20 and d2 = d1 - 0.20.",
      "Then C = 100 x N(d1) - 100 x e^(-0.05) x N(d2).",
    ],
    shortAnswer: "About $10.45.",
    steps:
      "1. d1 = (0 + (0.05 + 0.02) x 1) / 0.20 = 0.35.\n2. d2 = 0.35 - 0.20 = 0.15.\n3. C = 100 x 0.6368 - 100 x 0.9512 x 0.5596.\n4. = 63.68 - 53.23 = 10.45.",
    theory: "Black-Scholes prices a European option as the discounted risk-neutral expected payoff when the stock follows geometric Brownian motion.",
    intuition: "S N(d1) is what you expect to receive in stock and K e^(-rT) N(d2) is what you expect to pay for it, both in today's money. A common rule of thumb for an at-the-money option is about 0.4 x S x sigma x sqrt(T) = 8, plus an extra amount from interest.",
  }),
  long({
    categoryId: 4,
    difficulty: 3,
    prompt:
      "In a one-period binomial model, the price of an option does not depend on the real-world probability that the stock goes up. Explain why.",
    rubric: [
      "Explains that the option payoff can be replicated exactly with a position in the stock plus borrowing or lending.",
      "States that by no-arbitrage the option must cost the same as the replicating portfolio, and that cost uses only today's stock price, the two future prices, and the risk-free rate.",
      "Notes that the real-world probability is already reflected in today's stock price.",
      "Explains that the risk-neutral probability q is a calculation device derived from prices, not a forecast.",
    ],
    referenceCard:
      "Replication in one period: choose delta shares and B in bonds so that delta x S_up + B (1 + r) = payoff_up and delta x S_down + B (1 + r) = payoff_down. Then option price = delta x S0 + B.",
    hints: [
      "Can you build a portfolio of stock and cash that pays exactly what the option pays in both states?",
      "What must be true about the price of two things that have identical payoffs?",
      "Where would the market's view about the up probability show up, if not in the option formula?",
    ],
    shortAnswer: "The option can be replicated with stock and borrowing, so its price is the cost of that portfolio, which involves no probabilities.",
    steps:
      "1. Two unknowns (shares and bonds) and two states give a portfolio that matches the option payoff in both states.\n2. Identical payoffs must have identical prices, or there is an arbitrage.\n3. The portfolio's cost depends on S0, S_up, S_down, and r only.\n4. Beliefs about the up probability affect S0 itself, and through S0 the option.\n5. Rewriting the cost as a discounted expectation gives q = ((1 + r) S0 - S_down) / (S_up - S_down), which is not a real probability.",
    theory: "Derivatives are priced by replication and no-arbitrage. The risk-neutral measure is a convenient way to write the replication cost.",
    intuition: "A hedged position has the same value whichever way the stock goes, so the odds of each direction cannot matter to its price.",
  }),

  // ───────────────────────── 5 Risk and portfolio management
  numeric({
    categoryId: 5,
    difficulty: 2,
    prompt:
      "A portfolio holds 50% in asset A (volatility 20%) and 50% in asset B (volatility 10%). The two assets are uncorrelated. What is the portfolio's volatility, in percent?",
    correctValue: Math.sqrt(0.25 * 0.04 + 0.25 * 0.01) * 100,
    tolerance: 0.005,
    unit: "%",
    referenceCard:
      "Two-asset portfolio variance: w1^2 s1^2 + w2^2 s2^2 + 2 w1 w2 rho s1 s2. Volatility is the square root of the variance. With rho = 0 the last term disappears.",
    hints: ["Work with variances, not volatilities.", "Variance = 0.25 x 0.04 + 0.25 x 0.01. Then take the square root."],
    shortAnswer: "About 11.18%.",
    steps:
      "1. Variance = 0.5^2 x 0.20^2 + 0.5^2 x 0.10^2 = 0.01 + 0.0025 = 0.0125.\n2. Volatility = sqrt(0.0125), about 0.1118.\n3. That is 11.18%.",
    theory: "Portfolio variance depends on weights, individual variances, and correlations. Variances add, volatilities do not.",
    intuition: "The weighted average volatility would be 15%. Because the assets do not move together, some of their swings cancel and the portfolio is less risky than that average.",
  }),
  mcq({
    categoryId: 5,
    difficulty: 2,
    prompt:
      "The risk-free rate is 3%, the expected return of the market is 9%, and a stock has a beta of 1.5. According to the CAPM, what is the stock's expected return?",
    options: ["9%", "12%", "13.5%", "16.5%"],
    correctOption: 1,
    optionReasons: [
      "This is the market's expected return. It ignores the stock's beta.",
      "Correct. 3% + 1.5 x (9% - 3%) = 12%.",
      "This is 1.5 x 9%. Beta multiplies the market risk premium, not the whole market return.",
      "This is 3% + 1.5 x 9%. The risk-free rate must be subtracted from the market return first.",
    ],
    referenceCard:
      "CAPM: expected return = risk-free rate + beta x (expected market return - risk-free rate). The bracket is the market risk premium.",
    hints: ["Find the market risk premium first.", "Multiply the premium by beta, then add the risk-free rate."],
    shortAnswer: "12%.",
    steps: "1. Market risk premium = 9% - 3% = 6%.\n2. Beta x premium = 1.5 x 6% = 9%.\n3. Expected return = 3% + 9% = 12%.",
    theory: "The CAPM says a stock's expected excess return is proportional to its beta, its sensitivity to the market.",
    intuition: "The stock carries one and a half times the market's risk, so it should earn one and a half times the market's premium over the risk-free rate.",
  }),
  numeric({
    categoryId: 5,
    difficulty: 2,
    prompt:
      "A portfolio is worth $1,000,000 and has a daily volatility of 2%. Assume daily returns are normally distributed with zero mean, and use z = 2.33 for the 99% level. What is the 1-day 99% Value at Risk, in dollars?",
    correctValue: 46600,
    tolerance: 0.01,
    unit: "$",
    referenceCard:
      "Parametric (normal) VaR with zero mean: VaR = z x sigma x portfolio value, where z is the normal quantile for the confidence level (1.645 for 95%, 2.33 for 99%).",
    hints: ["First find the daily volatility in dollars.", "Multiply the dollar volatility by z."],
    shortAnswer: "$46,600.",
    steps: "1. Daily volatility in dollars = 2% x 1,000,000 = 20,000.\n2. VaR = 2.33 x 20,000 = 46,600.",
    theory: "Value at Risk is the loss that is exceeded only with a given small probability over a given horizon.",
    intuition: "On 99 days out of 100 the loss should be smaller than $46,600. VaR says nothing about how bad the remaining day can be.",
  }),

  // ───────────────────────── 6 Corporate finance and valuation
  numeric({
    categoryId: 6,
    difficulty: 2,
    prompt:
      "A company is financed with 60% equity and 40% debt. Its cost of equity is 10%, its pre-tax cost of debt is 5%, and its tax rate is 25%. What is its WACC, in percent?",
    correctValue: 7.5,
    tolerance: 0.005,
    unit: "%",
    referenceCard:
      "WACC = (E / V) x cost of equity + (D / V) x cost of debt x (1 - tax rate), where V = E + D. Interest is tax deductible, so debt is taken after tax.",
    hints: ["Convert the cost of debt to an after-tax cost first.", "Then weight each cost by its share of the capital structure."],
    shortAnswer: "7.5%.",
    steps:
      "1. After-tax cost of debt = 5% x (1 - 0.25) = 3.75%.\n2. Equity part = 0.6 x 10% = 6%.\n3. Debt part = 0.4 x 3.75% = 1.5%.\n4. WACC = 6% + 1.5% = 7.5%.",
    theory: "WACC is the blended return required by all providers of capital, and the discount rate for unlevered free cash flows in a DCF.",
    intuition: "Debt is cheaper than equity and cheaper still after the tax shield, so adding it pulls the average cost below the cost of equity.",
  }),
  numeric({
    categoryId: 6,
    difficulty: 2,
    prompt:
      "In a DCF, next year's free cash flow is $100 million and it is expected to grow at 2% per year forever. The discount rate is 10%. Using the Gordon growth formula, what is the value today of that stream, in $ millions?",
    correctValue: 1250,
    tolerance: 0.005,
    unit: "$ million",
    referenceCard:
      "Growing perpetuity (Gordon growth): value = next year's cash flow / (r - g), valid when r is greater than g. The result is the value one year before the first cash flow.",
    hints: ["The first cash flow is one year from now, so no extra growth step is needed.", "Divide by the difference between the discount rate and the growth rate."],
    shortAnswer: "$1,250 million.",
    steps: "1. Value = FCF next year / (r - g).\n2. = 100 / (0.10 - 0.02) = 100 / 0.08.\n3. = 1,250.",
    theory: "A cash flow growing at a constant rate forever is a geometric series whose present value has a closed form.",
    intuition: "The value is very sensitive to r - g: with a gap of 8% the stream is worth 12.5 times next year's cash flow, and a gap of 7% would make it about 14.3 times.",
  }),
  mcq({
    categoryId: 6,
    difficulty: 2,
    prompt:
      "A private equity fund doubles its money on an investment in exactly 5 years, with no cash flows in between (a 2.0x multiple). What is the IRR, approximately?",
    options: ["About 10%", "About 15%", "About 20%", "About 100%"],
    correctOption: 1,
    optionReasons: [
      "At 10% a year, money takes a little over 7 years to double.",
      "Correct. 2^(1/5) - 1 is about 14.9%.",
      "This divides the 100% gain by 5 years and ignores compounding.",
      "This is the total return over the 5 years, not the annual rate.",
    ],
    referenceCard:
      "With one cash flow in and one out, IRR = (multiple)^(1 / years) - 1. Rule of 72: years to double is about 72 / (rate in percent).",
    hints: ["Solve (1 + IRR)^5 = 2.", "The rule of 72 gives a quick estimate: 72 / 5."],
    shortAnswer: "About 15%.",
    steps: "1. (1 + IRR)^5 = 2.\n2. 1 + IRR = 2^(1/5), about 1.149.\n3. IRR is about 14.9%, so about 15%.",
    theory: "IRR is the annual discount rate that makes the net present value of an investment's cash flows equal to zero.",
    intuition: "Rule of 72: doubling in 5 years needs about 72 / 5 = 14.4% a year. The same multiple over a shorter time means a much higher IRR.",
  }),
  long({
    categoryId: 6,
    difficulty: 2,
    prompt: "Walk me through a discounted cash flow (DCF) valuation, from projections to equity value per share.",
    rubric: [
      "Projects unlevered free cash flows for a forecast period (typically 5 to 10 years).",
      "Discounts them at the WACC.",
      "Adds a terminal value (Gordon growth or exit multiple), discounted back to today.",
      "Sums these to get enterprise value.",
      "Subtracts net debt (debt minus cash) to get equity value, then divides by diluted shares.",
    ],
    referenceCard:
      "Unlevered free cash flow = EBIT x (1 - tax rate) + depreciation and amortization - capital expenditure - increase in net working capital. Enterprise value = equity value + debt - cash.",
    hints: [
      "Start with which cash flows you project and for how long.",
      "What rate do you discount them at, and why that rate?",
      "What accounts for the value after the forecast period?",
      "How do you get from the value of the whole business to the value of the shares?",
    ],
    shortAnswer: "Project unlevered free cash flows, discount at WACC, add a discounted terminal value to get enterprise value, subtract net debt to get equity value, divide by diluted shares.",
    steps:
      "1. Project unlevered free cash flow for 5 to 10 years: EBIT x (1 - tax) + D&A - capex - increase in working capital.\n2. Discount each year's cash flow at the WACC.\n3. Compute a terminal value at the end of the forecast (Gordon growth or an exit multiple) and discount it to today.\n4. Enterprise value = sum of discounted cash flows + discounted terminal value.\n5. Equity value = enterprise value - debt + cash.\n6. Value per share = equity value / diluted shares outstanding.",
    theory: "A business is worth the present value of the cash it will generate for its capital providers.",
    intuition: "It is the same idea as pricing a bond, except that the cash flows are forecasts instead of promises, which is why the terminal value and the discount rate drive most of the answer.",
  }),

  // ───────────────────────── 7 Accounting
  mcq({
    categoryId: 7,
    difficulty: 2,
    prompt: "A company buys $10 of inventory and pays for it in cash. Nothing is sold yet. What is the immediate effect?",
    options: [
      "Net income falls by $10 and cash falls by $10",
      "Net income is unchanged and cash falls by $10",
      "Net income is unchanged and cash is unchanged",
      "Net income rises by $10 and cash is unchanged",
    ],
    correctOption: 1,
    optionReasons: [
      "Inventory is not expensed when it is bought. It becomes cost of goods sold only when it is sold.",
      "Correct. One asset (cash) is swapped for another (inventory). The increase in inventory lowers cash flow from operations by $10.",
      "Cash was paid, so cash falls.",
      "Buying inventory does not create revenue or income.",
    ],
    referenceCard:
      "Inventory is an asset on the balance sheet. Its cost reaches the income statement as cost of goods sold only when the goods are sold. On the cash flow statement, an increase in inventory (working capital) reduces cash flow from operations.",
    hints: ["Does buying inventory appear on the income statement?", "Which two balance sheet lines change?"],
    shortAnswer: "Net income is unchanged and cash falls by $10.",
    steps:
      "1. Income statement: no change, because nothing has been sold.\n2. Cash flow statement: inventory rises by $10, which reduces cash flow from operations by $10.\n3. Balance sheet: cash down $10, inventory up $10, so total assets are unchanged and the balance sheet balances.",
    theory: "The matching principle: costs are recognized as expenses in the same period as the revenue they help produce.",
    intuition: "You turned cash into goods on the shelf. You are not poorer on paper, but you have less cash.",
  }),
  numeric({
    categoryId: 7,
    difficulty: 2,
    prompt:
      "Depreciation expense increases by $10. The tax rate is 40%. By how many dollars does the cash balance change as a result? Use a negative number for a decrease.",
    correctValue: 4,
    tolerance: 0.01,
    unit: "$",
    referenceCard:
      "Walking a change through the three statements: pre-tax income changes, taxes change by (tax rate x that amount), net income is the rest. On the cash flow statement start from net income and add back non-cash expenses such as depreciation.",
    hints: [
      "How much does net income fall after the tax saving?",
      "Depreciation is non-cash, so add the full $10 back on the cash flow statement.",
    ],
    shortAnswer: "Cash rises by $4.",
    steps:
      "1. Pre-tax income falls by $10.\n2. Taxes fall by 40% x $10 = $4, so net income falls by $6.\n3. Cash flow from operations: -$6 net income + $10 depreciation added back = +$4.\n4. Balance sheet check: cash +$4 and PP&E -$10 make assets -$6, and retained earnings are -$6.",
    theory: "Depreciation is a non-cash expense that still reduces taxable income, which creates a tax shield.",
    intuition: "No cash is spent on depreciation, but it lowers the tax bill by $4, and that saving is real cash.",
  }),
  mcq({
    categoryId: 7,
    difficulty: 2,
    prompt:
      "A customer pays $120 in cash today for a 12-month software subscription that starts today. Immediately after the payment, before any service has been delivered, the company records:",
    options: [
      "Cash up $120 and revenue up $120",
      "Cash up $120 and deferred revenue (a liability) up $120",
      "Accounts receivable up $120 and revenue up $120",
      "Cash up $120 and retained earnings up $120",
    ],
    correctOption: 1,
    optionReasons: [
      "Revenue is recognized as the service is delivered, not when the cash arrives.",
      "Correct. The company owes the customer 12 months of service, so the cash is matched by a liability. Revenue is then recognized at $10 a month.",
      "Accounts receivable arises when the service is delivered before the customer pays. Here the cash came first.",
      "Retained earnings change only through net income, and no revenue has been earned yet.",
    ],
    referenceCard:
      "Accrual accounting recognizes revenue when it is earned, not when cash is received. Cash received before delivery is deferred (unearned) revenue, a liability. Cash owed after delivery is accounts receivable, an asset.",
    hints: ["Has the company earned the money yet?", "If the company closed tomorrow, what would it owe the customer?"],
    shortAnswer: "Cash up $120 and deferred revenue up $120.",
    steps:
      "1. Cash rises by $120 (asset).\n2. Nothing has been delivered, so no revenue is recognized yet.\n3. The obligation to deliver service is a liability: deferred revenue of $120.\n4. Each month $10 moves from deferred revenue to revenue.",
    theory: "Revenue recognition: revenue is recorded when the performance obligation is satisfied, regardless of the timing of cash.",
    intuition: "Being paid in advance is like borrowing from your customer and repaying in service.",
  }),

  // ───────────────────────── 8 Macro and central banks
  mcq({
    categoryId: 8,
    difficulty: 2,
    prompt: "What does it mean when the government bond yield curve is inverted?",
    options: [
      "Long-term yields are higher than short-term yields",
      "Short-term yields are higher than long-term yields",
      "All maturities have the same yield",
      "Bond yields are negative",
    ],
    correctOption: 1,
    optionReasons: [
      "That is the normal, upward-sloping shape of the curve.",
      "Correct. For example, the 2-year yield is above the 10-year yield. Historically this has often come before recessions.",
      "That is a flat yield curve.",
      "Negative yields are a separate situation. A curve can be inverted with all yields positive.",
    ],
    referenceCard:
      "The yield curve plots government bond yields against maturity. It is usually upward sloping. Long-term yields reflect expected future short-term rates plus a term premium.",
    hints: ["The normal curve slopes upward. What is the opposite?"],
    shortAnswer: "Short-term yields are higher than long-term yields.",
    steps:
      "1. Normally investors demand a higher yield to lend for longer.\n2. When markets expect the central bank to cut rates in the future, long-term yields fall below short-term yields.\n3. That downward-sloping curve is called inverted.",
    theory: "Under the expectations view, long-term yields reflect the expected path of short-term rates, so an inverted curve signals expected rate cuts.",
    intuition: "The market is saying that today's high short-term rates will not last, usually because it expects the economy to slow.",
  }),
  numeric({
    categoryId: 8,
    difficulty: 1,
    prompt:
      "A one-year government bond yields 5% and inflation over the year is expected to be 3%. Using the simple Fisher approximation, what is the expected real interest rate, in percent?",
    correctValue: 2,
    tolerance: 0.04,
    unit: "%",
    referenceCard:
      "Fisher relation: (1 + nominal) = (1 + real) x (1 + inflation). For small rates this is approximately real = nominal - inflation.",
    hints: ["The approximation is a simple subtraction."],
    shortAnswer: "About 2%.",
    steps: "1. Real rate is approximately nominal rate - expected inflation.\n2. = 5% - 3% = 2%.\n3. The exact Fisher relation gives 1.05 / 1.03 - 1, about 1.94%.",
    theory: "The real interest rate measures the growth in purchasing power, after removing inflation from the nominal rate.",
    intuition: "Your money grows 5% but prices grow 3%, so you can buy about 2% more goods at the end of the year.",
  }),
  mcq({
    categoryId: 8,
    difficulty: 2,
    prompt:
      "A central bank starts quantitative easing: it buys large amounts of long-term government bonds. What is the most direct effect on those bonds?",
    options: [
      "Their prices fall and their yields rise",
      "Their prices rise and their yields fall",
      "Their prices rise and their yields rise",
      "No effect, because the coupons are fixed",
    ],
    correctOption: 1,
    optionReasons: [
      "That is the effect of large-scale selling, as in quantitative tightening.",
      "Correct. The extra demand pushes prices up, and a higher price for the same cash flows means a lower yield.",
      "Price and yield of a fixed-rate bond always move in opposite directions.",
      "The coupons are fixed, but the market price is not.",
    ],
    referenceCard:
      "Quantitative easing: the central bank buys bonds with newly created reserves to lower long-term interest rates. Bond prices and yields move in opposite directions.",
    hints: ["What does a large new buyer do to the price of anything?", "How does a bond's yield change when its price rises?"],
    shortAnswer: "Prices rise and yields fall.",
    steps:
      "1. The central bank is a large new buyer, so demand for the bonds rises.\n2. Higher demand raises their prices.\n3. The cash flows are fixed, so a higher price means a lower yield.\n4. Lower long-term yields are the goal of the policy.",
    theory: "Quantitative easing works by lowering long-term yields when the short-term policy rate is already near its lower bound.",
    intuition: "The central bank bids up bond prices on purpose to make long-term borrowing cheaper for everyone else.",
  }),

  // ───────────────────────── 9 Market structure and regulation
  mcq({
    categoryId: 9,
    difficulty: 1,
    prompt: "You send a buy limit order with a limit price of $50. Which statement is true?",
    options: [
      "It executes immediately at the best available price, whatever that is",
      "It executes only at $50 or lower, and it may not execute at all",
      "It executes only at exactly $50, never lower",
      "It turns into a market order once the stock trades at $50",
    ],
    correctOption: 1,
    optionReasons: [
      "That describes a market order.",
      "Correct. A limit order controls the price but does not guarantee a fill.",
      "A buy limit order can fill below its limit if sellers are available at a lower price.",
      "That describes a stop order, not a limit order.",
    ],
    referenceCard:
      "Market order: executes now at the best available price. Certain to fill, price not guaranteed. Limit order: executes only at the limit price or better. Price guaranteed, fill not guaranteed.",
    hints: ["What does a limit order guarantee, and what does it leave uncertain?"],
    shortAnswer: "It executes only at $50 or lower, and it may not execute at all.",
    steps:
      "1. A buy limit order sets the highest price you are willing to pay.\n2. If sellers are available at $50 or less, it fills at their price.\n3. If not, it rests in the order book and may never fill.",
    theory: "Limit orders supply liquidity to the order book and market orders take it. The trade-off is price certainty against execution certainty.",
    intuition: "A limit order says: I will buy, but only at my price. The market may never come to you.",
  }),
  numeric({
    categoryId: 9,
    difficulty: 1,
    prompt:
      "A stock is quoted with a bid of $49.99 and an ask of $50.01. What is the bid-ask spread in basis points of the mid price?",
    correctValue: 4,
    tolerance: 0.01,
    unit: "bps",
    referenceCard:
      "Mid price = (bid + ask) / 2. Quoted spread = ask - bid. One basis point is 0.01%, which is 0.0001. Spread in basis points = (spread / mid) x 10,000.",
    hints: ["Find the spread in dollars and the mid price.", "Divide the spread by the mid, then multiply by 10,000."],
    shortAnswer: "4 basis points.",
    steps: "1. Spread = 50.01 - 49.99 = 0.02.\n2. Mid = 50.00.\n3. 0.02 / 50.00 = 0.0004, which is 4 basis points.",
    theory: "The bid-ask spread is the cost of trading immediately and the compensation earned by liquidity providers.",
    intuition: "Buying at the ask and selling straight back at the bid costs you the spread: 2 cents on a $50 stock.",
  }),
  mcq({
    categoryId: 9,
    difficulty: 2,
    prompt: "What does the Volcker Rule, part of the US Dodd-Frank Act, mainly do?",
    options: [
      "Requires standardized swaps to be centrally cleared",
      "Restricts banks from proprietary trading and from owning hedge funds and private equity funds",
      "Sets minimum capital ratios for banks",
      "Requires brokers to route orders to the venue showing the best price",
    ],
    correctOption: 1,
    optionReasons: [
      "Central clearing of standardized swaps is a different part of Dodd-Frank (Title VII).",
      "Correct. It limits banks' trading for their own account, with exemptions such as market making and hedging.",
      "Capital ratios come from the Basel III framework.",
      "That is the order protection rule of Regulation NMS.",
    ],
    referenceCard:
      "Dodd-Frank (2010) is the main US financial reform law after the 2008 crisis. Its parts include the Volcker Rule (limits on banks' own-account trading and fund ownership) and Title VII (clearing and reporting of swaps). Basel III sets bank capital and liquidity standards. Regulation NMS governs US equity market structure.",
    hints: ["It is named after a former Federal Reserve chair who wanted banks with insured deposits to take fewer speculative risks."],
    shortAnswer: "It restricts banks from proprietary trading and from owning hedge funds and private equity funds.",
    steps:
      "1. The rule targets banking entities that benefit from deposit insurance and central bank support.\n2. It prohibits short-term proprietary trading for the bank's own account.\n3. It limits ownership of and investment in hedge funds and private equity funds.\n4. Market making, underwriting, and hedging remain allowed.",
    theory: "The rule aims to separate speculative trading from banking activities that are backed by public safety nets.",
    intuition: "Banks may trade to serve clients, but they may not run a hedge fund inside a bank with insured deposits.",
  }),

  // ───────────────────────── 10 Programming and data
  mcq({
    categoryId: 10,
    difficulty: 2,
    prompt: "What does this Python code print?\n`a = [1, 2, 3]`\n`b = a`\n`b.append(4)`\n`print(len(a))`",
    options: ["3", "4", "7", "It raises an error"],
    correctOption: 1,
    optionReasons: [
      "This would be right if `b = a` made a copy, but it does not.",
      "Correct. `a` and `b` are two names for the same list, so the append is visible through both.",
      "`len` counts the elements. It does not add them up.",
      "The code is valid Python and runs without an error.",
    ],
    referenceCard:
      "In Python, assignment binds a name to an object. It never copies. Lists are mutable, so a change made through one name is seen through every name bound to the same list. To copy a list use `a.copy()`, `list(a)`, or `a[:]`.",
    hints: ["Does `b = a` create a new list?", "How many list objects exist in this program?"],
    shortAnswer: "4.",
    steps:
      "1. `a = [1, 2, 3]` creates one list.\n2. `b = a` makes `b` refer to that same list.\n3. `b.append(4)` changes the one list to [1, 2, 3, 4].\n4. `len(a)` is 4.",
    theory: "Python variables are references to objects. Mutating a shared mutable object affects every reference to it.",
    intuition: "`a` and `b` are two labels on one box. Putting something in the box through one label changes what the other label shows.",
  }),
  mcq({
    categoryId: 10,
    difficulty: 2,
    prompt: "In SQL, which clause filters groups after aggregation, for example keeping only tickers whose total traded volume exceeds 1,000,000?",
    options: ["WHERE", "HAVING", "GROUP BY", "ORDER BY"],
    correctOption: 1,
    optionReasons: [
      "WHERE filters individual rows before grouping, so it cannot use an aggregate such as SUM(volume).",
      "Correct. HAVING filters groups after GROUP BY and can use aggregates.",
      "GROUP BY forms the groups. It does not filter them.",
      "ORDER BY sorts the result. It does not filter.",
    ],
    referenceCard:
      "Logical order of a SQL query: FROM, WHERE (filter rows), GROUP BY (form groups), HAVING (filter groups), SELECT, ORDER BY. Aggregates such as SUM and COUNT are available from HAVING onward.",
    hints: ["Which clause is evaluated after the groups are formed?"],
    shortAnswer: "HAVING.",
    steps:
      "1. WHERE runs before grouping and sees single rows.\n2. GROUP BY ticker forms one group per ticker.\n3. HAVING SUM(volume) > 1000000 keeps only the groups that pass.\n4. Example: `SELECT ticker, SUM(volume) FROM trades GROUP BY ticker HAVING SUM(volume) > 1000000`.",
    theory: "SQL separates row-level filtering (WHERE) from group-level filtering (HAVING) because they happen at different stages of the query.",
    intuition: "WHERE decides which rows go into the buckets. HAVING decides which buckets you keep.",
  }),
  numeric({
    categoryId: 10,
    difficulty: 2,
    prompt:
      "You run a standard binary search for a value that is present in a sorted array of 1,000,000 distinct numbers. In the worst case, how many array elements does it examine (one per halving step)?",
    correctValue: 20,
    tolerance: 0.001,
    unit: "elements",
    referenceCard:
      "Binary search halves the search range at each step, so it needs at most floor(log2(n)) + 1 steps for n elements. Useful: 2^10 = 1,024 and 2^20 = 1,048,576.",
    hints: ["Each step halves the number of remaining candidates.", "Find the smallest power of 2 that is larger than 1,000,000."],
    shortAnswer: "20.",
    steps:
      "1. Each comparison halves the remaining range.\n2. The worst case is floor(log2(n)) + 1 comparisons.\n3. 2^19 = 524,288 and 2^20 = 1,048,576, so log2(1,000,000) is between 19 and 20.\n4. floor(19.93) + 1 = 20.",
    theory: "Binary search runs in O(log n) time because the problem size halves at every step.",
    intuition: "Twenty halvings are enough to go from a million candidates down to one, because 2^20 is just over a million.",
  }),
  long({
    categoryId: 10,
    difficulty: 2,
    prompt:
      "A backtest computes a trading signal from each day's closing price and assumes the trade is executed at that same closing price. What is wrong with this, what does it do to the results, and how would you fix it?",
    rubric: [
      "Identifies look-ahead bias: the signal uses information that is not available at the time of the trade.",
      "Explains that the closing price is only known once the market has closed, so you cannot trade at it using a signal that depends on it.",
      "States that the backtest results are overstated (too optimistic).",
      "Gives a fix: lag the signal by one bar, or execute at the next day's open or close, and include trading costs.",
    ],
    referenceCard:
      "Look-ahead bias: a backtest uses data that would not have been known at the decision time. A common guard in pandas is to shift the signal by one period, for example `position = signal.shift(1)`, before multiplying by returns.",
    hints: [
      "At what time do you know the closing price?",
      "At what time does the backtest assume you traded?",
      "How could you change the timing so the trade only uses information you already had?",
    ],
    shortAnswer: "It is look-ahead bias. The close is not known until after the close, so results are inflated. Trade on the next bar instead.",
    steps:
      "1. The signal needs the closing price, which is only final after the market closes.\n2. The backtest trades at that same price, so it acts on information before it exists.\n3. This look-ahead bias makes the strategy look better than it could be in live trading.\n4. Fix: compute the signal at the close and trade at the next open or next close (shift the signal by one bar).\n5. Also model costs and slippage so the result is realistic.",
    theory: "A valid backtest may only use information available at each decision time. Violations are called look-ahead bias.",
    intuition: "It is like betting on a race after seeing the finish. Any strategy looks good if it can see the answer first.",
  }),

  // ───────────────────────── 11 Trading judgment and interview skills
  numeric({
    categoryId: 11,
    difficulty: 1,
    prompt: "Mental math: what is 48 x 52?",
    correctValue: 2496,
    tolerance: 0.0001,
    unit: null,
    referenceCard: "Difference of squares: (a - b)(a + b) = a^2 - b^2. It is useful when two numbers are the same distance from a round number.",
    hints: ["Both numbers are 2 away from 50.", "Compute 50^2 and subtract 2^2."],
    shortAnswer: "2,496.",
    steps: "1. 48 x 52 = (50 - 2)(50 + 2).\n2. = 50^2 - 2^2 = 2500 - 4.\n3. = 2496.",
    theory: "Algebraic identities turn hard multiplications into easy ones.",
    intuition: "Two numbers centered on 50 multiply to slightly less than 50 squared, and the shortfall is the square of the distance.",
  }),
  numeric({
    categoryId: 11,
    difficulty: 2,
    prompt: "You roll two fair six-sided dice and are paid the larger of the two numbers, in dollars. What is the expected payoff?",
    correctValue: 161 / 36,
    tolerance: 0.005,
    unit: "$",
    referenceCard:
      "For the maximum of two independent rolls: P(max <= k) = (k/6)^2, so P(max = k) = (k^2 - (k - 1)^2) / 36 = (2k - 1) / 36. Expected value = sum of k x P(max = k).",
    hints: [
      "How many of the 36 outcomes have a maximum of exactly k?",
      "The counts for k = 1 to 6 are 1, 3, 5, 7, 9, 11.",
    ],
    shortAnswer: "161/36, about $4.47.",
    steps:
      "1. Outcomes with maximum k: 2k - 1, giving 1, 3, 5, 7, 9, 11 for k = 1 to 6.\n2. Sum of k x count = 1 + 6 + 15 + 28 + 45 + 66 = 161.\n3. Expected value = 161 / 36, about 4.47.",
    theory: "The distribution of a maximum comes from its cumulative distribution: the maximum is at most k only when every roll is at most k.",
    intuition: "Taking the better of two rolls lifts the average from 3.5 to about 4.47. High numbers are much more likely as a maximum: 11 of 36 outcomes give a 6.",
  }),
  mcq({
    categoryId: 11,
    difficulty: 2,
    prompt:
      "A prize is behind one of three doors. You pick a door. The host, who knows where the prize is, always opens one of the other two doors to show it is empty, then offers you the chance to switch to the remaining closed door. What should you do?",
    options: [
      "Stay: your first door wins with probability 2/3",
      "It makes no difference: each closed door wins with probability 1/2",
      "Switch: the other door wins with probability 2/3",
      "Switch: the other door wins with probability 3/4",
    ],
    correctOption: 2,
    optionReasons: [
      "Your first pick was right with probability 1/3, and the host's action does not change that.",
      "The two closed doors are not symmetric, because the host knowingly avoided the prize when choosing which door to open.",
      "Correct. Your first pick wins 1/3 of the time. In the other 2/3 of cases the host is forced to leave the prize behind the remaining door.",
      "Switching is right, but the probability is 2/3. The two closed doors must add up to 1 and the first door keeps 1/3.",
    ],
    referenceCard:
      "Conditional probability: update on how the evidence was produced. Here the host must open an empty door from the two you did not pick. If your first pick is wrong (probability 2/3), that leaves him only one door he can open.",
    hints: [
      "What is the probability that your first pick was right?",
      "If your first pick was wrong, what is behind the door the host leaves closed?",
    ],
    shortAnswer: "Switch. It wins with probability 2/3.",
    steps:
      "1. Your first pick is right with probability 1/3.\n2. If it is right, switching loses.\n3. If it is wrong (probability 2/3), the host must open the only other empty door, so the remaining door has the prize and switching wins.\n4. Switching wins with probability 2/3.",
    theory: "This is the Monty Hall problem. The answer depends on the host's rule: he knows where the prize is and always reveals an empty door.",
    intuition: "Switching is the same as being offered both of the other doors at once. Picture 100 doors: you pick one, the host opens 98 empty ones, and the single door he avoided is very likely the prize.",
  }),
  long({
    categoryId: 11,
    difficulty: 2,
    prompt:
      "An interviewer asks you to make a market on the sum of two fair six-sided dice: the contract pays that sum in dollars. What is the fair value, what two-sided quote would you give, and what do you do with your quote after the interviewer buys from you at your offer?",
    rubric: [
      "States that the fair value is 7.",
      "Gives a two-sided quote around 7 with a sensible spread, for example 6.5 bid at 7.5 offered.",
      "Explains that the spread is the edge, and its width reflects uncertainty and the risk of trading with someone who knows more.",
      "After being lifted, moves the quote up (or at least raises the offer) to manage the short position and possible adverse selection.",
    ],
    referenceCard:
      "Expected value of one fair die is 3.5, and expectations add. A market maker quotes a bid below fair value and an offer above it, earns the spread on average, and shifts quotes in the direction of the trades received to control inventory.",
    hints: [
      "What is the expected value of one die? Of two?",
      "Where do you put your bid and your offer relative to fair value, and why not both at fair value?",
      "You are now short one contract. Do you want to sell more at the same price?",
    ],
    shortAnswer: "Fair value is 7. Quote around it, for example 6.5 at 7.5. After someone buys at 7.5 you are short, so move the quote up, for example 7 at 8.",
    steps:
      "1. Fair value = 3.5 + 3.5 = 7.\n2. Quote a bid below and an offer above, for example 6.5 bid, 7.5 offered. Each trade then has an expected edge of 0.5.\n3. The interviewer lifts the offer: you are short one contract at 7.5.\n4. Shift the quote up, for example 7 bid at 8 offered. This makes it easier to buy back and harder for them to buy more, and it respects the chance that they know something.\n5. With fair dice there is no real information, so the main reason is inventory, but in real markets a buyer may be informed.",
    theory: "Market making earns the bid-ask spread while managing inventory risk and adverse selection.",
    intuition: "Quote where you are happy to trade on either side, and when someone trades with you, lean your prices away from them.",
  }),

  // ───────────────────────── 12 Industry context
  mcq({
    categoryId: 12,
    difficulty: 1,
    prompt: "In a bank, functions such as risk management and product control are usually described as part of the:",
    options: ["Front office", "Middle office", "Back office", "Buy side"],
    correctOption: 1,
    optionReasons: [
      "The front office is the revenue-generating part: sales, trading, and investment banking.",
      "Correct. The middle office monitors and controls the risks and the profit and loss produced by the front office.",
      "The back office handles settlement, clearing, and record keeping.",
      "The buy side means firms that invest money, such as asset managers and hedge funds. It is not a division of a bank.",
    ],
    referenceCard:
      "Front office: generates revenue and faces clients (sales, trading, banking). Middle office: risk management and product control. Back office: operations, settlement, and record keeping.",
    hints: ["Which group sits between the traders and the operations staff and checks the traders' risk and PnL?"],
    shortAnswer: "Middle office.",
    steps:
      "1. Front office takes risk and earns revenue.\n2. Middle office measures and controls that risk and verifies the profit and loss.\n3. Back office settles the trades and keeps the records.",
    theory: "Banks separate the people who take risk from the people who measure and control it.",
    intuition: "Traders trade, the middle office checks what the traders did, and the back office makes sure the trades actually settle.",
  }),
  mcq({
    categoryId: 12,
    difficulty: 2,
    prompt: "What is the main difference between a proprietary trading firm and a hedge fund?",
    options: [
      "A prop firm trades only stocks, while a hedge fund trades only derivatives",
      "A prop firm trades its own capital, while a hedge fund manages outside investors' money and charges fees",
      "A prop firm is a division of a bank, while a hedge fund is always independent",
      "A prop firm holds positions for years, while a hedge fund trades intraday",
    ],
    correctOption: 1,
    optionReasons: [
      "Both kinds of firm trade many asset classes, including stocks and derivatives.",
      "Correct. The source of capital is the defining difference. Hedge funds typically charge a management fee and a performance fee.",
      "Many prop firms are independent companies, not parts of banks.",
      "If anything it is the reverse: many prop firms trade at very short horizons, and both kinds of firm vary.",
    ],
    referenceCard:
      "Proprietary trading firm: trades the firm's own money and keeps the profits. Hedge fund: pools money from outside investors, and earns a management fee on assets plus a performance fee on profits.",
    hints: ["Think about whose money is at risk."],
    shortAnswer: "A prop firm trades its own capital. A hedge fund manages outside investors' money for fees.",
    steps:
      "1. A prop firm's capital belongs to the firm and its partners, so all trading profit is the firm's.\n2. A hedge fund raises capital from outside investors.\n3. The hedge fund earns fees on that capital: a management fee and a share of the profits.",
    theory: "The source of capital shapes a firm's incentives, regulation, and reporting duties.",
    intuition: "A prop firm bets its own money. A hedge fund is paid to bet other people's money.",
  }),
  numeric({
    categoryId: 12,
    difficulty: 2,
    prompt:
      "A trader buys 1,000 shares at $50.00 and later sells them all at $50.35. The commission is $0.005 per share on each trade. What is the net profit, in dollars?",
    correctValue: 340,
    tolerance: 0.001,
    unit: "$",
    referenceCard:
      "Net PnL = gross PnL - costs. Gross PnL = (sell price - buy price) x quantity. Commissions are paid on both the buy and the sell.",
    hints: ["Find the gross profit first.", "The commission applies to 2,000 shares in total: 1,000 bought and 1,000 sold."],
    shortAnswer: "$340.",
    steps:
      "1. Gross PnL = (50.35 - 50.00) x 1,000 = 350.\n2. Commission = 0.005 x 1,000 x 2 = 10.\n3. Net PnL = 350 - 10 = 340.",
    theory: "Profit and loss is measured after transaction costs. For strategies with small edges, costs decide whether the strategy is viable.",
    intuition: "You made 35 cents a share and paid 1 cent a share in total commissions, so you keep 34 cents a share.",
  }),
];

import type { NewQuestion } from "../lib/types";
import { long, mcq, numeric } from "./seed-builders";
import { EXTRA_SEED_QUESTIONS } from "./seed-questions-extra";

/**
 * Seed questions, one or more per category. Every answer here was checked by hand.
 * correctOption is a zero-based index into options.
 */
const FIRST_SEED_QUESTIONS: NewQuestion[] = [
  // 1 Probability and statistics
  numeric({
    categoryId: 1,
    difficulty: 1,
    prompt: "Two fair six-sided dice are rolled. What is the probability that the sum is 7? Answer as a decimal.",
    correctValue: 1 / 6,
    tolerance: 0.01,
    unit: null,
    referenceCard:
      "With equally likely outcomes, probability = favorable outcomes / total outcomes. Two dice have 6 x 6 = 36 equally likely outcomes.",
    hints: ["Count the total number of outcomes first.", "List every pair of dice values that adds up to 7."],
    shortAnswer: "1/6, about 0.1667.",
    steps:
      "1. There are 36 equally likely outcomes.\n2. The pairs summing to 7 are (1,6), (2,5), (3,4), (4,3), (5,2), (6,1), which is 6 outcomes.\n3. Probability = 6/36 = 1/6.",
    theory: "Classical probability: count favorable outcomes and divide by the total when all outcomes are equally likely.",
    intuition: "Whatever the first die shows, exactly one value on the second die makes 7, so the chance is 1 in 6.",
  }),
  mcq({
    categoryId: 1,
    difficulty: 2,
    prompt:
      "A disease affects 1% of people. A test detects it 99% of the time when it is present and gives a false positive 5% of the time when it is absent. You test positive. About how likely is it that you have the disease?",
    options: ["About 99%", "About 50%", "About 17%", "About 5%"],
    correctOption: 2,
    optionReasons: [
      "This confuses P(positive | disease) with P(disease | positive).",
      "This ignores how rare the disease is.",
      "Correct. 99 true positives out of 594 total positives is about 16.7%.",
      "This is the false positive rate, which is not the quantity asked for.",
    ],
    referenceCard:
      "Bayes' theorem: P(A | B) = P(B | A) x P(A) / P(B). The denominator P(B) adds up every way B can happen.",
    hints: [
      "Imagine 10,000 people and count how many test positive.",
      "Split the positives into people who are sick and people who are healthy (false positives).",
    ],
    shortAnswer: "About 17%.",
    steps:
      "1. Out of 10,000 people, 100 are sick and 9,900 are healthy.\n2. Sick people testing positive: 99% of 100 = 99.\n3. Healthy people testing positive: 5% of 9,900 = 495.\n4. Total positives = 594.\n5. P(sick | positive) = 99 / 594, about 16.7%.",
    theory: "Bayes' theorem combines the prior (1%) with the test's accuracy to give the posterior probability.",
    intuition: "The disease is rare, so false positives from the large healthy group outnumber true positives from the small sick group.",
  }),
  long({
    categoryId: 1,
    difficulty: 3,
    prompt:
      "You flip a fair coin repeatedly. On average, how many flips does it take to first see HH (two heads in a row), and how many to first see HT? Explain why the two numbers differ.",
    rubric: [
      "States that the expected wait is 6 flips for HH and 4 flips for HT.",
      "Explains the difference: after a miss on HH you start over, but after H then H on HT you keep your progress.",
      "Uses a state-based or recursive expectation argument.",
    ],
    referenceCard:
      "Expected waiting time by states: let E(s) be the expected number of further flips from state s. Write one equation per state, using E(s) = 1 + sum of probability x E(next state), and solve.",
    hints: [
      "Define states by how much of the pattern you have matched so far.",
      "What happens to your progress after a miss in each pattern?",
    ],
    shortAnswer: "HH takes 6 flips on average, HT takes 4.",
    steps:
      "HH: states are start (E0) and just-saw-H (E1).\nE0 = 1 + 0.5 E1 + 0.5 E0, E1 = 1 + 0.5 x 0 + 0.5 E0. So E1 = 1 + 0.5 E0 and E0 = 1.5 + 0.75 E0, giving E0 = 6.\n\nHT: E0 = 1 + 0.5 E1 + 0.5 E0, E1 = 1 + 0.5 x 0 + 0.5 E1. So E1 = 2 and E0 = 2 + 0.5 E0, giving E0 = 4.",
    theory: "Waiting times for patterns in coin flips depend on how the pattern overlaps with itself.",
    intuition:
      "After H then H you are still one flip from HT, so a miss costs nothing. After H then T you are back at the start for HH, so a miss costs you everything.",
  }),

  // 2 Math foundations
  numeric({
    categoryId: 2,
    difficulty: 2,
    prompt: "Let f(x) = x^2 * e^x. Compute f'(1). Give a decimal.",
    correctValue: 3 * Math.E,
    tolerance: 0.001,
    unit: null,
    referenceCard: "Product rule: (u v)' = u' v + u v'. The derivative of e^x is e^x. The derivative of x^2 is 2x.",
    hints: ["Use the product rule with u = x^2 and v = e^x.", "Factor out e^x before plugging in x = 1."],
    shortAnswer: "3e, about 8.1548.",
    steps: "1. f'(x) = 2x e^x + x^2 e^x = (2x + x^2) e^x.\n2. At x = 1: (2 + 1) e = 3e.\n3. 3e is about 8.1548.",
    theory: "The product rule differentiates a product of two functions.",
    intuition: "Both factors grow with x, so both contribute to the slope, and the product rule adds the two contributions.",
  }),

  // 3 Markets and instruments
  mcq({
    categoryId: 3,
    difficulty: 1,
    prompt:
      "For European options on a stock that pays no dividends, with strike K, risk-free rate r, and time to expiry T, put-call parity says C - P equals which of the following?",
    options: ["S + K", "S - K e^(-rT)", "K - S", "K e^(-rT) - S"],
    correctOption: 1,
    optionReasons: [
      "Adding the strike has no basis in the parity argument.",
      "Correct. A call plus cash K e^(-rT) equals a put plus the stock, so C - P = S - K e^(-rT).",
      "This has the wrong sign and ignores discounting.",
      "This is the negative of the correct answer.",
    ],
    referenceCard:
      "Put-call parity: C + K e^(-rT) = P + S. Two portfolios with the same payoff at expiry must have the same price today.",
    hints: [
      "Compare a call plus cash against a put plus the stock. What is each worth at expiry?",
      "Both portfolios are worth max(S_T, K) at expiry.",
    ],
    shortAnswer: "S - K e^(-rT).",
    steps:
      "1. Portfolio A: one call plus cash of K e^(-rT), which grows to K at expiry.\n2. Portfolio B: one put plus one share.\n3. At expiry both are worth max(S_T, K).\n4. By no-arbitrage they cost the same today: C + K e^(-rT) = P + S.\n5. Rearranging: C - P = S - K e^(-rT).",
    theory: "Put-call parity follows from no-arbitrage: identical payoffs must have identical prices.",
    intuition: "Being long a call and short a put is a synthetic forward purchase of the stock at price K.",
  }),

  // 4 Pricing and derivatives theory
  numeric({
    categoryId: 4,
    difficulty: 2,
    prompt:
      "A stock is at $100 and will be either $120 or $80 after one period. The risk-free rate for the period is 5%. What is the no-arbitrage price of a call option with strike $100? Answer in dollars.",
    correctValue: (0.625 * 20) / 1.05,
    tolerance: 0.01,
    unit: "$",
    referenceCard:
      "One-period binomial pricing: risk-neutral probability q = ((1 + r) S0 - S_down) / (S_up - S_down). Option price = (q x payoff_up + (1 - q) x payoff_down) / (1 + r).",
    hints: [
      "Compute the risk-neutral probability of the up move first.",
      "What are the call payoffs in the up and down states?",
    ],
    shortAnswer: "About $11.90.",
    steps:
      "1. q = (1.05 x 100 - 80) / (120 - 80) = 25 / 40 = 0.625.\n2. Call payoffs: up = 120 - 100 = 20, down = 0.\n3. Price = (0.625 x 20 + 0.375 x 0) / 1.05 = 12.5 / 1.05, about 11.90.",
    theory: "Risk-neutral pricing: the option price is the discounted expected payoff under the probability that makes the stock earn the risk-free rate.",
    intuition: "You can replicate the option with shares and borrowing, so its price must equal the cost of that portfolio, regardless of the real-world probability.",
  }),

  // 5 Risk and portfolio management
  numeric({
    categoryId: 5,
    difficulty: 1,
    prompt:
      "A portfolio returned 12% over the year with 20% volatility. The risk-free rate was 2%. What is its Sharpe ratio?",
    correctValue: 0.5,
    tolerance: 0.01,
    unit: null,
    referenceCard: "Sharpe ratio = (portfolio return - risk-free rate) / standard deviation of portfolio returns.",
    hints: ["Subtract the risk-free rate from the return first."],
    shortAnswer: "0.5.",
    steps: "1. Excess return = 12% - 2% = 10%.\n2. Sharpe = 10% / 20% = 0.5.",
    theory: "The Sharpe ratio measures excess return per unit of total risk.",
    intuition: "It tells you how much extra return you earned for each unit of volatility you endured.",
  }),

  // 6 Corporate finance and valuation
  numeric({
    categoryId: 6,
    difficulty: 1,
    prompt: "A company has an enterprise value of $500 million, debt of $200 million, and cash of $50 million. What is its equity value, in $ millions?",
    correctValue: 350,
    tolerance: 0.001,
    unit: "$ million",
    referenceCard: "Enterprise value = equity value + debt - cash. Equivalently, equity value = EV - debt + cash.",
    hints: ["Start from EV = equity + debt - cash and solve for equity."],
    shortAnswer: "$350 million.",
    steps: "1. Equity value = EV - debt + cash.\n2. = 500 - 200 + 50 = 350.",
    theory: "Enterprise value is the value of the operating business to all capital providers, before subtracting net debt.",
    intuition: "Equity holders own the business after debt is paid, and cash on hand offsets some of that debt.",
  }),

  // 7 Accounting
  mcq({
    categoryId: 7,
    difficulty: 1,
    prompt:
      "A company records $100 of depreciation expense. Ignoring taxes, what happens to its cash balance as a result?",
    options: ["Cash decreases by $100", "Cash is unchanged", "Cash increases by $100", "Cash decreases only if the asset is sold"],
    correctOption: 1,
    optionReasons: [
      "Depreciation lowers net income, but it is not a cash payment.",
      "Correct. It reduces net income by $100 but is added back in cash flow from operations, so cash does not change.",
      "Cash does not increase; the add-back only cancels the lower net income.",
      "Selling the asset is a separate event. Depreciation itself does not move cash.",
    ],
    referenceCard:
      "The three statements link: net income flows into retained earnings and starts the cash flow statement. Non-cash expenses such as depreciation are added back in cash flow from operations.",
    hints: ["Is depreciation an actual payment of money?", "Follow it through the cash flow statement."],
    shortAnswer: "Cash is unchanged.",
    steps:
      "1. Income statement: depreciation expense reduces net income by $100.\n2. Cash flow statement: start with net income, then add back the non-cash depreciation of $100.\n3. The two cancel, so cash is unchanged.\n4. Balance sheet: PP&E falls by $100 and retained earnings fall by $100.",
    theory: "Accrual accounting spreads the cost of an asset over its life, separately from when cash was spent.",
    intuition: "The cash left when you bought the asset. Depreciation just records that cost gradually.",
  }),

  // 8 Macro and central banks
  mcq({
    categoryId: 8,
    difficulty: 1,
    prompt: "A central bank unexpectedly raises its policy interest rate. Existing fixed-rate government bonds typically:",
    options: ["Rise in price", "Fall in price", "Stay unchanged in price", "Start paying higher coupons"],
    correctOption: 1,
    optionReasons: [
      "Higher rates push yields up, which pushes prices down.",
      "Correct. New bonds pay more, so existing bonds with lower coupons must trade at a lower price.",
      "The price adjusts so the bond's yield matches the new market level.",
      "The coupon on an existing fixed-rate bond is fixed.",
    ],
    referenceCard:
      "A bond's price is the present value of its fixed cash flows. When market yields rise, the discount rate rises and the present value falls. Price and yield move in opposite directions.",
    hints: ["What happens to the present value of fixed cash flows when you discount at a higher rate?"],
    shortAnswer: "They fall in price.",
    steps:
      "1. A bond pays fixed coupons and a face value.\n2. Higher market rates raise the discount rate used to value those cash flows.\n3. A higher discount rate gives a lower present value, so the price falls.",
    theory: "Bond prices and yields are inversely related.",
    intuition: "Nobody pays full price for a 3% coupon when new bonds pay 5%.",
  }),

  // 9 Market structure and regulation
  mcq({
    categoryId: 9,
    difficulty: 2,
    prompt: "In central clearing, what does a central counterparty (CCP) do after a trade is executed?",
    options: [
      "Matches buy and sell orders on the exchange",
      "Becomes the buyer to every seller and the seller to every buyer",
      "Sets the bid-ask spread",
      "Only reports the trade to the public tape",
    ],
    correctOption: 1,
    optionReasons: [
      "Order matching is done by the exchange or trading venue, before clearing.",
      "Correct. This is called novation. It removes counterparty risk between the original traders.",
      "Spreads are set by market makers and order flow, not by the CCP.",
      "Trade reporting is separate from clearing.",
    ],
    referenceCard:
      "Clearing happens after execution and before settlement. A CCP steps between the two parties through novation, replacing one bilateral contract with two contracts that each face the CCP.",
    hints: ["Think about what risk a clearinghouse is designed to remove."],
    shortAnswer: "It becomes the counterparty to both sides (novation).",
    steps:
      "1. A buyer and a seller trade.\n2. The CCP replaces the original contract with two: one between the buyer and the CCP, one between the CCP and the seller.\n3. Each party now faces the CCP, not each other, so one party's default does not directly hurt the other.",
    theory: "Central clearing concentrates and manages counterparty risk using margin and default funds.",
    intuition: "It is like an escrow service that guarantees both sides will be paid.",
  }),

  // 10 Programming and data
  mcq({
    categoryId: 10,
    difficulty: 1,
    prompt: "What is the average time complexity of looking up a key in a Python dictionary?",
    options: ["O(1)", "O(log n)", "O(n)", "O(n log n)"],
    correctOption: 0,
    optionReasons: [
      "Correct. A dictionary is a hash table, so an average lookup takes constant time.",
      "That is the cost of a lookup in a balanced search tree or binary search on a sorted list.",
      "That is the cost of scanning a list. It is also the worst case for a dictionary with heavy collisions.",
      "That is the cost of sorting, not looking up one key.",
    ],
    referenceCard:
      "A hash table maps a key to a bucket with a hash function, so a lookup does not need to scan other items. Average case is O(1). Worst case, with many collisions, is O(n).",
    hints: ["Think about how a dict finds a key without scanning every entry."],
    shortAnswer: "O(1) on average.",
    steps:
      "1. Python computes the key's hash.\n2. The hash points to a slot in the table.\n3. A lookup checks that slot, which takes constant time on average.",
    theory: "Hash tables trade extra memory for constant-time average lookup.",
    intuition: "It is like going straight to the right drawer instead of searching every drawer.",
  }),

  // 11 Trading judgment and interview skills
  numeric({
    categoryId: 11,
    difficulty: 2,
    prompt:
      "You roll a fair six-sided die and are paid the number shown, in dollars. You may roll once more instead, but then you must keep the second result. What is your expected payoff with optimal play?",
    correctValue: 4.25,
    tolerance: 0.01,
    unit: "$",
    referenceCard:
      "Expected value = sum of (value x probability). Optimal stopping: keep your current result if it beats the expected value of continuing, otherwise continue.",
    hints: ["What is the expected value of one fresh roll?", "Keep the first roll only when it beats that number."],
    shortAnswer: "$4.25.",
    steps:
      "1. A fresh roll is worth 3.5 on average.\n2. Keep the first roll if it is 4, 5, or 6 (all above 3.5). Re-roll if it is 1, 2, or 3.\n3. EV = (1/6)(4 + 5 + 6) + (3/6)(3.5) = 2.5 + 1.75 = 4.25.",
    theory: "Optimal stopping compares the value of stopping now with the value of continuing.",
    intuition: "Re-rolling a low number gives you a fresh average roll, which is worth more than a low result.",
  }),

  // 12 Industry context
  mcq({
    categoryId: 12,
    difficulty: 1,
    prompt: "On the sell side of an investment bank, which group typically executes client trades and makes markets in securities?",
    options: ["Investment banking coverage", "Sales and trading", "Equity research", "Compliance"],
    correctOption: 1,
    optionReasons: [
      "Coverage bankers advise clients on deals such as mergers and offerings.",
      "Correct. Sales and trading handles client orders and quotes prices in securities.",
      "Research analyzes companies and publishes reports.",
      "Compliance monitors the firm's activity for rule violations.",
    ],
    referenceCard:
      "A sell-side bank has several groups: investment banking (advising and raising capital), sales and trading (executing and making markets), and research (publishing analysis).",
    hints: ["Which group deals with day-to-day client orders and prices?"],
    shortAnswer: "Sales and trading.",
    steps:
      "1. Investment banking advises on deals.\n2. Research publishes analysis.\n3. Compliance monitors rules.\n4. Sales and trading takes client orders and makes markets in securities.",
    theory: "Sell-side firms provide services to clients: advice, trading, and research.",
    intuition: "Sales and trading is the part of the bank that is always on the other side of a client's order.",
  }),
];

export const SEED_QUESTIONS: NewQuestion[] = [...FIRST_SEED_QUESTIONS, ...EXTRA_SEED_QUESTIONS];

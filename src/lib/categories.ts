export const CATEGORIES = [
  { id: 1, name: "Probability and statistics" },
  { id: 2, name: "Math foundations" },
  { id: 3, name: "Markets and instruments" },
  { id: 4, name: "Pricing and derivatives theory" },
  { id: 5, name: "Risk and portfolio management" },
  { id: 6, name: "Corporate finance and valuation" },
  { id: 7, name: "Accounting" },
  { id: 8, name: "Macro and central banks" },
  { id: 9, name: "Market structure and regulation" },
  { id: 10, name: "Programming and data" },
  { id: 11, name: "Trading judgment and interview skills" },
  { id: 12, name: "Industry context" },
] as const;

export const CATEGORY_IDS: number[] = CATEGORIES.map((c) => c.id);

// Invented sample data for UI concept mockups only — not real financial data.
const SAMPLE_TRANSACTIONS = [
  { date: "2026-09-24", desc: "Northgate Grocery Co-op",      category: "Groceries",      amount: -86.42,  dir: "out" },
  { date: "2026-09-23", desc: "Riverside Property Mgmt — Rent", category: "Housing",       amount: -1450.00, dir: "out" },
  { date: "2026-09-23", desc: "Halden & Voss Freelance Payout", category: "Income",        amount: 2200.00, dir: "in"  },
  { date: "2026-09-22", desc: "Meridian Transit Pass",         category: "Transport",      amount: -64.00,  dir: "out" },
  { date: "2026-09-21", desc: "Copper Kettle Coffee House",    category: "Dining Out",     amount: -6.75,   dir: "out" },
  { date: "2026-09-20", desc: "Lumen Fitness Studio",          category: "Health",         amount: -42.00,  dir: "out" },
  { date: "2026-09-19", desc: "Orbit Streaming Bundle",        category: "Subscriptions",  amount: -18.99,  dir: "out" },
  { date: "2026-09-18", desc: "Quarter Moon Diner",            category: "Dining Out",     amount: -29.10,  dir: "out" },
  { date: "2026-09-17", desc: "Blackwell & Reed — Salary",     category: "Income",         amount: 3100.00, dir: "in"  },
  { date: "2026-09-16", desc: "Fairview Utilities Co-op",      category: "Utilities",      amount: -112.30, dir: "out" },
  { date: "2026-09-15", desc: "Pinehollow Insurance Group",    category: "Insurance",      amount: -75.50,  dir: "out" },
  { date: "2026-09-14", desc: "Anchor & Vine Marketplace",     category: "Shopping",       amount: -54.87,  dir: "out" },
  { date: "2026-09-13", desc: "Birthday Gift — M. Alder",      category: "Gifts",          amount: -40.00,  dir: "out" },
  { date: "2026-09-12", desc: "Overpaid Utility Refund",       category: "Refund",         amount: 22.14,   dir: "in"  },
  { date: "2026-09-11", desc: "Cascade ATM Withdrawal",        category: "Cash",           amount: -100.00, dir: "out" },
];

const SAMPLE_SUMMARY = {
  period: "September 2026",
  openingBalance: 4380.12,
  totalIn: 5322.14,
  totalOut: 2079.93,
  closingBalance: 7622.33,
  budgetCap: 2400.00,
  budgetSpent: 2079.93,
};

if (typeof module !== "undefined") module.exports = { SAMPLE_TRANSACTIONS, SAMPLE_SUMMARY };

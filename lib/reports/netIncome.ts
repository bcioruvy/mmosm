type AccountActivity = {
  type: string;
  code: string;
  total_debit: string | number;
  total_credit: string | number;
};

/**
 * Nets revenue/COGS/expense account activity into P&L subtotals.
 * Account 4900 (Sales Returns & Allowances) is a revenue-type account
 * but is kept as its own line — shown as a deduction from gross sales,
 * never folded into a single Revenue figure before display (that would
 * defeat the reason it exists as a separate account).
 */
export function computeNetIncome(rows: AccountActivity[]) {
  let grossSales = 0;
  let returns = 0;
  let cogs = 0;
  let expenses = 0;

  for (const r of rows) {
    const debit = Number(r.total_debit);
    const credit = Number(r.total_credit);
    if (r.type === "revenue" && r.code === "4900") {
      returns += debit - credit;
    } else if (r.type === "revenue") {
      grossSales += credit - debit;
    } else if (r.type === "cogs") {
      cogs += debit - credit;
    } else if (r.type === "expense") {
      expenses += debit - credit;
    }
  }

  const netRevenue = grossSales - returns;
  const grossProfit = netRevenue - cogs;
  const netIncome = grossProfit - expenses;

  return { grossSales, returns, netRevenue, cogs, grossProfit, expenses, netIncome };
}

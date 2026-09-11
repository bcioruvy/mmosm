type AccountActivity = {
  type: string;
  name: string;
  total_debit: string | number;
  total_credit: string | number;
};

export type ExpenseCategorySlice = { label: string; value: number };

const CATEGORY_CAP = 7;

/**
 * Groups the same period rows computeNetIncome consumes into expense-by-
 * category slices for the dashboard donut — no separate query. Caps at 7
 * named categories (dataviz skill's series-count ladder) and folds the
 * remainder into "Other" rather than generating more hues than the
 * validated categorical palette has slots for.
 */
export function expenseBreakdown(rows: AccountActivity[]): ExpenseCategorySlice[] {
  const items = rows
    .filter((r) => r.type === "cogs" || r.type === "expense")
    .map((r) => ({ label: r.name, value: Number(r.total_debit) - Number(r.total_credit) }))
    .filter((r) => r.value > 0.01)
    .sort((a, b) => b.value - a.value);

  if (items.length <= CATEGORY_CAP) return items;

  const top = items.slice(0, CATEGORY_CAP);
  const otherTotal = items.slice(CATEGORY_CAP).reduce((s, r) => s + r.value, 0);
  return [...top, { label: "Other", value: otherTotal }];
}

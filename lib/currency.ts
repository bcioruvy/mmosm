export function formatCurrency(amount: number): string {
  return `Rs ${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

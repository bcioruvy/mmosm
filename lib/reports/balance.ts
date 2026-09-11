import { formatCurrency } from "@/lib/currency";

/** The ISO date immediately before the given ISO date. */
export function dayBefore(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** Renders a net debit/credit figure as "Rs X Dr" or "Rs X Cr". */
export function balanceLabel(net: number): string {
  return net >= 0 ? `${formatCurrency(net)} Dr` : `${formatCurrency(-net)} Cr`;
}

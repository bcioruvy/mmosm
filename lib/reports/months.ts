/**
 * The last `count` calendar months ending with the current one (which is
 * capped at today, not the end of the month). Independent of whatever
 * period is selected elsewhere on the dashboard — a deliberate
 * simplification so the trend chart doesn't need to adapt its
 * granularity to an arbitrary selected range.
 */
export function trailingMonths(count: number): { start: string; end: string; label: string }[] {
  const now = new Date();
  const months: { start: string; end: string; label: string }[] = [];

  for (let i = count - 1; i >= 0; i--) {
    const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const lastDayOfMonth = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0));
    const end = i === 0 ? now : lastDayOfMonth;
    months.push({
      start: first.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10),
      label: first.toLocaleString("en-US", { month: "short", timeZone: "UTC" }),
    });
  }

  return months;
}

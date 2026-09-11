export type PeriodPreset =
  | "today"
  | "this_week"
  | "this_month"
  | "last_month"
  | "this_quarter"
  | "this_year"
  | "last_year"
  | "custom";

export const PERIOD_PRESETS: { value: PeriodPreset; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "this_week", label: "This Week" },
  { value: "this_month", label: "This Month" },
  { value: "last_month", label: "Last Month" },
  { value: "this_quarter", label: "This Quarter" },
  { value: "this_year", label: "This Year" },
  { value: "last_year", label: "Previous Year" },
];

const fmt = (d: Date) => d.toISOString().slice(0, 10);

/** Resolves a period preset (or explicit custom start/end) into concrete dates. */
export function resolvePeriod(
  preset: string | undefined,
  customStart: string | undefined,
  customEnd: string | undefined
): { start: string; end: string; preset: PeriodPreset } {
  const now = new Date();
  const todayStr = fmt(now);

  if (preset === "custom" && customStart && customEnd) {
    return { start: customStart, end: customEnd, preset: "custom" };
  }

  switch (preset) {
    case "today":
      return { start: todayStr, end: todayStr, preset: "today" };
    case "this_week": {
      const day = now.getUTCDay();
      const diffToMonday = (day + 6) % 7;
      const monday = new Date(now);
      monday.setUTCDate(now.getUTCDate() - diffToMonday);
      return { start: fmt(monday), end: todayStr, preset: "this_week" };
    }
    case "this_month": {
      const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      return { start: fmt(first), end: todayStr, preset: "this_month" };
    }
    case "last_month": {
      const firstOfThisMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      const lastMonthEnd = new Date(firstOfThisMonth.getTime() - 86400000);
      const lastMonthStart = new Date(Date.UTC(lastMonthEnd.getUTCFullYear(), lastMonthEnd.getUTCMonth(), 1));
      return { start: fmt(lastMonthStart), end: fmt(lastMonthEnd), preset: "last_month" };
    }
    case "this_quarter": {
      const q = Math.floor(now.getUTCMonth() / 3);
      const first = new Date(Date.UTC(now.getUTCFullYear(), q * 3, 1));
      return { start: fmt(first), end: todayStr, preset: "this_quarter" };
    }
    case "last_year": {
      const y = now.getUTCFullYear() - 1;
      return { start: `${y}-01-01`, end: `${y}-12-31`, preset: "last_year" };
    }
    case "this_year":
    default:
      return { start: `${now.getUTCFullYear()}-01-01`, end: todayStr, preset: "this_year" };
  }
}

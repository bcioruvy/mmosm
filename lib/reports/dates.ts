export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function startOfYearISO(): string {
  return `${new Date().getFullYear()}-01-01`;
}

export function daysAgoISO(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

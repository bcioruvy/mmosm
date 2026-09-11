export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function startOfYearISO(): string {
  return `${new Date().getFullYear()}-01-01`;
}

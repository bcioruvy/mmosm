import type { LucideIcon } from "lucide-react";
import { TrendingUp, TrendingDown } from "lucide-react";

export function StatCard({ icon: Icon, label, value, sub }: { icon: LucideIcon; label: string; value: string; sub?: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border bg-surface p-4 shadow-sm">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-tint text-brand">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <div className="text-xs font-medium uppercase tracking-wide text-muted">{label}</div>
        <div className="mt-1 truncate text-xl font-semibold">{value}</div>
        {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
      </div>
    </div>
  );
}

export function NetIncomeHero({ isProfit, value }: { isProfit: boolean; value: string }) {
  const Icon = isProfit ? TrendingUp : TrendingDown;
  const toneClass = isProfit ? "text-success" : "text-error";
  return (
    <div className="flex items-center gap-4 rounded-xl border border-border bg-surface p-6 shadow-sm">
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-brand-tint">
        <Icon className={`h-7 w-7 ${toneClass}`} />
      </div>
      <div>
        <div className="text-xs font-medium uppercase tracking-wide text-muted">
          {isProfit ? "Net Profit" : "Net Loss"}
        </div>
        <div className={`mt-1 text-3xl font-bold ${toneClass}`}>{value}</div>
      </div>
    </div>
  );
}

export function CardHeader({ icon: Icon, title, action }: { icon: LucideIcon; title: string; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 text-base font-semibold">
        <Icon className="h-4 w-4 text-brand" />
        {title}
      </h2>
      {action}
    </div>
  );
}

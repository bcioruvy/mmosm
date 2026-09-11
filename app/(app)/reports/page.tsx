import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { PERMISSIONS } from "@/lib/permissions";
import {
  BarChart3,
  Scale,
  TrendingUp,
  Landmark,
  BookText,
  ArrowDownCircle,
  ArrowUpCircle,
  ShoppingCart,
  Receipt,
  DollarSign,
  type LucideIcon,
} from "lucide-react";

const REPORTS: { href: string; label: string; description: string; icon: LucideIcon }[] = [
  { href: "/reports/trial-balance", label: "Trial Balance", description: "Debit and credit balances for every account", icon: Scale },
  { href: "/reports/profit-loss", label: "Profit & Loss", description: "Revenue, costs, and net income for a period", icon: TrendingUp },
  { href: "/reports/balance-sheet", label: "Balance Sheet", description: "Assets, liabilities, and equity as of a date", icon: Landmark },
  { href: "/reports/general-ledger", label: "General Ledger", description: "Full transaction history per account", icon: BookText },
  { href: "/reports/ar-aging", label: "AR Aging", description: "Outstanding customer balances by age", icon: ArrowDownCircle },
  { href: "/reports/ap-aging", label: "AP Aging", description: "Outstanding bills by age", icon: ArrowUpCircle },
  { href: "/reports/sales", label: "Sales Report", description: "Invoiced sales by category", icon: ShoppingCart },
  { href: "/reports/expenses", label: "Expense Report", description: "Spending by category", icon: Receipt },
  { href: "/reports/income", label: "Income Report", description: "Non-sale income by category", icon: DollarSign },
];

export default async function ReportsPage() {
  const session = await auth();
  const permissions = session?.user?.permissions ?? [];
  if (!session?.user || !permissions.includes(PERMISSIONS.VIEW_REPORTS)) {
    redirect("/");
  }

  return (
    <main className="max-w-[1100px] px-6 py-10">
      <h1 className="flex items-center gap-2 text-2xl font-bold">
        <BarChart3 className="h-6 w-6 text-brand" />
        Reports
      </h1>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {REPORTS.map((r) => (
          <a
            key={r.href}
            href={r.href}
            className="flex items-start gap-3 rounded-xl border border-border bg-surface p-4 no-underline shadow-sm transition-colors hover:border-brand"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-tint text-brand">
              <r.icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="font-semibold">{r.label}</div>
              <div className="mt-0.5 text-sm text-muted">{r.description}</div>
            </div>
          </a>
        ))}
      </div>
    </main>
  );
}

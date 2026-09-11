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

type ReportLink = { href: string; label: string; description: string; icon: LucideIcon };

const FINANCIAL_STATEMENTS: ReportLink[] = [
  { href: "/reports/trial-balance", label: "Trial Balance", description: "Debit and credit balances for every account", icon: Scale },
  { href: "/reports/profit-loss", label: "Profit & Loss", description: "Revenue, costs, and net income for a period", icon: TrendingUp },
  { href: "/reports/balance-sheet", label: "Balance Sheet", description: "Assets, liabilities, and equity as of a date", icon: Landmark },
  { href: "/reports/general-ledger", label: "General Ledger", description: "Full transaction history per account", icon: BookText },
];

const AGING_AND_ACTIVITY: ReportLink[] = [
  { href: "/reports/ar-aging", label: "AR Aging", description: "Outstanding customer balances by age", icon: ArrowDownCircle },
  { href: "/reports/ap-aging", label: "AP Aging", description: "Outstanding bills by age", icon: ArrowUpCircle },
  { href: "/reports/sales", label: "Sales Report", description: "Invoiced sales by category", icon: ShoppingCart },
  { href: "/reports/expenses", label: "Expense Report", description: "Spending by category", icon: Receipt },
  { href: "/reports/income", label: "Income Report", description: "Non-sale income by category", icon: DollarSign },
];

function ReportCard({ report }: { report: ReportLink }) {
  const Icon = report.icon;
  return (
    <a
      href={report.href}
      className="flex items-start gap-3 rounded-xl border border-border bg-surface p-4 no-underline shadow-sm transition-colors hover:border-brand"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-tint text-brand">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <div className="font-semibold">{report.label}</div>
        <div className="mt-0.5 text-sm text-muted">{report.description}</div>
      </div>
    </a>
  );
}

function ReportSection({ title, subtitle, reports }: { title: string; subtitle: string; reports: ReportLink[] }) {
  return (
    <section className="mt-8 first:mt-6">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-0.5 text-sm text-muted">{subtitle}</p>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {reports.map((r) => (
          <ReportCard key={r.href} report={r} />
        ))}
      </div>
    </section>
  );
}

export default async function ReportsPage() {
  const session = await auth();
  const permissions = session?.user?.permissions ?? [];
  if (!session?.user || !permissions.includes(PERMISSIONS.VIEW_REPORTS)) {
    redirect("/");
  }

  return (
    <main className="max-w-screen-2xl px-6 py-10">
      <h1 className="flex items-center gap-2 text-2xl font-bold">
        <BarChart3 className="h-6 w-6 text-brand" />
        Reports
      </h1>

      <ReportSection
        title="Financial Statements"
        subtitle="The core statements for understanding where the business stands."
        reports={FINANCIAL_STATEMENTS}
      />
      <ReportSection
        title="Aging & Activity"
        subtitle="What's outstanding, and how activity breaks down by category."
        reports={AGING_AND_ACTIVITY}
      />
    </main>
  );
}

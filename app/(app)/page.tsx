import sql from "@/lib/db";
import { formatCurrency } from "@/lib/currency";
import { journalLinesInRange, journalLinesThroughDate } from "@/lib/reports/journalFilters";
import { computeNetIncome } from "@/lib/reports/netIncome";
import { findCrossPeriodAdjustments, hasCrossPeriodAdjustments } from "@/lib/reports/crossPeriodAdjustments";
import { expenseBreakdown } from "@/lib/reports/expenseBreakdown";
import { getInvoiceBalance } from "@/lib/invoiceBalance";
import { todayISO } from "@/lib/reports/dates";
import { resolvePeriod, PERIOD_PRESETS } from "@/lib/reports/periods";
import { trailingMonths } from "@/lib/reports/months";
import TrendChart from "./TrendChart";
import DonutChart from "./DonutChart";
import CrossPeriodAdjustmentsNote from "./reports/CrossPeriodAdjustmentsNote";
import { StatCard, NetIncomeHero, CardHeader } from "./DashboardCards";
import {
  TrendingUp,
  Package,
  Percent,
  Receipt,
  Wallet,
  ArrowDownCircle,
  ArrowUpCircle,
  BarChart3,
  PieChart,
  FileText,
  Calendar,
  History,
} from "lucide-react";

const WIDGET_LIMIT = 8;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { period?: string; start?: string; end?: string };
}) {
  const { start, end, preset } = resolvePeriod(searchParams.period, searchParams.start, searchParams.end);
  const today = todayISO();

  const periodRows = await sql`
    SELECT a.id, a.code, a.name, a.type,
      COALESCE(SUM(f.debit), 0) AS total_debit,
      COALESCE(SUM(f.credit), 0) AS total_credit
    FROM accounts a
    JOIN (${journalLinesInRange(start, end)}) f ON f.account_id = a.id
    WHERE a.type IN ('revenue', 'cogs', 'expense')
    GROUP BY a.id, a.code, a.name, a.type
  `;
  const { netRevenue, cogs, grossProfit, expenses: opEx, netIncome } = computeNetIncome(periodRows as any);
  const crossPeriodAdjustments = await findCrossPeriodAdjustments(start, end);
  const expenseCategories = expenseBreakdown(periodRows as any);

  const [{ cash_balance }] = await sql`
    SELECT COALESCE(SUM(f.debit), 0) - COALESCE(SUM(f.credit), 0) AS cash_balance
    FROM accounts a
    JOIN (${journalLinesThroughDate(today)}) f ON f.account_id = a.id
    WHERE a.system_role = 'cash_or_bank'
  `;

  const openInvoicesRaw = await sql`
    SELECT i.id, i.invoice_number, i.due_date, c.name AS customer_name
    FROM invoices i JOIN customers c ON c.id = i.customer_id
    WHERE i.status IN ('sent', 'partial')
    ORDER BY i.due_date
  `;
  const openInvoices = await Promise.all(
    openInvoicesRaw.map(async (inv: any) => ({
      ...inv,
      remaining: (await getInvoiceBalance(inv.id)).remainingOwed,
    }))
  );
  const arTotal = openInvoices.reduce((s: number, inv: any) => s + inv.remaining, 0);

  const unpaidExpensesRaw = await sql`
    SELECT e.id, e.amount, e.due_date, e.expense_date, cat.name AS category_name,
      COALESCE(v.name, 'No vendor') AS vendor_name, COALESCE(p.paid, 0) AS paid
    FROM expenses e
    JOIN accounts cat ON cat.id = e.category_account_id
    LEFT JOIN vendors v ON v.id = e.vendor_id
    LEFT JOIN (
      SELECT applied_to_id, SUM(amount) AS paid FROM payments
      WHERE applied_to_type = 'expense' AND voided_at IS NULL
      GROUP BY applied_to_id
    ) p ON p.applied_to_id = e.id
    WHERE e.payment_status IN ('unpaid', 'partial') AND e.voided_at IS NULL
    ORDER BY COALESCE(e.due_date, e.expense_date)
  `;
  const unpaidExpenses = unpaidExpensesRaw.map((e: any) => ({
    ...e,
    remaining: Math.round((Number(e.amount) - Number(e.paid)) * 100) / 100,
  }));
  const apTotal = unpaidExpenses.reduce((s: number, e: any) => s + e.remaining, 0);

  const months = trailingMonths(6);
  const trend = await Promise.all(
    months.map(async (m) => {
      const rows = await sql`
        SELECT a.type, a.code, COALESCE(SUM(f.debit), 0) AS total_debit, COALESCE(SUM(f.credit), 0) AS total_credit
        FROM accounts a
        JOIN (${journalLinesInRange(m.start, m.end)}) f ON f.account_id = a.id
        WHERE a.type IN ('revenue', 'cogs', 'expense')
        GROUP BY a.id, a.code, a.name, a.type
      `;
      const flagged = await hasCrossPeriodAdjustments(m.start, m.end);
      return { label: m.label, value: computeNetIncome(rows as any).netIncome, flagged };
    })
  );

  const recentEntries = await sql`
    SELECT je.id, je.entry_date, je.description, je.source_type, je.voided_at,
      (SELECT COALESCE(SUM(debit), 0) FROM journal_lines WHERE entry_id = je.id) AS amount
    FROM journal_entries je
    ORDER BY je.created_at DESC
    LIMIT 15
  `;

  return (
    <main className="max-w-screen-2xl px-6 py-10">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <div className="mb-2 mt-4 flex flex-wrap gap-2">
        {PERIOD_PRESETS.map((p) => {
          const isActive = preset === p.value;
          return (
            <a
              key={p.value}
              href={`/?period=${p.value}`}
              className={`rounded-md border px-3 py-1.5 text-sm no-underline transition-colors ${
                isActive ? "border-brand bg-brand text-brand-contrast" : "border-border bg-surface hover:bg-brand-tint"
              }`}
            >
              {p.label}
            </a>
          );
        })}
      </div>
      <form method="get" className="mb-6 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface p-3">
        <input type="hidden" name="period" value="custom" />
        <label className="flex items-center gap-2 text-sm text-muted">
          From <input type="date" name="start" defaultValue={preset === "custom" ? start : ""} />
        </label>
        <label className="flex items-center gap-2 text-sm text-muted">
          To <input type="date" name="end" defaultValue={preset === "custom" ? end : ""} />
        </label>
        <button type="submit">Custom range</button>
      </form>

      <p className="mb-4 text-sm text-muted">
        Period figures below cover {start} to {end}. Cash, AR, and AP are as of today — balances, not period flows.
      </p>

      <CrossPeriodAdjustmentsNote adjustments={crossPeriodAdjustments} />

      <div className="mb-4">
        <NetIncomeHero isProfit={netIncome >= 0} value={formatCurrency(Math.abs(netIncome))} />
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={TrendingUp} label="Revenue" value={formatCurrency(netRevenue)} />
        <StatCard icon={Package} label="COGS" value={formatCurrency(cogs)} />
        <StatCard icon={Percent} label="Gross Profit" value={formatCurrency(grossProfit)} />
        <StatCard icon={Receipt} label="Operating Expenses" value={formatCurrency(opEx)} />
      </div>

      <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard icon={Wallet} label="Cash Balance" value={formatCurrency(Number(cash_balance))} sub="as of today" />
        <StatCard icon={ArrowDownCircle} label="Accounts Receivable" value={formatCurrency(arTotal)} sub="as of today" />
        <StatCard icon={ArrowUpCircle} label="Accounts Payable" value={formatCurrency(apTotal)} sub="as of today" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
          <CardHeader icon={BarChart3} title="Profit / Loss Trend (last 6 months)" />
          <TrendChart data={trend} />
        </div>
        <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
          <CardHeader icon={PieChart} title="Expenses by Category" />
          <DonutChart data={expenseCategories} />
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
          <CardHeader
            icon={FileText}
            title="Outstanding Invoices"
            action={
              <a href="/reports/ar-aging" className="text-xs text-brand no-underline hover:underline">
                View all
              </a>
            }
          />
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b text-left">
                <th>Invoice</th>
                <th>Customer</th>
                <th>Due</th>
                <th className="text-right">Owed</th>
              </tr>
            </thead>
            <tbody>
              {openInvoices.slice(0, WIDGET_LIMIT).map((inv: any) => (
                <tr key={inv.id} className="border-b">
                  <td>
                    <a href={`/invoices/${inv.id}`}>{inv.invoice_number}</a>
                  </td>
                  <td>{inv.customer_name}</td>
                  <td>{new Date(inv.due_date).toLocaleDateString()}</td>
                  <td className="text-right">{formatCurrency(inv.remaining)}</td>
                </tr>
              ))}
              {openInvoices.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-muted">
                    Nothing outstanding.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
          <CardHeader
            icon={Calendar}
            title="Upcoming Bills"
            action={
              <a href="/reports/ap-aging" className="text-xs text-brand no-underline hover:underline">
                View all
              </a>
            }
          />
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b text-left">
                <th>Vendor</th>
                <th>Category</th>
                <th>Due</th>
                <th className="text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {unpaidExpenses.slice(0, WIDGET_LIMIT).map((e: any) => (
                <tr key={e.id} className="border-b">
                  <td>{e.vendor_name}</td>
                  <td>{e.category_name}</td>
                  <td>{new Date(e.due_date ?? e.expense_date).toLocaleDateString()}</td>
                  <td className="text-right">{formatCurrency(e.remaining)}</td>
                </tr>
              ))}
              {unpaidExpenses.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-muted">
                    Nothing due.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-border bg-surface p-5 shadow-sm">
        <CardHeader icon={History} title="Recent Transactions" />
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b text-left">
              <th>Date</th>
              <th>Description</th>
              <th>Type</th>
              <th className="text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {recentEntries.map((entry: any) => (
              <tr key={entry.id} className="border-b" style={{ opacity: entry.voided_at ? 0.5 : 1 }}>
                <td>{new Date(entry.entry_date).toLocaleDateString()}</td>
                <td>
                  {entry.description}
                  {entry.voided_at ? " (voided)" : ""}
                </td>
                <td>{entry.source_type}</td>
                <td className="text-right">{formatCurrency(Number(entry.amount))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}

import sql from "@/lib/db";
import { formatCurrency } from "@/lib/currency";
import { journalLinesInRange, journalLinesThroughDate } from "@/lib/reports/journalFilters";
import { computeNetIncome } from "@/lib/reports/netIncome";
import { getInvoiceBalance } from "@/lib/invoiceBalance";
import { todayISO } from "@/lib/reports/dates";
import { resolvePeriod, PERIOD_PRESETS } from "@/lib/reports/periods";
import { trailingMonths } from "@/lib/reports/months";
import TrendChart from "./TrendChart";

const WIDGET_LIMIT = 8;

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: 8,
        padding: "14px 18px",
        minWidth: 160,
      }}
    >
      <div style={{ color: "var(--color-text-muted)", fontSize: "0.8em", textTransform: "uppercase", letterSpacing: "0.02em" }}>
        {label}
      </div>
      <div style={{ fontSize: "1.4em", fontWeight: 600, marginTop: 4 }}>{value}</div>
      {sub && <div style={{ color: "var(--color-text-muted)", fontSize: "0.8em", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

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

  const unpaidExpenses = await sql`
    SELECT e.id, e.amount, e.due_date, e.expense_date, cat.name AS category_name,
      COALESCE(v.name, 'No vendor') AS vendor_name
    FROM expenses e
    JOIN accounts cat ON cat.id = e.category_account_id
    LEFT JOIN vendors v ON v.id = e.vendor_id
    WHERE e.payment_status = 'unpaid' AND e.voided_at IS NULL
    ORDER BY COALESCE(e.due_date, e.expense_date)
  `;
  const apTotal = unpaidExpenses.reduce((s: number, e: any) => s + Number(e.amount), 0);

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
      return { label: m.label, value: computeNetIncome(rows as any).netIncome };
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
    <main style={{ maxWidth: 1100, margin: "40px auto", padding: 24 }}>
      <h1>Dashboard</h1>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
        {PERIOD_PRESETS.map((p) => (
          <a
            key={p.value}
            href={`/?period=${p.value}`}
            style={{
              padding: "6px 12px",
              borderRadius: 6,
              border: "1px solid var(--color-border)",
              background: preset === p.value ? "var(--color-brand)" : "var(--color-surface)",
              color: preset === p.value ? "var(--color-brand-contrast)" : "var(--color-text)",
            }}
          >
            {p.label}
          </a>
        ))}
      </div>
      <form method="get" style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 24 }}>
        <input type="hidden" name="period" value="custom" />
        <label>
          From <input type="date" name="start" defaultValue={preset === "custom" ? start : ""} />
        </label>
        <label>
          To <input type="date" name="end" defaultValue={preset === "custom" ? end : ""} />
        </label>
        <button type="submit">Custom range</button>
      </form>

      <p style={{ color: "var(--color-text-muted)" }}>
        Period figures below cover {start} to {end}. Cash, AR, and AP are as of today — balances, not
        period flows.
      </p>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
        <Tile label="Revenue" value={formatCurrency(netRevenue)} />
        <Tile label="COGS" value={formatCurrency(cogs)} />
        <Tile label="Gross Profit" value={formatCurrency(grossProfit)} />
        <Tile label="Operating Expenses" value={formatCurrency(opEx)} />
        <Tile label={netIncome >= 0 ? "Net Profit" : "Net Loss"} value={formatCurrency(Math.abs(netIncome))} />
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 32 }}>
        <Tile label="Cash Balance" value={formatCurrency(Number(cash_balance))} sub="as of today" />
        <Tile label="Accounts Receivable" value={formatCurrency(arTotal)} sub="as of today" />
        <Tile label="Accounts Payable" value={formatCurrency(apTotal)} sub="as of today" />
      </div>

      <h2>Profit / Loss Trend (last 6 months)</h2>
      <TrendChart data={trend} />

      <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginTop: 32 }}>
        <section style={{ flex: "1 1 320px" }}>
          <h2>
            Outstanding Invoices{" "}
            <a href="/reports/ar-aging" style={{ fontSize: "0.6em", fontWeight: "normal" }}>
              (view all)
            </a>
          </h2>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>
                <th>Invoice</th>
                <th>Customer</th>
                <th>Due</th>
                <th style={{ textAlign: "right" }}>Owed</th>
              </tr>
            </thead>
            <tbody>
              {openInvoices.slice(0, WIDGET_LIMIT).map((inv: any) => (
                <tr key={inv.id} style={{ borderBottom: "1px solid #eee" }}>
                  <td>
                    <a href={`/invoices/${inv.id}`}>{inv.invoice_number}</a>
                  </td>
                  <td>{inv.customer_name}</td>
                  <td>{new Date(inv.due_date).toLocaleDateString()}</td>
                  <td style={{ textAlign: "right" }}>{formatCurrency(inv.remaining)}</td>
                </tr>
              ))}
              {openInvoices.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ color: "var(--color-text-muted)" }}>
                    Nothing outstanding.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        <section style={{ flex: "1 1 320px" }}>
          <h2>
            Upcoming Bills{" "}
            <a href="/reports/ap-aging" style={{ fontSize: "0.6em", fontWeight: "normal" }}>
              (view all)
            </a>
          </h2>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>
                <th>Vendor</th>
                <th>Category</th>
                <th>Due</th>
                <th style={{ textAlign: "right" }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {unpaidExpenses.slice(0, WIDGET_LIMIT).map((e: any) => (
                <tr key={e.id} style={{ borderBottom: "1px solid #eee" }}>
                  <td>{e.vendor_name}</td>
                  <td>{e.category_name}</td>
                  <td>{new Date(e.due_date ?? e.expense_date).toLocaleDateString()}</td>
                  <td style={{ textAlign: "right" }}>{formatCurrency(Number(e.amount))}</td>
                </tr>
              ))}
              {unpaidExpenses.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ color: "var(--color-text-muted)" }}>
                    Nothing due.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </div>

      <h2 style={{ marginTop: 32 }}>Recent Transactions</h2>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>
            <th>Date</th>
            <th>Description</th>
            <th>Type</th>
            <th style={{ textAlign: "right" }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {recentEntries.map((entry: any) => (
            <tr key={entry.id} style={{ borderBottom: "1px solid #eee", opacity: entry.voided_at ? 0.5 : 1 }}>
              <td>{new Date(entry.entry_date).toLocaleDateString()}</td>
              <td>
                {entry.description}
                {entry.voided_at ? " (voided)" : ""}
              </td>
              <td>{entry.source_type}</td>
              <td style={{ textAlign: "right" }}>{formatCurrency(Number(entry.amount))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}

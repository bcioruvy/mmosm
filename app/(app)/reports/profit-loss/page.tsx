import { auth } from "@/auth";
import sql from "@/lib/db";
import { redirect } from "next/navigation";
import { PERMISSIONS } from "@/lib/permissions";
import { formatCurrency } from "@/lib/currency";
import { journalLinesInRange } from "@/lib/reports/journalFilters";
import { computeNetIncome } from "@/lib/reports/netIncome";
import { todayISO, startOfYearISO } from "@/lib/reports/dates";

export default async function ProfitLossPage({
  searchParams,
}: {
  searchParams: { start?: string; end?: string };
}) {
  const session = await auth();
  const permissions = session?.user?.permissions ?? [];
  if (!session?.user || !permissions.includes(PERMISSIONS.VIEW_REPORTS)) {
    redirect("/");
  }

  const start = searchParams.start || startOfYearISO();
  const end = searchParams.end || todayISO();

  const rows = await sql`
    SELECT a.id, a.code, a.name, a.type,
      COALESCE(SUM(f.debit), 0) AS total_debit,
      COALESCE(SUM(f.credit), 0) AS total_credit
    FROM accounts a
    JOIN (${journalLinesInRange(start, end)}) f ON f.account_id = a.id
    WHERE a.type IN ('revenue', 'cogs', 'expense')
    GROUP BY a.id, a.code, a.name, a.type
    ORDER BY a.code
  `;

  const revenueRows = rows
    .filter((r: any) => r.type === "revenue" && r.code !== "4900")
    .map((r: any) => ({ ...r, amount: Number(r.total_credit) - Number(r.total_debit) }));
  const cogsRows = rows
    .filter((r: any) => r.type === "cogs")
    .map((r: any) => ({ ...r, amount: Number(r.total_debit) - Number(r.total_credit) }));
  const expenseRows = rows
    .filter((r: any) => r.type === "expense")
    .map((r: any) => ({ ...r, amount: Number(r.total_debit) - Number(r.total_credit) }));

  const { grossSales, returns, netRevenue, cogs, grossProfit, expenses, netIncome } = computeNetIncome(rows as any);

  return (
    <main style={{ maxWidth: 700, margin: "40px auto", padding: 24 }}>
      <p>
        <a href="/reports">&larr; Reports</a>
      </p>
      <h1>Profit &amp; Loss</h1>
      <form method="get" style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16 }}>
        <label>
          From <input type="date" name="start" defaultValue={start} />
        </label>
        <label>
          To <input type="date" name="end" defaultValue={end} />
        </label>
        <button type="submit">Update</button>
      </form>

      <h2>Revenue</h2>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <tbody>
          {revenueRows.map((r: any) => (
            <tr key={r.id}>
              <td>
                {r.code} — {r.name}
              </td>
              <td style={{ textAlign: "right" }}>{formatCurrency(r.amount)}</td>
            </tr>
          ))}
          <tr style={{ fontWeight: "bold", borderTop: "1px solid #ccc" }}>
            <td>Sales Revenue</td>
            <td style={{ textAlign: "right" }}>{formatCurrency(grossSales)}</td>
          </tr>
          <tr>
            <td>Less: Sales Returns &amp; Allowances</td>
            <td style={{ textAlign: "right" }}>({formatCurrency(returns)})</td>
          </tr>
          <tr style={{ fontWeight: "bold", borderTop: "1px solid #333" }}>
            <td>Net Revenue</td>
            <td style={{ textAlign: "right" }}>{formatCurrency(netRevenue)}</td>
          </tr>
        </tbody>
      </table>

      <h2 style={{ marginTop: 24 }}>Cost of Goods Sold</h2>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <tbody>
          {cogsRows.map((r: any) => (
            <tr key={r.id}>
              <td>
                {r.code} — {r.name}
              </td>
              <td style={{ textAlign: "right" }}>{formatCurrency(r.amount)}</td>
            </tr>
          ))}
          <tr style={{ fontWeight: "bold", borderTop: "1px solid #333" }}>
            <td>Total COGS</td>
            <td style={{ textAlign: "right" }}>{formatCurrency(cogs)}</td>
          </tr>
        </tbody>
      </table>

      <p style={{ fontWeight: "bold", marginTop: 16 }}>Gross Profit: {formatCurrency(grossProfit)}</p>

      <h2 style={{ marginTop: 24 }}>Operating Expenses</h2>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <tbody>
          {expenseRows.map((r: any) => (
            <tr key={r.id}>
              <td>
                {r.code} — {r.name}
              </td>
              <td style={{ textAlign: "right" }}>{formatCurrency(r.amount)}</td>
            </tr>
          ))}
          <tr style={{ fontWeight: "bold", borderTop: "1px solid #333" }}>
            <td>Total Operating Expenses</td>
            <td style={{ textAlign: "right" }}>{formatCurrency(expenses)}</td>
          </tr>
        </tbody>
      </table>

      <p style={{ fontWeight: "bold", fontSize: "1.2em", marginTop: 16 }}>
        Net {netIncome >= 0 ? "Profit" : "Loss"}: {formatCurrency(Math.abs(netIncome))}
      </p>
    </main>
  );
}

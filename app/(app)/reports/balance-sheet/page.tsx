import { auth } from "@/auth";
import sql from "@/lib/db";
import { redirect } from "next/navigation";
import { PERMISSIONS } from "@/lib/permissions";
import { formatCurrency } from "@/lib/currency";
import { journalLinesThroughDate } from "@/lib/reports/journalFilters";
import { computeNetIncome } from "@/lib/reports/netIncome";
import { todayISO } from "@/lib/reports/dates";

export default async function BalanceSheetPage({
  searchParams,
}: {
  searchParams: { asOf?: string };
}) {
  const session = await auth();
  const permissions = session?.user?.permissions ?? [];
  if (!session?.user || !permissions.includes(PERMISSIONS.VIEW_REPORTS)) {
    redirect("/");
  }

  const asOf = searchParams.asOf || todayISO();

  const rows = await sql`
    SELECT a.id, a.code, a.name, a.type,
      COALESCE(SUM(f.debit), 0) AS total_debit,
      COALESCE(SUM(f.credit), 0) AS total_credit
    FROM accounts a
    LEFT JOIN (${journalLinesThroughDate(asOf)}) f ON f.account_id = a.id
    GROUP BY a.id, a.code, a.name, a.type
    ORDER BY a.code
  `;

  const assetRows = rows
    .filter((r: any) => r.type === "asset")
    .map((r: any) => ({ ...r, amount: Number(r.total_debit) - Number(r.total_credit) }));
  const liabilityRows = rows
    .filter((r: any) => r.type === "liability")
    .map((r: any) => ({ ...r, amount: Number(r.total_credit) - Number(r.total_debit) }));
  const equityRows = rows
    .filter((r: any) => r.type === "equity")
    .map((r: any) => ({ ...r, amount: Number(r.total_credit) - Number(r.total_debit) }));

  const { netIncome } = computeNetIncome(rows as any);

  const totalAssets = assetRows.reduce((s: number, r: any) => s + r.amount, 0);
  const totalLiabilities = liabilityRows.reduce((s: number, r: any) => s + r.amount, 0);
  const totalEquity = equityRows.reduce((s: number, r: any) => s + r.amount, 0) + netIncome;

  return (
    <main style={{ maxWidth: 700, margin: "40px auto", padding: 24 }}>
      <p>
        <a href="/reports">&larr; Reports</a>
      </p>
      <h1>Balance Sheet</h1>
      <form method="get" style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16 }}>
        <label>
          As of <input type="date" name="asOf" defaultValue={asOf} />
        </label>
        <button type="submit">Update</button>
      </form>

      <h2>Assets</h2>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <tbody>
          {assetRows.map((r: any) => (
            <tr key={r.id}>
              <td>
                {r.code} — {r.name}
              </td>
              <td style={{ textAlign: "right" }}>{formatCurrency(r.amount)}</td>
            </tr>
          ))}
          <tr style={{ fontWeight: "bold", borderTop: "1px solid #333" }}>
            <td>Total Assets</td>
            <td style={{ textAlign: "right" }}>{formatCurrency(totalAssets)}</td>
          </tr>
        </tbody>
      </table>

      <h2 style={{ marginTop: 24 }}>Liabilities</h2>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <tbody>
          {liabilityRows.map((r: any) => (
            <tr key={r.id}>
              <td>
                {r.code} — {r.name}
              </td>
              <td style={{ textAlign: "right" }}>{formatCurrency(r.amount)}</td>
            </tr>
          ))}
          <tr style={{ fontWeight: "bold", borderTop: "1px solid #333" }}>
            <td>Total Liabilities</td>
            <td style={{ textAlign: "right" }}>{formatCurrency(totalLiabilities)}</td>
          </tr>
        </tbody>
      </table>

      <h2 style={{ marginTop: 24 }}>Equity</h2>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <tbody>
          {equityRows.map((r: any) => (
            <tr key={r.id}>
              <td>
                {r.code} — {r.name}
              </td>
              <td style={{ textAlign: "right" }}>{formatCurrency(r.amount)}</td>
            </tr>
          ))}
          <tr>
            <td>Retained Earnings (Net Income to Date)</td>
            <td style={{ textAlign: "right" }}>{formatCurrency(netIncome)}</td>
          </tr>
          <tr style={{ fontWeight: "bold", borderTop: "1px solid #333" }}>
            <td>Total Equity</td>
            <td style={{ textAlign: "right" }}>{formatCurrency(totalEquity)}</td>
          </tr>
        </tbody>
      </table>

      <p style={{ fontWeight: "bold", marginTop: 16 }}>
        Total Liabilities + Equity: {formatCurrency(totalLiabilities + totalEquity)}
      </p>
      {Math.abs(totalAssets - (totalLiabilities + totalEquity)) > 0.01 && (
        <p style={{ color: "#b00020" }}>Warning: Assets does not equal Liabilities + Equity — this should never happen.</p>
      )}
    </main>
  );
}

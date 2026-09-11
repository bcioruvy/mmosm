import { auth } from "@/auth";
import sql from "@/lib/db";
import { redirect } from "next/navigation";
import { PERMISSIONS } from "@/lib/permissions";
import { formatCurrency } from "@/lib/currency";
import { journalLinesThroughDate } from "@/lib/reports/journalFilters";
import { todayISO } from "@/lib/reports/dates";

export default async function TrialBalancePage({
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

  let totalDebit = 0;
  let totalCredit = 0;
  const lines = rows.map((r: any) => {
    const net = Number(r.total_debit) - Number(r.total_credit);
    const debitBalance = net > 0 ? net : 0;
    const creditBalance = net < 0 ? -net : 0;
    totalDebit += debitBalance;
    totalCredit += creditBalance;
    return { ...r, debitBalance, creditBalance };
  });

  return (
    <main style={{ maxWidth: 800, margin: "40px 0", padding: 24 }}>
      <p>
        <a href="/reports">&larr; Reports</a>
      </p>
      <h1>Trial Balance</h1>
      <form method="get" style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16 }}>
        <label>
          As of <input type="date" name="asOf" defaultValue={asOf} />
        </label>
        <button type="submit">Update</button>
      </form>

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>
            <th>Code</th>
            <th>Name</th>
            <th>Type</th>
            <th style={{ textAlign: "right" }}>Debit</th>
            <th style={{ textAlign: "right" }}>Credit</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l: any) => (
            <tr key={l.id} style={{ borderBottom: "1px solid #eee" }}>
              <td>{l.code}</td>
              <td>{l.name}</td>
              <td>{l.type}</td>
              <td style={{ textAlign: "right" }}>{l.debitBalance ? formatCurrency(l.debitBalance) : ""}</td>
              <td style={{ textAlign: "right" }}>{l.creditBalance ? formatCurrency(l.creditBalance) : ""}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ borderTop: "2px solid #333", fontWeight: "bold" }}>
            <td colSpan={3}>Total</td>
            <td style={{ textAlign: "right" }}>{formatCurrency(totalDebit)}</td>
            <td style={{ textAlign: "right" }}>{formatCurrency(totalCredit)}</td>
          </tr>
        </tfoot>
      </table>
      {Math.abs(totalDebit - totalCredit) > 0.01 && (
        <p style={{ color: "#b00020" }}>Warning: totals do not match — this should never happen.</p>
      )}
    </main>
  );
}

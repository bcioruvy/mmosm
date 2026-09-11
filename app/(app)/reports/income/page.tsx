import { Fragment } from "react";
import { auth } from "@/auth";
import sql from "@/lib/db";
import { redirect } from "next/navigation";
import { PERMISSIONS } from "@/lib/permissions";
import { formatCurrency } from "@/lib/currency";
import { todayISO, startOfYearISO } from "@/lib/reports/dates";
import { groupBy } from "@/lib/reports/groupBy";

export default async function IncomeReportPage({
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
    SELECT i.id, i.income_date, i.amount, i.source, i.notes,
      cat.code AS category_code, cat.name AS category_name
    FROM income i
    JOIN accounts cat ON cat.id = i.category_account_id
    WHERE i.income_date BETWEEN ${start} AND ${end} AND i.voided_at IS NULL
    ORDER BY cat.code, i.income_date
  `;

  const byCategory = groupBy(rows, (r: any) => `${r.category_code} — ${r.category_name}`);
  let grandTotal = 0;

  return (
    <main style={{ maxWidth: 900, margin: "40px auto", padding: 24 }}>
      <p>
        <a href="/reports">&larr; Reports</a>
      </p>
      <h1>Income Report</h1>
      <form method="get" style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16 }}>
        <label>
          From <input type="date" name="start" defaultValue={start} />
        </label>
        <label>
          To <input type="date" name="end" defaultValue={end} />
        </label>
        <button type="submit">Update</button>
      </form>

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>
            <th>Date</th>
            <th>Source</th>
            <th>Notes</th>
            <th style={{ textAlign: "right" }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {[...byCategory.entries()].map(([categoryLabel, list]) => {
            const subtotal = list.reduce((s: number, r: any) => s + Number(r.amount), 0);
            grandTotal += subtotal;
            return (
              <Fragment key={categoryLabel}>
                <tr style={{ background: "#f5f5f5" }}>
                  <td colSpan={4} style={{ fontWeight: "bold", paddingTop: 12 }}>
                    {categoryLabel}
                  </td>
                </tr>
                {list.map((r: any) => (
                  <tr key={r.id} style={{ borderBottom: "1px solid #eee" }}>
                    <td>{new Date(r.income_date).toLocaleDateString()}</td>
                    <td>{r.source ?? ""}</td>
                    <td>{r.notes ?? ""}</td>
                    <td style={{ textAlign: "right" }}>{formatCurrency(Number(r.amount))}</td>
                  </tr>
                ))}
                <tr style={{ fontWeight: "bold", borderTop: "1px solid #ccc" }}>
                  <td colSpan={3}>Subtotal</td>
                  <td style={{ textAlign: "right" }}>{formatCurrency(subtotal)}</td>
                </tr>
              </Fragment>
            );
          })}
        </tbody>
        <tfoot>
          <tr style={{ fontWeight: "bold", borderTop: "2px solid #333" }}>
            <td colSpan={3}>Grand total</td>
            <td style={{ textAlign: "right" }}>{formatCurrency(grandTotal)}</td>
          </tr>
        </tfoot>
      </table>
    </main>
  );
}

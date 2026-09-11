import { Fragment } from "react";
import { auth } from "@/auth";
import sql from "@/lib/db";
import { redirect } from "next/navigation";
import { PERMISSIONS } from "@/lib/permissions";
import { formatCurrency } from "@/lib/currency";
import { todayISO, startOfYearISO } from "@/lib/reports/dates";
import { groupBy } from "@/lib/reports/groupBy";

export default async function ExpenseReportPage({
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
    SELECT e.id, e.expense_date, e.amount, e.notes, e.payment_status,
      cat.code AS category_code, cat.name AS category_name,
      COALESCE(v.name, '—') AS vendor_name
    FROM expenses e
    JOIN accounts cat ON cat.id = e.category_account_id
    LEFT JOIN vendors v ON v.id = e.vendor_id
    WHERE e.expense_date BETWEEN ${start} AND ${end}
    ORDER BY cat.code, e.expense_date
  `;

  const byCategory = groupBy(rows, (r: any) => `${r.category_code} — ${r.category_name}`);
  let grandTotal = 0;

  return (
    <main style={{ maxWidth: 900, margin: "40px auto", padding: 24 }}>
      <p>
        <a href="/reports">&larr; Reports</a>
      </p>
      <h1>Expense Report</h1>
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
            <th>Vendor</th>
            <th>Status</th>
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
                  <td colSpan={5} style={{ fontWeight: "bold", paddingTop: 12 }}>
                    {categoryLabel}
                  </td>
                </tr>
                {list.map((r: any) => (
                  <tr key={r.id} style={{ borderBottom: "1px solid #eee" }}>
                    <td>{new Date(r.expense_date).toLocaleDateString()}</td>
                    <td>{r.vendor_name}</td>
                    <td>{r.payment_status}</td>
                    <td>{r.notes ?? ""}</td>
                    <td style={{ textAlign: "right" }}>{formatCurrency(Number(r.amount))}</td>
                  </tr>
                ))}
                <tr style={{ fontWeight: "bold", borderTop: "1px solid #ccc" }}>
                  <td colSpan={4}>Subtotal</td>
                  <td style={{ textAlign: "right" }}>{formatCurrency(subtotal)}</td>
                </tr>
              </Fragment>
            );
          })}
        </tbody>
        <tfoot>
          <tr style={{ fontWeight: "bold", borderTop: "2px solid #333" }}>
            <td colSpan={4}>Grand total</td>
            <td style={{ textAlign: "right" }}>{formatCurrency(grandTotal)}</td>
          </tr>
        </tfoot>
      </table>
    </main>
  );
}

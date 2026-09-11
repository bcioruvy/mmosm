import { Fragment } from "react";
import { auth } from "@/auth";
import sql from "@/lib/db";
import { redirect } from "next/navigation";
import { PERMISSIONS } from "@/lib/permissions";
import { formatCurrency } from "@/lib/currency";
import { todayISO, startOfYearISO } from "@/lib/reports/dates";
import { groupBy } from "@/lib/reports/groupBy";

export default async function SalesReportPage({
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
    SELECT i.id, i.invoice_number, i.invoice_date, i.status, c.name AS customer_name,
      COALESCE(l.total, 0) AS total
    FROM invoices i
    JOIN customers c ON c.id = i.customer_id
    LEFT JOIN (SELECT invoice_id, SUM(line_total) AS total FROM invoice_lines GROUP BY invoice_id) l ON l.invoice_id = i.id
    WHERE i.status != 'draft' AND i.invoice_date BETWEEN ${start} AND ${end}
    ORDER BY c.name, i.invoice_date
  `;

  const byCustomer = groupBy(rows, (r: any) => r.customer_name as string);
  let grandTotal = 0;

  return (
    <main style={{ maxWidth: 900, margin: "40px auto", padding: 24 }}>
      <p>
        <a href="/reports">&larr; Reports</a>
      </p>
      <h1>Sales Report</h1>
      <p>Gross of any credit notes — see Profit &amp; Loss or Credit Notes for returns.</p>
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
            <th>Invoice</th>
            <th>Date</th>
            <th>Status</th>
            <th style={{ textAlign: "right" }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {[...byCustomer.entries()].map(([customerName, list]) => {
            const subtotal = list.reduce((s: number, r: any) => s + Number(r.total), 0);
            grandTotal += subtotal;
            return (
              <Fragment key={customerName}>
                <tr style={{ background: "#f5f5f5" }}>
                  <td colSpan={4} style={{ fontWeight: "bold", paddingTop: 12 }}>
                    {customerName}
                  </td>
                </tr>
                {list.map((r: any) => (
                  <tr key={r.id} style={{ borderBottom: "1px solid #eee" }}>
                    <td>
                      <a href={`/invoices/${r.id}`}>{r.invoice_number}</a>
                    </td>
                    <td>{new Date(r.invoice_date).toLocaleDateString()}</td>
                    <td>{r.status}</td>
                    <td style={{ textAlign: "right" }}>{formatCurrency(Number(r.total))}</td>
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

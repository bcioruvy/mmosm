import { Fragment } from "react";
import { auth } from "@/auth";
import sql from "@/lib/db";
import { redirect } from "next/navigation";
import { PERMISSIONS } from "@/lib/permissions";
import { formatCurrency } from "@/lib/currency";
import { getInvoiceBalance } from "@/lib/invoiceBalance";
import { todayISO } from "@/lib/reports/dates";
import { agingBucket, AGING_BUCKETS, daysBetween, toISODate } from "@/lib/reports/aging";
import { groupBy } from "@/lib/reports/groupBy";

export default async function ARAgingPage({
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

  const openInvoices = await sql`
    SELECT i.id, i.invoice_number, i.due_date, c.name AS customer_name
    FROM invoices i JOIN customers c ON c.id = i.customer_id
    WHERE i.status IN ('sent', 'partial')
    ORDER BY c.name, i.due_date
  `;

  const withBalances = await Promise.all(
    openInvoices.map(async (inv: any) => {
      const balance = await getInvoiceBalance(inv.id);
      const daysOverdue = daysBetween(toISODate(inv.due_date), asOf);
      return { ...inv, remaining: balance.remainingOwed, bucket: agingBucket(daysOverdue) };
    })
  );
  const invoices = withBalances.filter((inv: any) => inv.remaining > 0.001);

  const byCustomer = groupBy(invoices, (inv: any) => inv.customer_name as string);
  const grandTotals: Record<string, number> = { current: 0, "1-30": 0, "31-60": 0, "61-90": 0, "90+": 0 };

  return (
    <main style={{ maxWidth: 1000, margin: "40px 0", padding: 24 }}>
      <p>
        <a href="/reports">&larr; Reports</a>
      </p>
      <h1>AR Aging</h1>
      <form method="get" style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16 }}>
        <label>
          As of <input type="date" name="asOf" defaultValue={asOf} />
        </label>
        <button type="submit">Update</button>
      </form>

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>
            <th>Invoice</th>
            <th>Due date</th>
            {AGING_BUCKETS.map((b) => (
              <th key={b} style={{ textAlign: "right" }}>
                {b}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[...byCustomer.entries()].map(([customerName, list]) => {
            const subtotals: Record<string, number> = { current: 0, "1-30": 0, "31-60": 0, "61-90": 0, "90+": 0 };
            for (const inv of list) {
              subtotals[inv.bucket] += inv.remaining;
              grandTotals[inv.bucket] += inv.remaining;
            }
            return (
              <Fragment key={customerName}>
                <tr style={{ background: "#f5f5f5" }}>
                  <td colSpan={2 + AGING_BUCKETS.length} style={{ fontWeight: "bold", paddingTop: 12 }}>
                    {customerName}
                  </td>
                </tr>
                {list.map((inv: any) => (
                  <tr key={inv.id} style={{ borderBottom: "1px solid #eee" }}>
                    <td>
                      <a href={`/invoices/${inv.id}`}>{inv.invoice_number}</a>
                    </td>
                    <td>{new Date(inv.due_date).toLocaleDateString()}</td>
                    {AGING_BUCKETS.map((b) => (
                      <td key={b} style={{ textAlign: "right" }}>
                        {inv.bucket === b ? formatCurrency(inv.remaining) : ""}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr style={{ fontWeight: "bold", borderTop: "1px solid #ccc" }}>
                  <td colSpan={2}>Subtotal</td>
                  {AGING_BUCKETS.map((b) => (
                    <td key={b} style={{ textAlign: "right" }}>
                      {subtotals[b] ? formatCurrency(subtotals[b]) : ""}
                    </td>
                  ))}
                </tr>
              </Fragment>
            );
          })}
        </tbody>
        <tfoot>
          <tr style={{ fontWeight: "bold", borderTop: "2px solid #333" }}>
            <td colSpan={2}>Grand total</td>
            {AGING_BUCKETS.map((b) => (
              <td key={b} style={{ textAlign: "right" }}>
                {grandTotals[b] ? formatCurrency(grandTotals[b]) : ""}
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
    </main>
  );
}

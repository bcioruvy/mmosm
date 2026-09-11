import { Fragment } from "react";
import { auth } from "@/auth";
import sql from "@/lib/db";
import { redirect } from "next/navigation";
import { PERMISSIONS } from "@/lib/permissions";
import { formatCurrency } from "@/lib/currency";
import { todayISO } from "@/lib/reports/dates";
import { agingBucket, AGING_BUCKETS, daysBetween, toISODate } from "@/lib/reports/aging";
import { groupBy } from "@/lib/reports/groupBy";

export default async function APAgingPage({
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

  const unpaidExpenses = await sql`
    SELECT e.id, e.amount, e.due_date, e.expense_date, cat.code AS category_code, cat.name AS category_name,
      COALESCE(v.name, 'No vendor') AS vendor_name
    FROM expenses e
    JOIN accounts cat ON cat.id = e.category_account_id
    LEFT JOIN vendors v ON v.id = e.vendor_id
    WHERE e.payment_status = 'unpaid'
    ORDER BY COALESCE(v.name, ''), e.due_date
  `;

  const expenses = unpaidExpenses.map((e: any) => {
    const referenceDate = e.due_date ? toISODate(e.due_date) : toISODate(e.expense_date);
    const daysOverdue = daysBetween(referenceDate, asOf);
    return { ...e, remaining: Number(e.amount), bucket: agingBucket(daysOverdue), referenceDate };
  });

  const byVendor = groupBy(expenses, (e: any) => e.vendor_name as string);
  const grandTotals: Record<string, number> = { current: 0, "1-30": 0, "31-60": 0, "61-90": 0, "90+": 0 };

  return (
    <main style={{ maxWidth: 1000, margin: "40px auto", padding: 24 }}>
      <p>
        <a href="/reports">&larr; Reports</a>
      </p>
      <h1>AP Aging</h1>
      <p>Bills without a due date are aged by expense date instead.</p>
      <form method="get" style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16 }}>
        <label>
          As of <input type="date" name="asOf" defaultValue={asOf} />
        </label>
        <button type="submit">Update</button>
      </form>

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>
            <th>Category</th>
            <th>Due / expense date</th>
            {AGING_BUCKETS.map((b) => (
              <th key={b} style={{ textAlign: "right" }}>
                {b}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[...byVendor.entries()].map(([vendorName, list]) => {
            const subtotals: Record<string, number> = { current: 0, "1-30": 0, "31-60": 0, "61-90": 0, "90+": 0 };
            for (const e of list) {
              subtotals[e.bucket] += e.remaining;
              grandTotals[e.bucket] += e.remaining;
            }
            return (
              <Fragment key={vendorName}>
                <tr style={{ background: "#f5f5f5" }}>
                  <td colSpan={2 + AGING_BUCKETS.length} style={{ fontWeight: "bold", paddingTop: 12 }}>
                    {vendorName}
                  </td>
                </tr>
                {list.map((e: any) => (
                  <tr key={e.id} style={{ borderBottom: "1px solid #eee" }}>
                    <td>
                      {e.category_code} — {e.category_name}
                    </td>
                    <td>{new Date(e.referenceDate).toLocaleDateString()}</td>
                    {AGING_BUCKETS.map((b) => (
                      <td key={b} style={{ textAlign: "right" }}>
                        {e.bucket === b ? formatCurrency(e.remaining) : ""}
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

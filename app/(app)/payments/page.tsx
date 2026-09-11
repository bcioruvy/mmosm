import { auth } from "@/auth";
import sql from "@/lib/db";
import { redirect } from "next/navigation";
import { PERMISSIONS } from "@/lib/permissions";
import { formatCurrency } from "@/lib/currency";
import { voidPayment } from "./actions";

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: { error?: string; success?: string };
}) {
  const session = await auth();
  const permissions = session?.user?.permissions ?? [];
  if (!session?.user || !permissions.includes(PERMISSIONS.MANAGE_TRANSACTIONS)) {
    redirect("/");
  }
  const canVoid = permissions.includes(PERMISSIONS.VOID_TRANSACTIONS);

  const payments = await sql`
    SELECT p.id, p.direction, p.payment_date, p.amount, p.notes, p.voided_at,
      acc.code AS account_code, acc.name AS account_name,
      p.applied_to_type,
      inv.invoice_number,
      cust.name AS customer_name,
      cat.name AS expense_category_name
    FROM payments p
    JOIN accounts acc ON acc.id = p.account_id
    LEFT JOIN invoices inv ON p.applied_to_type = 'invoice' AND inv.id = p.applied_to_id
    LEFT JOIN customers cust ON cust.id = inv.customer_id
    LEFT JOIN expenses exp ON p.applied_to_type = 'expense' AND exp.id = p.applied_to_id
    LEFT JOIN accounts cat ON cat.id = exp.category_account_id
    ORDER BY p.payment_date DESC, p.id DESC
  `;

  return (
    <main style={{ maxWidth: 1100, margin: "40px auto", padding: 24 }}>
      <p>
        <a href="/">&larr; Home</a>
      </p>
      <h1>Payments</h1>
      {searchParams.error && <p style={{ color: "#b00020" }}>{searchParams.error}</p>}
      {searchParams.success && <p style={{ color: "#1b7a3d" }}>Done.</p>}
      <p>
        Record a payment from an unpaid expense's row on <a href="/expenses">Expenses</a>, or from an
        open invoice's detail page.
      </p>

      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 16 }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>
            <th>Date</th>
            <th>Direction</th>
            <th>Applied to</th>
            <th>Account</th>
            <th>Amount</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {payments.map((p: any) => (
            <tr key={p.id} style={{ borderBottom: "1px solid #eee", opacity: p.voided_at ? 0.5 : 1 }}>
              <td>{new Date(p.payment_date).toLocaleDateString()}</td>
              <td>{p.direction === "in" ? "In" : "Out"}</td>
              <td>
                {p.applied_to_type === "invoice"
                  ? `Invoice ${p.invoice_number} — ${p.customer_name}`
                  : `Expense — ${p.expense_category_name}`}
              </td>
              <td>
                {p.account_code} — {p.account_name}
              </td>
              <td>{formatCurrency(Number(p.amount))}</td>
              <td>{p.voided_at ? "Voided" : "Active"}</td>
              <td>
                {!p.voided_at && canVoid && (
                  <form action={voidPayment} style={{ display: "flex", gap: 4 }}>
                    <input type="hidden" name="paymentId" value={p.id} />
                    <input name="reason" placeholder="Reason (optional)" style={{ width: 110 }} />
                    <button type="submit">Void</button>
                  </form>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}

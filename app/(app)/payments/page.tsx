import { auth } from "@/auth";
import sql from "@/lib/db";
import { redirect } from "next/navigation";
import { PERMISSIONS } from "@/lib/permissions";
import { formatCurrency } from "@/lib/currency";

export default async function PaymentsPage() {
  const session = await auth();
  const permissions = session?.user?.permissions ?? [];
  if (!session?.user || !permissions.includes(PERMISSIONS.MANAGE_TRANSACTIONS)) {
    redirect("/");
  }

  const payments = await sql`
    SELECT p.id, p.direction, p.payment_date, p.amount, p.notes,
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
    <main style={{ maxWidth: 1000, margin: "40px auto", padding: 24 }}>
      <p>
        <a href="/">&larr; Home</a>
      </p>
      <h1>Payments</h1>
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
          </tr>
        </thead>
        <tbody>
          {payments.map((p: any) => (
            <tr key={p.id} style={{ borderBottom: "1px solid #eee" }}>
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
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}

import { auth } from "@/auth";
import sql from "@/lib/db";
import { redirect } from "next/navigation";
import { PERMISSIONS } from "@/lib/permissions";
import { formatCurrency } from "@/lib/currency";

export default async function CreditNotesPage() {
  const session = await auth();
  const permissions = session?.user?.permissions ?? [];
  if (!session?.user || !permissions.includes(PERMISSIONS.MANAGE_TRANSACTIONS)) {
    redirect("/");
  }

  const creditNotes = await sql`
    SELECT cn.id, cn.credit_note_number, cn.credit_date, cn.amount, cn.reason,
      inv.id AS invoice_id, inv.invoice_number, c.name AS customer_name,
      ra.code AS refund_account_code, ra.name AS refund_account_name
    FROM credit_notes cn
    JOIN invoices inv ON inv.id = cn.invoice_id
    JOIN customers c ON c.id = inv.customer_id
    LEFT JOIN accounts ra ON ra.id = cn.refund_account_id
    ORDER BY cn.credit_date DESC, cn.id DESC
  `;

  return (
    <main style={{ maxWidth: 1000, margin: "40px auto", padding: 24 }}>
      <p>
        <a href="/">&larr; Home</a>
      </p>
      <h1>Credit notes</h1>
      <p>
        Issue a credit note from an eligible invoice's detail page under <a href="/invoices">Invoices</a>.
      </p>

      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 16 }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>
            <th>Number</th>
            <th>Date</th>
            <th>Invoice</th>
            <th>Customer</th>
            <th>Amount</th>
            <th>Type</th>
            <th>Reason</th>
          </tr>
        </thead>
        <tbody>
          {creditNotes.map((cn: any) => (
            <tr key={cn.id} style={{ borderBottom: "1px solid #eee" }}>
              <td>{cn.credit_note_number}</td>
              <td>{new Date(cn.credit_date).toLocaleDateString()}</td>
              <td>
                <a href={`/invoices/${cn.invoice_id}`}>{cn.invoice_number}</a>
              </td>
              <td>{cn.customer_name}</td>
              <td>{formatCurrency(Number(cn.amount))}</td>
              <td>
                {cn.refund_account_code
                  ? `Cash refund (${cn.refund_account_code} — ${cn.refund_account_name})`
                  : "Applied to balance owed"}
              </td>
              <td>{cn.reason ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}

import { auth } from "@/auth";
import sql from "@/lib/db";
import { redirect } from "next/navigation";
import { PERMISSIONS } from "@/lib/permissions";
import { createInvoice } from "./actions";
import InvoiceLineEditor from "./InvoiceLineEditor";

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: { error?: string; success?: string };
}) {
  const session = await auth();
  const permissions = session?.user?.permissions ?? [];
  if (!session?.user || !permissions.includes(PERMISSIONS.MANAGE_TRANSACTIONS)) {
    redirect("/");
  }

  const [invoices, customers, revenueAccounts] = await Promise.all([
    sql`
      SELECT i.id, i.invoice_number, i.invoice_date, i.due_date, i.status, c.name AS customer_name,
        COALESCE((SELECT SUM(line_total) FROM invoice_lines WHERE invoice_id = i.id), 0) AS total
      FROM invoices i JOIN customers c ON c.id = i.customer_id
      ORDER BY i.invoice_date DESC, i.id DESC
    `,
    sql`SELECT id, name FROM customers WHERE is_active = true ORDER BY name`,
    sql`SELECT id, code, name FROM accounts WHERE is_active = true AND type = 'revenue' ORDER BY code`,
  ]);

  return (
    <main style={{ maxWidth: 1000, margin: "40px auto", padding: 24 }}>
      <p>
        <a href="/">&larr; Home</a>
      </p>
      <h1>Invoices</h1>
      {searchParams.error && <p style={{ color: "#b00020" }}>{searchParams.error}</p>}
      {searchParams.success && <p style={{ color: "#1b7a3d" }}>Done.</p>}

      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 16 }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>
            <th>Number</th>
            <th>Customer</th>
            <th>Date</th>
            <th>Due</th>
            <th>Status</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((inv: any) => (
            <tr key={inv.id} style={{ borderBottom: "1px solid #eee" }}>
              <td>
                <a href={`/invoices/${inv.id}`}>{inv.invoice_number}</a>
              </td>
              <td>{inv.customer_name}</td>
              <td>{new Date(inv.invoice_date).toLocaleDateString()}</td>
              <td>{new Date(inv.due_date).toLocaleDateString()}</td>
              <td>{inv.status}</td>
              <td>${Number(inv.total).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 style={{ marginTop: 32 }}>New invoice</h2>
      <form action={createInvoice} style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 700 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <select name="customerId" required defaultValue="">
            <option value="" disabled>
              Customer…
            </option>
            {customers.map((c: any) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <label>
            Invoice date <input name="invoiceDate" type="date" required />
          </label>
          <label>
            Due date <input name="dueDate" type="date" required />
          </label>
          <select name="revenueAccountId" required defaultValue="">
            <option value="" disabled>
              Revenue account…
            </option>
            {revenueAccounts.map((a: any) => (
              <option key={a.id} value={a.id}>
                {a.code} — {a.name}
              </option>
            ))}
          </select>
        </div>

        <InvoiceLineEditor />

        <input name="notes" placeholder="Notes" />
        <button type="submit" style={{ alignSelf: "flex-start" }}>
          Save as draft
        </button>
      </form>
    </main>
  );
}

import { auth } from "@/auth";
import sql from "@/lib/db";
import { redirect, notFound } from "next/navigation";
import { PERMISSIONS } from "@/lib/permissions";
import { sendInvoice, deleteInvoiceDraft } from "../actions";

export default async function InvoiceDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { error?: string; success?: string };
}) {
  const session = await auth();
  const permissions = session?.user?.permissions ?? [];
  if (!session?.user || !permissions.includes(PERMISSIONS.MANAGE_TRANSACTIONS)) {
    redirect("/");
  }

  const [invoice] = await sql`
    SELECT i.id, i.invoice_number, i.invoice_date, i.due_date, i.status, i.notes,
      c.name AS customer_name, cat.code AS revenue_code, cat.name AS revenue_name
    FROM invoices i
    JOIN customers c ON c.id = i.customer_id
    JOIN accounts cat ON cat.id = i.revenue_account_id
    WHERE i.id = ${params.id}
  `;
  if (!invoice) notFound();

  const lines = await sql`
    SELECT description, quantity, unit_price, discount_percent, line_total
    FROM invoice_lines WHERE invoice_id = ${params.id} ORDER BY id
  `;
  const total = lines.reduce((sum: number, l: any) => sum + Number(l.line_total), 0);

  return (
    <main style={{ maxWidth: 800, margin: "40px auto", padding: 24 }}>
      <p>
        <a href="/invoices">&larr; Invoices</a>
      </p>
      <h1>
        {invoice.invoice_number} <small>({invoice.status})</small>
      </h1>
      {searchParams.error && <p style={{ color: "#b00020" }}>{searchParams.error}</p>}
      {searchParams.success && <p style={{ color: "#1b7a3d" }}>Done.</p>}

      <p>
        Customer: {invoice.customer_name}
        <br />
        Invoice date: {new Date(invoice.invoice_date).toLocaleDateString()}
        <br />
        Due date: {new Date(invoice.due_date).toLocaleDateString()}
        <br />
        Revenue account: {invoice.revenue_code} — {invoice.revenue_name}
        {invoice.notes && (
          <>
            <br />
            Notes: {invoice.notes}
          </>
        )}
      </p>

      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 16 }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>
            <th>Description</th>
            <th>Qty</th>
            <th>Unit price</th>
            <th>Discount</th>
            <th>Line total</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l: any, i: number) => (
            <tr key={i} style={{ borderBottom: "1px solid #eee" }}>
              <td>{l.description}</td>
              <td>{Number(l.quantity)}</td>
              <td>${Number(l.unit_price).toFixed(2)}</td>
              <td>{Number(l.discount_percent)}%</td>
              <td>${Number(l.line_total).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        <strong>Total: ${total.toFixed(2)}</strong>
      </p>

      {invoice.status === "draft" && (
        <div style={{ display: "flex", gap: 8 }}>
          <form action={sendInvoice}>
            <input type="hidden" name="id" value={invoice.id} />
            <button type="submit">Send (posts to ledger)</button>
          </form>
          <form action={deleteInvoiceDraft}>
            <input type="hidden" name="id" value={invoice.id} />
            <button type="submit">Delete draft</button>
          </form>
        </div>
      )}
    </main>
  );
}

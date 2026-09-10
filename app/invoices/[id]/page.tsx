import { auth } from "@/auth";
import sql from "@/lib/db";
import { redirect, notFound } from "next/navigation";
import { PERMISSIONS } from "@/lib/permissions";
import { formatCurrency } from "@/lib/currency";
import { getCashOrBankAccounts } from "@/lib/controlAccounts";
import { sendInvoice, deleteInvoiceDraft } from "../actions";
import { recordInvoicePayment } from "../../payments/actions";

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

  const payments = await sql`
    SELECT p.id, p.payment_date, p.amount, acc.code AS account_code, acc.name AS account_name
    FROM payments p JOIN accounts acc ON acc.id = p.account_id
    WHERE p.applied_to_type = 'invoice' AND p.applied_to_id = ${params.id}
    ORDER BY p.payment_date DESC, p.id DESC
  `;
  const paid = payments.reduce((sum: number, p: any) => sum + Number(p.amount), 0);
  const remaining = Math.round((total - paid) * 100) / 100;

  const cashAccounts = invoice.status === "sent" || invoice.status === "partial" ? await getCashOrBankAccounts() : [];

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
              <td>{formatCurrency(Number(l.unit_price))}</td>
              <td>{Number(l.discount_percent)}%</td>
              <td>{formatCurrency(Number(l.line_total))}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        <strong>Total: {formatCurrency(total)}</strong>
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

      {(invoice.status === "sent" || invoice.status === "partial" || invoice.status === "paid") && (
        <>
          <h2 style={{ marginTop: 32 }}>Payments</h2>
          <p>
            Paid: {formatCurrency(paid)} — Remaining: {formatCurrency(remaining)}
          </p>
          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 16 }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>
                <th>Date</th>
                <th>Account</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p: any) => (
                <tr key={p.id} style={{ borderBottom: "1px solid #eee" }}>
                  <td>{new Date(p.payment_date).toLocaleDateString()}</td>
                  <td>
                    {p.account_code} — {p.account_name}
                  </td>
                  <td>{formatCurrency(Number(p.amount))}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {(invoice.status === "sent" || invoice.status === "partial") && (
            <>
              {cashAccounts.length === 0 && (
                <p style={{ color: "#b00020" }}>
                  No account is tagged "Cash or Bank" yet — tag one on{" "}
                  <a href="/accounts">Chart of Accounts</a> to record a payment.
                </p>
              )}
              {cashAccounts.length > 0 && (
                <form action={recordInvoicePayment} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <input type="hidden" name="invoiceId" value={invoice.id} />
                  <input name="paymentDate" type="date" required />
                  <select name="accountId" required defaultValue="">
                    <option value="" disabled>
                      Received into…
                    </option>
                    {cashAccounts.map((a: any) => (
                      <option key={a.id} value={a.id}>
                        {a.code} — {a.name}
                      </option>
                    ))}
                  </select>
                  <input name="amount" type="number" step="0.01" min="0.01" max={remaining} placeholder="Amount" required />
                  <button type="submit">Record payment</button>
                </form>
              )}
            </>
          )}
        </>
      )}
    </main>
  );
}

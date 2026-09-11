import { auth } from "@/auth";
import sql from "@/lib/db";
import { redirect, notFound } from "next/navigation";
import { PERMISSIONS } from "@/lib/permissions";
import { formatCurrency } from "@/lib/currency";
import { getCashOrBankAccounts } from "@/lib/controlAccounts";
import { getInvoiceBalance } from "@/lib/invoiceBalance";
import { sendInvoice, deleteInvoiceDraft, voidInvoice } from "../actions";
import { recordInvoicePayment, voidPayment } from "../../payments/actions";
import { issueCreditNote, voidCreditNote } from "../../credit-notes/actions";

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
  const canVoid = permissions.includes(PERMISSIONS.VOID_TRANSACTIONS);

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

  const isOpen = invoice.status === "sent" || invoice.status === "partial";
  const isPostedAtAll = isOpen || invoice.status === "paid";

  const [payments, creditNotes, balance, cashAccounts] = await Promise.all([
    sql`
      SELECT p.id, p.payment_date, p.amount, p.voided_at, acc.code AS account_code, acc.name AS account_name
      FROM payments p JOIN accounts acc ON acc.id = p.account_id
      WHERE p.applied_to_type = 'invoice' AND p.applied_to_id = ${params.id}
      ORDER BY p.payment_date DESC, p.id DESC
    `,
    sql`
      SELECT cn.id, cn.credit_note_number, cn.credit_date, cn.amount, cn.reason, cn.voided_at,
        ra.code AS refund_account_code, ra.name AS refund_account_name
      FROM credit_notes cn
      LEFT JOIN accounts ra ON ra.id = cn.refund_account_id
      WHERE cn.invoice_id = ${params.id}
      ORDER BY cn.credit_date DESC, cn.id DESC
    `,
    isPostedAtAll ? getInvoiceBalance(params.id) : Promise.resolve(null),
    isPostedAtAll ? getCashOrBankAccounts() : Promise.resolve([]),
  ]);

  const hasActiveChildren =
    payments.some((p: any) => !p.voided_at) || creditNotes.some((cn: any) => !cn.voided_at);
  const canVoidInvoice = canVoid && isPostedAtAll && !hasActiveChildren;

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

      {isPostedAtAll && balance && (
        <>
          <h2 style={{ marginTop: 32 }}>Payments</h2>
          <p>
            Paid: {formatCurrency(balance.paid)} — Credited to balance: {formatCurrency(balance.creditedToAR)} —
            Remaining owed: {formatCurrency(balance.remainingOwed)}
          </p>
          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 16 }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>
                <th>Date</th>
                <th>Account</th>
                <th>Amount</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p: any) => (
                <tr key={p.id} style={{ borderBottom: "1px solid #eee", opacity: p.voided_at ? 0.5 : 1 }}>
                  <td>{new Date(p.payment_date).toLocaleDateString()}</td>
                  <td>
                    {p.account_code} — {p.account_name}
                  </td>
                  <td>{formatCurrency(Number(p.amount))}</td>
                  <td>
                    {p.voided_at ? (
                      "Voided"
                    ) : (
                      canVoid && (
                        <form action={voidPayment} style={{ display: "flex", gap: 4 }}>
                          <input type="hidden" name="paymentId" value={p.id} />
                          <input name="reason" placeholder="Reason (optional)" style={{ width: 110 }} />
                          <button type="submit">Void</button>
                        </form>
                      )
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {isOpen && (
            <>
              {cashAccounts.length === 0 && (
                <p style={{ color: "#b00020" }}>
                  No account is tagged "Cash or Bank" yet — tag one on{" "}
                  <a href="/accounts">Chart of Accounts</a> to record a payment.
                </p>
              )}
              {cashAccounts.length > 0 && (
                <form
                  action={recordInvoicePayment}
                  style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}
                >
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
                  <input
                    name="amount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={balance.remainingOwed}
                    placeholder="Amount"
                    required
                  />
                  <button type="submit">Record payment</button>
                </form>
              )}
            </>
          )}

          <h2 style={{ marginTop: 32 }}>Credit notes</h2>
          {creditNotes.length > 0 && (
            <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 16 }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>
                  <th>Number</th>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>Type</th>
                  <th>Reason</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {creditNotes.map((cn: any) => (
                  <tr key={cn.id} style={{ borderBottom: "1px solid #eee", opacity: cn.voided_at ? 0.5 : 1 }}>
                    <td>{cn.credit_note_number}</td>
                    <td>{new Date(cn.credit_date).toLocaleDateString()}</td>
                    <td>{formatCurrency(Number(cn.amount))}</td>
                    <td>
                      {cn.refund_account_code
                        ? `Cash refund (${cn.refund_account_code} — ${cn.refund_account_name})`
                        : "Applied to balance owed"}
                    </td>
                    <td>{cn.reason ?? ""}</td>
                    <td>
                      {cn.voided_at ? (
                        "Voided"
                      ) : (
                        canVoid && (
                          <form action={voidCreditNote} style={{ display: "flex", gap: 4 }}>
                            <input type="hidden" name="creditNoteId" value={cn.id} />
                            <input name="reason" placeholder="Reason (optional)" style={{ width: 110 }} />
                            <button type="submit">Void</button>
                          </form>
                        )
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {(balance.remainingOwed > 0.001 || balance.refundableCash > 0.001) && (
            <form action={issueCreditNote} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <input type="hidden" name="invoiceId" value={invoice.id} />
              <input name="creditDate" type="date" required />
              <input name="amount" type="number" step="0.01" min="0.01" placeholder="Amount" required />
              <select name="mode" required defaultValue="">
                <option value="" disabled>
                  Type…
                </option>
                {balance.remainingOwed > 0.001 && <option value="apply_to_balance">Apply to balance owed</option>}
                {balance.refundableCash > 0.001 && <option value="refund_cash">Refund via cash/bank</option>}
              </select>
              <select name="refundAccountId" defaultValue="">
                <option value="">(only for cash refund)</option>
                {cashAccounts.map((a: any) => (
                  <option key={a.id} value={a.id}>
                    {a.code} — {a.name}
                  </option>
                ))}
              </select>
              <input name="reason" placeholder="Reason" />
              <button type="submit">Issue credit note</button>
            </form>
          )}

          {canVoidInvoice && (
            <form action={voidInvoice} style={{ display: "flex", gap: 8, marginTop: 32 }}>
              <input type="hidden" name="id" value={invoice.id} />
              <input name="reason" placeholder="Reason (optional)" />
              <button type="submit">Void invoice</button>
            </form>
          )}
          {canVoid && isPostedAtAll && hasActiveChildren && (
            <p style={{ color: "var(--color-text-muted)", marginTop: 16 }}>
              This invoice can't be voided while it has active payments or credit notes — void those first.
            </p>
          )}
        </>
      )}
    </main>
  );
}

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
import { FileText, Send, Trash2, Ban, CreditCard, Undo2 } from "lucide-react";

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-brand-tint text-muted",
  sent: "bg-brand-tint text-brand",
  partial: "bg-brand-tint text-brand",
  paid: "bg-brand-tint text-success",
  void: "bg-brand-tint text-error",
};

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
    <main className="max-w-4xl px-6 py-10">
      <p>
        <a href="/invoices">&larr; Invoices</a>
      </p>
      <h1 className="mt-2 flex flex-wrap items-center gap-3 text-2xl font-bold">
        <FileText className="h-6 w-6 text-brand" />
        {invoice.invoice_number}
        <span className={`rounded-full px-2.5 py-0.5 text-sm font-medium ${STATUS_STYLES[invoice.status] ?? "bg-brand-tint text-muted"}`}>
          {invoice.status === "void" ? "Voided" : invoice.status}
        </span>
      </h1>
      {searchParams.error && <p className="mt-3 text-sm font-medium text-error">{searchParams.error}</p>}
      {searchParams.success && <p className="mt-3 text-sm font-medium text-success">Done.</p>}

      <div className="mt-6 rounded-xl border border-border bg-surface p-5 shadow-sm">
        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted">Customer</dt>
            <dd>{invoice.customer_name}</dd>
          </div>
          <div>
            <dt className="text-muted">Revenue account</dt>
            <dd>
              {invoice.revenue_code} — {invoice.revenue_name}
            </dd>
          </div>
          <div>
            <dt className="text-muted">Invoice date</dt>
            <dd>{new Date(invoice.invoice_date).toLocaleDateString()}</dd>
          </div>
          <div>
            <dt className="text-muted">Due date</dt>
            <dd>{new Date(invoice.due_date).toLocaleDateString()}</dd>
          </div>
          {invoice.notes && (
            <div className="sm:col-span-2">
              <dt className="text-muted">Notes</dt>
              <dd>{invoice.notes}</dd>
            </div>
          )}
        </dl>
      </div>

      <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-surface p-5 shadow-sm">
        <table className="w-full min-w-[600px] border-collapse">
          <thead>
            <tr className="border-b text-left">
              <th>Description</th>
              <th>Qty</th>
              <th>Unit price</th>
              <th>Discount</th>
              <th>Line total</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l: any, i: number) => (
              <tr key={i} className="border-b">
                <td>{l.description}</td>
                <td>{Number(l.quantity)}</td>
                <td>{formatCurrency(Number(l.unit_price))}</td>
                <td>{Number(l.discount_percent)}%</td>
                <td>{formatCurrency(Number(l.line_total))}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-right">
          <strong>Total: {formatCurrency(total)}</strong>
        </p>
      </div>

      {invoice.status === "draft" && (
        <div className="mt-6 flex gap-2">
          <form action={sendInvoice}>
            <input type="hidden" name="id" value={invoice.id} />
            <button type="submit" className="inline-flex items-center gap-1.5">
              <Send className="h-3.5 w-3.5" />
              Send (posts to ledger)
            </button>
          </form>
          <form action={deleteInvoiceDraft}>
            <input type="hidden" name="id" value={invoice.id} />
            <button type="submit" className="inline-flex items-center gap-1.5">
              <Trash2 className="h-3.5 w-3.5" />
              Delete draft
            </button>
          </form>
        </div>
      )}

      {isPostedAtAll && balance && (
        <>
          <div className="mt-6 rounded-xl border border-border bg-surface p-5 shadow-sm">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <CreditCard className="h-4 w-4 text-brand" />
              Payments
            </h2>
            <p className="mt-1 text-sm text-muted">
              Paid: {formatCurrency(balance.paid)} — Credited to balance: {formatCurrency(balance.creditedToAR)} —
              Remaining owed: {formatCurrency(balance.remainingOwed)}
            </p>

            {payments.length > 0 && (
              <table className="mt-4 w-full border-collapse">
                <thead>
                  <tr className="border-b text-left">
                    <th>Date</th>
                    <th>Account</th>
                    <th>Amount</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p: any) => (
                    <tr key={p.id} className="border-b" style={{ opacity: p.voided_at ? 0.5 : 1 }}>
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
                            <form action={voidPayment} className="flex flex-wrap items-center gap-1.5 py-1">
                              <input type="hidden" name="paymentId" value={p.id} />
                              <input name="reason" placeholder="Reason (optional)" style={{ width: 110 }} />
                              <button type="submit" className="inline-flex items-center gap-1.5">
                                <Ban className="h-3.5 w-3.5" />
                                Void
                              </button>
                            </form>
                          )
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {isOpen && (
              <>
                {cashAccounts.length === 0 && (
                  <p className="mt-4 text-sm font-medium text-error">
                    No account is tagged "Cash or Bank" yet — tag one on{" "}
                    <a href="/accounts">Chart of Accounts</a> to record a payment.
                  </p>
                )}
                {cashAccounts.length > 0 && (
                  <form
                    action={recordInvoicePayment}
                    className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4"
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
                    <button type="submit" className="inline-flex items-center gap-1.5">
                      <CreditCard className="h-3.5 w-3.5" />
                      Record payment
                    </button>
                  </form>
                )}
              </>
            )}
          </div>

          <div className="mt-6 rounded-xl border border-border bg-surface p-5 shadow-sm">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <Undo2 className="h-4 w-4 text-brand" />
              Credit notes
            </h2>

            {creditNotes.length > 0 && (
              <table className="mt-4 w-full border-collapse">
                <thead>
                  <tr className="border-b text-left">
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
                    <tr key={cn.id} className="border-b" style={{ opacity: cn.voided_at ? 0.5 : 1 }}>
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
                            <form action={voidCreditNote} className="flex flex-wrap items-center gap-1.5 py-1">
                              <input type="hidden" name="creditNoteId" value={cn.id} />
                              <input name="reason" placeholder="Reason (optional)" style={{ width: 110 }} />
                              <button type="submit" className="inline-flex items-center gap-1.5">
                                <Ban className="h-3.5 w-3.5" />
                                Void
                              </button>
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
              <form
                action={issueCreditNote}
                className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4"
              >
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
                <button type="submit" className="inline-flex items-center gap-1.5">
                  <Undo2 className="h-3.5 w-3.5" />
                  Issue credit note
                </button>
              </form>
            )}
          </div>

          {canVoidInvoice && (
            <form action={voidInvoice} className="mt-6 flex flex-wrap items-center gap-2">
              <input type="hidden" name="id" value={invoice.id} />
              <input name="reason" placeholder="Reason (optional)" />
              <button type="submit" className="inline-flex items-center gap-1.5">
                <Ban className="h-3.5 w-3.5" />
                Void invoice
              </button>
            </form>
          )}
          {canVoid && isPostedAtAll && hasActiveChildren && (
            <p className="mt-4 text-sm text-muted">
              This invoice can't be voided while it has active payments or credit notes — void those first.
            </p>
          )}
        </>
      )}
    </main>
  );
}

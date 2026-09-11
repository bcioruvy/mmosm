import { auth } from "@/auth";
import sql from "@/lib/db";
import { redirect } from "next/navigation";
import { PERMISSIONS } from "@/lib/permissions";
import { formatCurrency } from "@/lib/currency";
import { Fragment } from "react";
import { voidPayment, updatePaymentNotes } from "./actions";
import { CreditCard, Ban } from "lucide-react";
import InlineEditField from "../InlineEditField";
import Disclosure from "../Disclosure";

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
    <main className="max-w-screen-2xl px-6 py-10">
      <h1 className="flex items-center gap-2 text-2xl font-bold">
        <CreditCard className="h-6 w-6 text-brand" />
        Payments
      </h1>
      {searchParams.error && <p className="mt-3 text-sm font-medium text-error">{searchParams.error}</p>}
      {searchParams.success && <p className="mt-3 text-sm font-medium text-success">Done.</p>}
      <p className="mt-3 text-sm text-muted">
        Record a payment from an unpaid expense's row on <a href="/expenses">Expenses</a>, or from an open
        invoice's detail page.
      </p>

      <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-surface p-5 shadow-sm">
        <table className="w-full min-w-[800px] border-collapse">
          <thead>
            <tr className="border-b text-left">
              <th>Date</th>
              <th>Direction</th>
              <th>Applied to</th>
              <th>Account</th>
              <th>Amount</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p: any) => (
              <Fragment key={p.id}>
                <tr className="border-b" style={{ opacity: p.voided_at ? 0.5 : 1 }}>
                  <td className="pt-3">{new Date(p.payment_date).toLocaleDateString()}</td>
                  <td className="pt-3">{p.direction === "in" ? "In" : "Out"}</td>
                  <td className="pt-3">
                    {p.applied_to_type === "invoice"
                      ? `Invoice ${p.invoice_number} — ${p.customer_name}`
                      : `Expense — ${p.expense_category_name}`}
                  </td>
                  <td className="pt-3">
                    {p.account_code} — {p.account_name}
                  </td>
                  <td className="pt-3">{formatCurrency(Number(p.amount))}</td>
                  <td className="pt-3">{p.voided_at ? "Voided" : "Active"}</td>
                </tr>
                <tr className="border-b" style={{ opacity: p.voided_at ? 0.5 : 1 }}>
                  <td colSpan={6} className="pb-3 pt-1">
                    {p.voided_at ? (
                      <span className="text-sm text-muted">{p.notes ?? ""}</span>
                    ) : (
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <InlineEditField
                          action={updatePaymentNotes}
                          hiddenFields={{ paymentId: p.id }}
                          fieldName="notes"
                          value={p.notes ?? null}
                          placeholder="Notes"
                        />
                        {canVoid && (
                          <Disclosure label="Void" icon={<Ban className="h-3.5 w-3.5" />}>
                            <form action={voidPayment} className="flex flex-wrap items-center gap-1.5">
                              <input type="hidden" name="paymentId" value={p.id} />
                              <input name="reason" placeholder="Reason (optional)" style={{ width: 110 }} />
                              <button type="submit" className="text-xs">
                                Confirm
                              </button>
                            </form>
                          </Disclosure>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}

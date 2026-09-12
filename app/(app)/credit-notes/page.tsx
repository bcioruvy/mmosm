import { auth } from "@/auth";
import sql from "@/lib/db";
import { redirect } from "next/navigation";
import { PERMISSIONS } from "@/lib/permissions";
import { formatCurrency } from "@/lib/currency";
import { Fragment } from "react";
import { voidCreditNote, updateCreditNoteReason } from "./actions";
import { Undo2, Ban } from "lucide-react";
import InlineEditField from "../InlineEditField";
import Disclosure from "../Disclosure";
import HideVoidedToggle from "../HideVoidedToggle";

export default async function CreditNotesPage({
  searchParams,
}: {
  searchParams: { error?: string; success?: string; showVoided?: string };
}) {
  const session = await auth();
  const permissions = session?.user?.permissions ?? [];
  if (!session?.user || !permissions.includes(PERMISSIONS.MANAGE_TRANSACTIONS)) {
    redirect("/");
  }
  const canVoid = permissions.includes(PERMISSIONS.VOID_TRANSACTIONS);

  const creditNotes = await sql`
    SELECT cn.id, cn.credit_note_number, cn.credit_date, cn.amount, cn.reason, cn.voided_at,
      inv.id AS invoice_id, inv.invoice_number, c.name AS customer_name,
      ra.code AS refund_account_code, ra.name AS refund_account_name
    FROM credit_notes cn
    JOIN invoices inv ON inv.id = cn.invoice_id
    JOIN customers c ON c.id = inv.customer_id
    LEFT JOIN accounts ra ON ra.id = cn.refund_account_id
    ORDER BY cn.credit_date DESC, cn.id DESC
  `;

  const showVoided = searchParams.showVoided === "1";
  const visibleCreditNotes = showVoided ? creditNotes : creditNotes.filter((cn: any) => !cn.voided_at);
  const hiddenCount = creditNotes.length - visibleCreditNotes.length;

  return (
    <main className="max-w-screen-2xl px-6 py-10">
      <h1 className="flex items-center gap-2 text-2xl font-bold">
        <Undo2 className="h-6 w-6 text-brand" />
        Credit notes
      </h1>
      {searchParams.error && <p className="mt-3 text-sm font-medium text-error">{searchParams.error}</p>}
      {searchParams.success && <p className="mt-3 text-sm font-medium text-success">Done.</p>}
      <p className="mt-3 text-sm text-muted">
        Issue a credit note from an eligible invoice's detail page under <a href="/invoices">Invoices</a>.
      </p>

      <div className="mt-3">
        <HideVoidedToggle showVoided={showVoided} hiddenCount={hiddenCount} />
      </div>

      <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-surface p-5 shadow-sm">
        <table className="w-full min-w-[900px] border-collapse">
          <thead>
            <tr className="border-b text-left">
              <th>Number</th>
              <th>Date</th>
              <th>Invoice</th>
              <th>Customer</th>
              <th>Amount</th>
              <th>Type</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {visibleCreditNotes.map((cn: any) => (
              <Fragment key={cn.id}>
                <tr className="border-b" style={{ opacity: cn.voided_at ? 0.5 : 1 }}>
                  <td className="pt-3">{cn.credit_note_number}</td>
                  <td className="pt-3">{new Date(cn.credit_date).toLocaleDateString()}</td>
                  <td className="pt-3">
                    <a href={`/invoices/${cn.invoice_id}`}>{cn.invoice_number}</a>
                  </td>
                  <td className="pt-3">{cn.customer_name}</td>
                  <td className="pt-3">{formatCurrency(Number(cn.amount))}</td>
                  <td className="pt-3">
                    {cn.refund_account_code
                      ? `Cash refund (${cn.refund_account_code} — ${cn.refund_account_name})`
                      : "Applied to balance owed"}
                  </td>
                  <td className="pt-3">{cn.voided_at ? "Voided" : "Active"}</td>
                </tr>
                <tr className="border-b" style={{ opacity: cn.voided_at ? 0.5 : 1 }}>
                  <td colSpan={7} className="pb-3 pt-1">
                    {cn.voided_at ? (
                      <span className="text-sm text-muted">{cn.reason ?? ""}</span>
                    ) : (
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <InlineEditField
                          action={updateCreditNoteReason}
                          hiddenFields={{ creditNoteId: cn.id }}
                          fieldName="reason"
                          value={cn.reason ?? null}
                          placeholder="Reason"
                        />
                        {canVoid && (
                          <Disclosure label="Void" icon={<Ban className="h-3.5 w-3.5" />}>
                            <form action={voidCreditNote} className="flex flex-wrap items-center gap-1.5">
                              <input type="hidden" name="creditNoteId" value={cn.id} />
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

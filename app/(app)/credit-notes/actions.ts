"use server";

import sql from "@/lib/db";
import { requirePermission } from "@/lib/authz";
import { logAudit } from "@/lib/audit";
import { postJournalEntry } from "@/lib/journal";
import { getAccountsReceivableAccount, getSalesReturnsAccount } from "@/lib/controlAccounts";
import { getInvoiceBalance } from "@/lib/invoiceBalance";
import { PERMISSIONS } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function issueCreditNote(formData: FormData) {
  const session = await requirePermission(PERMISSIONS.MANAGE_TRANSACTIONS);
  const invoiceId = String(formData.get("invoiceId") ?? "");
  const creditDate = String(formData.get("creditDate") ?? "");
  const amount = Number(formData.get("amount"));
  const reason = String(formData.get("reason") ?? "").trim();
  const mode = String(formData.get("mode") ?? "");
  const refundAccountId = String(formData.get("refundAccountId") ?? "") || null;

  if (!invoiceId || !creditDate || !Number.isFinite(amount) || amount <= 0 || !mode) {
    redirect(`/invoices/${invoiceId}?error=${encodeURIComponent("Date, amount, and a mode are required.")}`);
  }
  if (mode === "refund_cash" && !refundAccountId) {
    redirect(`/invoices/${invoiceId}?error=${encodeURIComponent("Choose a cash/bank account to refund from.")}`);
  }

  const [invoice] = await sql`SELECT id, invoice_number, status FROM invoices WHERE id = ${invoiceId}`;
  if (!invoice) redirect(`/invoices?error=${encodeURIComponent("Invoice not found.")}`);
  if (!["sent", "partial", "paid"].includes(invoice.status)) {
    redirect(`/invoices/${invoiceId}?error=${encodeURIComponent("This invoice isn't eligible for a credit note.")}`);
  }

  let error: string | null = null;
  try {
    const balance = await getInvoiceBalance(invoiceId);
    let creditAccountId: string;

    if (mode === "apply_to_balance") {
      if (amount > balance.remainingOwed + 0.001) {
        throw new Error(`Amount exceeds the remaining balance owed of Rs ${balance.remainingOwed.toFixed(2)}.`);
      }
      const ar = await getAccountsReceivableAccount();
      creditAccountId = ar.id;
    } else {
      if (amount > balance.refundableCash + 0.001) {
        throw new Error(`Amount exceeds the refundable amount of Rs ${balance.refundableCash.toFixed(2)}.`);
      }
      const [account] = await sql`
        SELECT id FROM accounts WHERE id = ${refundAccountId} AND system_role = 'cash_or_bank' AND is_active = true
      `;
      if (!account) throw new Error("Choose a valid cash/bank account.");
      creditAccountId = account.id;
    }

    const returns = await getSalesReturnsAccount();
    const description = `Credit note — invoice ${invoice.invoice_number}${reason ? `: ${reason}` : ""}`;

    const { sourceId: creditNoteId } = await postJournalEntry({
      entryDate: creditDate,
      description,
      sourceType: "credit_note",
      createdBy: session.user.id,
      lines: [
        { accountId: returns.id, debit: amount },
        { accountId: creditAccountId, credit: amount },
      ],
      linkSource: async (tx, journalEntryId) => {
        const [creditNote] = await tx`
          INSERT INTO credit_notes (
            credit_note_number, invoice_id, credit_date, amount, reason, refund_account_id, journal_entry_id, created_by
          )
          VALUES (
            'CN-' || lpad(nextval('credit_note_number_seq')::text, 5, '0'),
            ${invoiceId}, ${creditDate}, ${amount}, ${reason || null},
            ${mode === "refund_cash" ? refundAccountId : null}, ${journalEntryId}, ${session.user.id}
          )
          RETURNING id
        `;
        return creditNote.id as number;
      },
    });

    await logAudit({
      actorId: session.user.id,
      action: "create",
      entityType: "credit_note",
      entityId: creditNoteId,
      details: { invoiceId, amount, mode },
    });
  } catch (err: any) {
    error = err?.message || "Could not issue credit note.";
  }

  if (error) redirect(`/invoices/${invoiceId}?error=${encodeURIComponent(error)}`);
  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/invoices");
  revalidatePath("/credit-notes");
  redirect(`/invoices/${invoiceId}?success=1`);
}

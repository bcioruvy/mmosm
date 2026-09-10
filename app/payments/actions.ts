"use server";

import sql from "@/lib/db";
import { requirePermission } from "@/lib/authz";
import { logAudit } from "@/lib/audit";
import { postJournalEntry } from "@/lib/journal";
import { getAccountsReceivableAccount, getAccountsPayableAccount } from "@/lib/controlAccounts";
import { PERMISSIONS } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

async function assertCashOrBankAccount(accountId: string) {
  const [account] = await sql`
    SELECT id FROM accounts WHERE id = ${accountId} AND system_role = 'cash_or_bank' AND is_active = true
  `;
  if (!account) throw new Error("Choose a valid cash/bank account.");
  return account;
}

/** Pays off an unpaid (on-credit) expense in full — no partial bill payments yet. */
export async function payExpense(formData: FormData) {
  const session = await requirePermission(PERMISSIONS.MANAGE_TRANSACTIONS);
  const expenseId = String(formData.get("expenseId") ?? "");
  const paymentDate = String(formData.get("paymentDate") ?? "");
  const accountId = String(formData.get("accountId") ?? "");

  if (!expenseId || !paymentDate || !accountId) {
    redirect(`/expenses?error=${encodeURIComponent("Date and payment account are required.")}`);
  }

  const [expense] = await sql`SELECT id, amount, payment_status FROM expenses WHERE id = ${expenseId}`;
  if (!expense) redirect(`/expenses?error=${encodeURIComponent("Expense not found.")}`);
  if (expense.payment_status !== "unpaid") {
    redirect(`/expenses?error=${encodeURIComponent("This expense is already paid.")}`);
  }

  let error: string | null = null;
  try {
    await assertCashOrBankAccount(accountId);
    const ap = await getAccountsPayableAccount();
    const amount = Number(expense.amount);

    await postJournalEntry({
      entryDate: paymentDate,
      description: `Bill payment — expense #${expenseId}`,
      sourceType: "payment",
      createdBy: session.user.id,
      lines: [
        { accountId: ap.id, debit: amount },
        { accountId, credit: amount },
      ],
      linkSource: async (tx, journalEntryId) => {
        const [payment] = await tx`
          INSERT INTO payments (direction, payment_date, amount, account_id, applied_to_type, applied_to_id, journal_entry_id, created_by)
          VALUES ('out', ${paymentDate}, ${amount}, ${accountId}, 'expense', ${expenseId}, ${journalEntryId}, ${session.user.id})
          RETURNING id
        `;
        await tx`UPDATE expenses SET payment_status = 'paid', payment_account_id = ${accountId} WHERE id = ${expenseId}`;
        return payment.id as number;
      },
    });

    await logAudit({
      actorId: session.user.id,
      action: "pay",
      entityType: "expense",
      entityId: expenseId,
      details: { amount, accountId },
    });
  } catch (err: any) {
    error = err?.message || "Could not record payment.";
  }

  if (error) redirect(`/expenses?error=${encodeURIComponent(error)}`);
  revalidatePath("/expenses");
  revalidatePath("/payments");
  redirect("/expenses?success=1");
}

/** Records a payment against an invoice, allowing partial payments. */
export async function recordInvoicePayment(formData: FormData) {
  const session = await requirePermission(PERMISSIONS.MANAGE_TRANSACTIONS);
  const invoiceId = String(formData.get("invoiceId") ?? "");
  const paymentDate = String(formData.get("paymentDate") ?? "");
  const accountId = String(formData.get("accountId") ?? "");
  const amount = Number(formData.get("amount"));

  if (!invoiceId || !paymentDate || !accountId || !Number.isFinite(amount) || amount <= 0) {
    redirect(`/invoices/${invoiceId}?error=${encodeURIComponent("Date, account, and a positive amount are required.")}`);
  }

  const [invoice] = await sql`SELECT id, status FROM invoices WHERE id = ${invoiceId}`;
  if (!invoice) redirect(`/invoices?error=${encodeURIComponent("Invoice not found.")}`);
  if (invoice.status !== "sent" && invoice.status !== "partial") {
    redirect(`/invoices/${invoiceId}?error=${encodeURIComponent("This invoice isn't open for payment.")}`);
  }

  const [{ total }] = await sql`SELECT COALESCE(SUM(line_total), 0) AS total FROM invoice_lines WHERE invoice_id = ${invoiceId}`;
  const [{ paid }] = await sql`
    SELECT COALESCE(SUM(amount), 0) AS paid FROM payments WHERE applied_to_type = 'invoice' AND applied_to_id = ${invoiceId}
  `;
  const remaining = Math.round((Number(total) - Number(paid)) * 100) / 100;

  if (amount > remaining + 0.001) {
    redirect(`/invoices/${invoiceId}?error=${encodeURIComponent(`Amount exceeds the remaining balance of Rs ${remaining.toFixed(2)}.`)}`);
  }

  let error: string | null = null;
  try {
    await assertCashOrBankAccount(accountId);
    const ar = await getAccountsReceivableAccount();
    const newPaid = Math.round((Number(paid) + amount) * 100) / 100;
    const newStatus = newPaid >= Number(total) ? "paid" : "partial";

    await postJournalEntry({
      entryDate: paymentDate,
      description: `Invoice payment — invoice #${invoiceId}`,
      sourceType: "payment",
      createdBy: session.user.id,
      lines: [
        { accountId, debit: amount },
        { accountId: ar.id, credit: amount },
      ],
      linkSource: async (tx, journalEntryId) => {
        const [payment] = await tx`
          INSERT INTO payments (direction, payment_date, amount, account_id, applied_to_type, applied_to_id, journal_entry_id, created_by)
          VALUES ('in', ${paymentDate}, ${amount}, ${accountId}, 'invoice', ${invoiceId}, ${journalEntryId}, ${session.user.id})
          RETURNING id
        `;
        await tx`UPDATE invoices SET status = ${newStatus} WHERE id = ${invoiceId}`;
        return payment.id as number;
      },
    });

    await logAudit({
      actorId: session.user.id,
      action: "pay",
      entityType: "invoice",
      entityId: invoiceId,
      details: { amount, accountId, newStatus },
    });
  } catch (err: any) {
    error = err?.message || "Could not record payment.";
  }

  if (error) redirect(`/invoices/${invoiceId}?error=${encodeURIComponent(error)}`);
  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/invoices");
  revalidatePath("/payments");
  redirect(`/invoices/${invoiceId}?success=1`);
}

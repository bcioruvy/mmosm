"use server";

import sql from "@/lib/db";
import { requirePermission } from "@/lib/authz";
import { logAudit } from "@/lib/audit";
import { postJournalEntry } from "@/lib/journal";
import { voidJournalEntry } from "@/lib/voidTransaction";
import { getAccountsPayableAccount } from "@/lib/controlAccounts";
import { PERMISSIONS } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const ON_CREDIT = "on_credit";

export async function createExpense(formData: FormData) {
  const session = await requirePermission(PERMISSIONS.MANAGE_TRANSACTIONS);

  const expenseDate = String(formData.get("expenseDate") ?? "");
  const vendorId = String(formData.get("vendorId") ?? "") || null;
  const categoryAccountId = String(formData.get("categoryAccountId") ?? "");
  const amount = Number(formData.get("amount"));
  const paymentChoice = String(formData.get("paymentChoice") ?? "");
  const dueDate = String(formData.get("dueDate") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim();

  if (!expenseDate || !categoryAccountId || !paymentChoice || !Number.isFinite(amount) || amount <= 0) {
    redirect(`/expenses?error=${encodeURIComponent("Date, category, amount, and payment method are required.")}`);
  }

  const [category] = await sql`
    SELECT id, name FROM accounts WHERE id = ${categoryAccountId} AND type IN ('expense', 'cogs') AND is_active = true
  `;
  if (!category) {
    redirect(`/expenses?error=${encodeURIComponent("Choose a valid expense/COGS category.")}`);
  }

  let vendorName: string | null = null;
  if (vendorId) {
    const [vendor] = await sql`SELECT name FROM vendors WHERE id = ${vendorId} AND is_active = true`;
    if (!vendor) redirect(`/expenses?error=${encodeURIComponent("Vendor not found.")}`);
    vendorName = vendor.name;
  }

  const isOnCredit = paymentChoice === ON_CREDIT;
  let paymentAccountId: string | null = null;
  if (!isOnCredit) {
    const [paymentAccount] = await sql`
      SELECT id FROM accounts WHERE id = ${paymentChoice} AND system_role = 'cash_or_bank' AND is_active = true
    `;
    if (!paymentAccount) redirect(`/expenses?error=${encodeURIComponent("Choose a valid payment account.")}`);
    paymentAccountId = paymentChoice;
  }

  let error: string | null = null;
  try {
    const creditAccountId = isOnCredit ? (await getAccountsPayableAccount()).id : paymentAccountId!;
    const description = `Expense: ${category.name}${vendorName ? ` — ${vendorName}` : ""}`;

    const { sourceId: expenseId } = await postJournalEntry({
      entryDate: expenseDate,
      description,
      sourceType: "expense",
      createdBy: session.user.id,
      lines: [
        { accountId: categoryAccountId, debit: amount },
        { accountId: creditAccountId, credit: amount },
      ],
      linkSource: async (tx, journalEntryId) => {
        const [expense] = await tx`
          INSERT INTO expenses (
            expense_date, vendor_id, category_account_id, amount,
            payment_status, payment_account_id, due_date, notes, journal_entry_id, created_by
          )
          VALUES (
            ${expenseDate}, ${vendorId}, ${categoryAccountId}, ${amount},
            ${isOnCredit ? "unpaid" : "paid"}, ${paymentAccountId}, ${isOnCredit ? dueDate : null}, ${notes || null}, ${journalEntryId}, ${session.user.id}
          )
          RETURNING id
        `;
        return expense.id as number;
      },
    });

    await logAudit({
      actorId: session.user.id,
      action: "create",
      entityType: "expense",
      entityId: expenseId,
      details: { expenseDate, vendorId, categoryAccountId, amount, paymentStatus: isOnCredit ? "unpaid" : "paid" },
    });
  } catch (err: any) {
    error = err?.message || "Could not save expense.";
  }

  if (error) redirect(`/expenses?error=${encodeURIComponent(error)}`);
  revalidatePath("/expenses");
  redirect("/expenses?success=1");
}

/** Edits only the notes field — no financial data. Blocked once voided. */
export async function updateExpenseNotes(formData: FormData) {
  const session = await requirePermission(PERMISSIONS.MANAGE_TRANSACTIONS);
  const expenseId = String(formData.get("expenseId") ?? "");
  const newNotes = String(formData.get("notes") ?? "").trim() || null;

  const [expense] = await sql`SELECT id, notes, voided_at FROM expenses WHERE id = ${expenseId}`;
  if (!expense) redirect(`/expenses?error=${encodeURIComponent("Expense not found.")}`);
  if (expense.voided_at) {
    redirect(`/expenses?error=${encodeURIComponent("Can't edit notes on a voided expense.")}`);
  }

  if ((expense.notes ?? null) === newNotes) {
    redirect("/expenses?success=1");
  }

  let error: string | null = null;
  try {
    await sql`UPDATE expenses SET notes = ${newNotes} WHERE id = ${expenseId}`;
    await logAudit({
      actorId: session.user.id,
      action: "edit_notes",
      entityType: "expense",
      entityId: expenseId,
      details: { field: "notes", oldValue: expense.notes, newValue: newNotes },
    });
  } catch (err: any) {
    error = err?.message || "Could not update notes.";
  }

  if (error) redirect(`/expenses?error=${encodeURIComponent(error)}`);
  revalidatePath("/expenses");
  redirect("/expenses?success=1");
}

export async function voidExpense(formData: FormData) {
  const session = await requirePermission(PERMISSIONS.VOID_TRANSACTIONS);
  const expenseId = String(formData.get("expenseId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();

  const [expense] = await sql`
    SELECT id, journal_entry_id, voided_at FROM expenses WHERE id = ${expenseId}
  `;
  if (!expense) redirect(`/expenses?error=${encodeURIComponent("Expense not found.")}`);
  if (expense.voided_at) redirect(`/expenses?error=${encodeURIComponent("This expense is already voided.")}`);

  const [activePayment] = await sql`
    SELECT id FROM payments WHERE applied_to_type = 'expense' AND applied_to_id = ${expenseId} AND voided_at IS NULL
  `;
  if (activePayment) {
    redirect(
      `/expenses?error=${encodeURIComponent("This expense was paid via a separate payment — void the payment first, then void the expense.")}`
    );
  }

  let error: string | null = null;
  try {
    await voidJournalEntry({
      originalEntryId: expense.journal_entry_id,
      reverseDescriptionPrefix: "Void expense",
      createdBy: session.user.id,
      updateSource: async (tx) => {
        await tx`UPDATE expenses SET voided_at = now(), voided_by = ${session.user.id} WHERE id = ${expenseId}`;
      },
    });

    await logAudit({
      actorId: session.user.id,
      action: "void",
      entityType: "expense",
      entityId: expenseId,
      details: { reason },
    });
  } catch (err: any) {
    error = err?.message || "Could not void expense.";
  }

  if (error) redirect(`/expenses?error=${encodeURIComponent(error)}`);
  revalidatePath("/expenses");
  redirect("/expenses?success=1");
}

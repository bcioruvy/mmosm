"use server";

import sql from "@/lib/db";
import { requirePermission } from "@/lib/authz";
import { logAudit } from "@/lib/audit";
import { postJournalEntry } from "@/lib/journal";
import { voidJournalEntry } from "@/lib/voidTransaction";
import { getAccountsPayableAccount } from "@/lib/controlAccounts";
import { todayISO } from "@/lib/reports/dates";
import { PERMISSIONS } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const ON_CREDIT = "on_credit";

/** Shared by voidExpense and reclassifyExpense — both are blocked by the same condition. */
async function hasActivePayment(expenseId: string) {
  const [row] = await sql`
    SELECT id FROM payments WHERE applied_to_type = 'expense' AND applied_to_id = ${expenseId} AND voided_at IS NULL
  `;
  return !!row;
}

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

  if (await hasActivePayment(expenseId)) {
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

/**
 * Fixes a miscategorized expense without editing the posted entry in
 * place: voids the original (same mechanism as voidExpense — offsetting
 * reversal dated today, audit logged) and, in the same DB transaction,
 * posts a brand-new entry identical in every way except the account,
 * also dated today. One atomic operation — if any part fails, nothing
 * happens, not a half-voided state. Gated by void_transactions (not a
 * new permission) since this is structurally a void; every role that
 * holds void_transactions also holds manage_transactions, so nothing
 * is gained by requiring both.
 */
export async function reclassifyExpense(formData: FormData) {
  const session = await requirePermission(PERMISSIONS.VOID_TRANSACTIONS);
  const expenseId = String(formData.get("expenseId") ?? "");
  const newCategoryAccountId = String(formData.get("newCategoryAccountId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();

  if (!expenseId || !newCategoryAccountId) {
    redirect(`/expenses?error=${encodeURIComponent("Choose an account to reclassify to.")}`);
  }

  const [expense] = await sql`
    SELECT id, vendor_id, category_account_id, amount, payment_status, payment_account_id,
      due_date, notes, journal_entry_id, voided_at
    FROM expenses WHERE id = ${expenseId}
  `;
  if (!expense) redirect(`/expenses?error=${encodeURIComponent("Expense not found.")}`);
  if (expense.voided_at) redirect(`/expenses?error=${encodeURIComponent("This expense is already voided.")}`);

  if (String(expense.category_account_id) === newCategoryAccountId) {
    redirect(`/expenses?error=${encodeURIComponent("Choose a different account to reclassify to.")}`);
  }

  if (await hasActivePayment(expenseId)) {
    redirect(
      `/expenses?error=${encodeURIComponent("This expense was paid via a separate payment — void the payment first, then reclassify.")}`
    );
  }

  const [newCategory] = await sql`
    SELECT id, name FROM accounts WHERE id = ${newCategoryAccountId} AND type IN ('expense', 'cogs') AND is_active = true
  `;
  if (!newCategory) redirect(`/expenses?error=${encodeURIComponent("Choose a valid expense/COGS category.")}`);

  let vendorName: string | null = null;
  if (expense.vendor_id) {
    const [vendor] = await sql`SELECT name FROM vendors WHERE id = ${expense.vendor_id}`;
    vendorName = vendor?.name ?? null;
  }

  const today = todayISO();
  const amount = Number(expense.amount);
  let error: string | null = null;
  let newExpenseId: number | undefined;
  try {
    await voidJournalEntry({
      originalEntryId: expense.journal_entry_id,
      reverseDescriptionPrefix: "Reclassify expense",
      createdBy: session.user.id,
      updateSource: async (tx) => {
        await tx`UPDATE expenses SET voided_at = now(), voided_by = ${session.user.id} WHERE id = ${expenseId}`;

        const isOnCredit = expense.payment_status === "unpaid";
        const creditAccountId = isOnCredit ? (await getAccountsPayableAccount()).id : expense.payment_account_id;
        const description = `Expense: ${newCategory.name}${vendorName ? ` — ${vendorName}` : ""}`;

        const [newEntry] = await tx`
          INSERT INTO journal_entries (entry_date, description, source_type, source_id, created_by)
          VALUES (${today}, ${description}, 'reclassify', NULL, ${session.user.id})
          RETURNING id
        `;
        await tx`
          INSERT INTO journal_lines (entry_id, account_id, debit, credit)
          VALUES (${newEntry.id}, ${newCategoryAccountId}, ${amount}, 0)
        `;
        await tx`
          INSERT INTO journal_lines (entry_id, account_id, debit, credit)
          VALUES (${newEntry.id}, ${creditAccountId}, 0, ${amount})
        `;

        const [newExpense] = await tx`
          INSERT INTO expenses (
            expense_date, vendor_id, category_account_id, amount,
            payment_status, payment_account_id, due_date, notes, journal_entry_id, created_by
          )
          VALUES (
            ${today}, ${expense.vendor_id}, ${newCategoryAccountId}, ${amount},
            ${expense.payment_status}, ${expense.payment_account_id}, ${expense.due_date}, ${expense.notes}, ${newEntry.id}, ${session.user.id}
          )
          RETURNING id
        `;
        newExpenseId = newExpense.id;

        await tx`UPDATE journal_entries SET source_id = ${newExpense.id} WHERE id = ${newEntry.id}`;
      },
    });

    await logAudit({
      actorId: session.user.id,
      action: "reclassify",
      entityType: "expense",
      entityId: expenseId,
      details: { fromAccountId: expense.category_account_id, toAccountId: newCategoryAccountId, newExpenseId, reason },
    });
  } catch (err: any) {
    error = err?.message || "Could not reclassify expense.";
  }

  if (error) redirect(`/expenses?error=${encodeURIComponent(error)}`);
  revalidatePath("/expenses");
  redirect("/expenses?success=1");
}

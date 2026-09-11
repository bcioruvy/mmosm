"use server";

import sql from "@/lib/db";
import { requirePermission } from "@/lib/authz";
import { logAudit } from "@/lib/audit";
import { postJournalEntry } from "@/lib/journal";
import { voidJournalEntry } from "@/lib/voidTransaction";
import { todayISO } from "@/lib/reports/dates";
import { PERMISSIONS } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createIncome(formData: FormData) {
  const session = await requirePermission(PERMISSIONS.MANAGE_TRANSACTIONS);

  const incomeDate = String(formData.get("incomeDate") ?? "");
  const categoryAccountId = String(formData.get("categoryAccountId") ?? "");
  const paymentAccountId = String(formData.get("paymentAccountId") ?? "");
  const amount = Number(formData.get("amount"));
  const source = String(formData.get("source") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!incomeDate || !categoryAccountId || !paymentAccountId || !Number.isFinite(amount) || amount <= 0) {
    redirect(`/income?error=${encodeURIComponent("Date, category, payment account, and amount are required.")}`);
  }

  const [category] = await sql`
    SELECT id, name FROM accounts WHERE id = ${categoryAccountId} AND type = 'revenue' AND code != '4900' AND is_active = true
  `;
  if (!category) redirect(`/income?error=${encodeURIComponent("Choose a valid revenue/other-income category.")}`);

  const [paymentAccount] = await sql`
    SELECT id FROM accounts WHERE id = ${paymentAccountId} AND system_role = 'cash_or_bank' AND is_active = true
  `;
  if (!paymentAccount) redirect(`/income?error=${encodeURIComponent("Choose a valid payment account.")}`);

  let error: string | null = null;
  try {
    const description = `Income: ${category.name}${source ? ` — ${source}` : ""}`;

    const { sourceId: incomeId } = await postJournalEntry({
      entryDate: incomeDate,
      description,
      sourceType: "income",
      createdBy: session.user.id,
      lines: [
        { accountId: paymentAccountId, debit: amount },
        { accountId: categoryAccountId, credit: amount },
      ],
      linkSource: async (tx, journalEntryId) => {
        const [income] = await tx`
          INSERT INTO income (
            income_date, category_account_id, source, amount, payment_account_id, notes, journal_entry_id, created_by
          )
          VALUES (
            ${incomeDate}, ${categoryAccountId}, ${source || null}, ${amount}, ${paymentAccountId}, ${notes || null}, ${journalEntryId}, ${session.user.id}
          )
          RETURNING id
        `;
        return income.id as number;
      },
    });

    await logAudit({
      actorId: session.user.id,
      action: "create",
      entityType: "income",
      entityId: incomeId,
      details: { incomeDate, categoryAccountId, amount, source },
    });
  } catch (err: any) {
    error = err?.message || "Could not save income.";
  }

  if (error) redirect(`/income?error=${encodeURIComponent(error)}`);
  revalidatePath("/income");
  redirect("/income?success=1");
}

/** Edits only the notes field — no financial data. Blocked once voided. */
export async function updateIncomeNotes(formData: FormData) {
  const session = await requirePermission(PERMISSIONS.MANAGE_TRANSACTIONS);
  const incomeId = String(formData.get("incomeId") ?? "");
  const newNotes = String(formData.get("notes") ?? "").trim() || null;

  const [income] = await sql`SELECT id, notes, voided_at FROM income WHERE id = ${incomeId}`;
  if (!income) redirect(`/income?error=${encodeURIComponent("Income entry not found.")}`);
  if (income.voided_at) {
    redirect(`/income?error=${encodeURIComponent("Can't edit notes on a voided income entry.")}`);
  }

  if ((income.notes ?? null) === newNotes) {
    redirect("/income?success=1");
  }

  let error: string | null = null;
  try {
    await sql`UPDATE income SET notes = ${newNotes} WHERE id = ${incomeId}`;
    await logAudit({
      actorId: session.user.id,
      action: "edit_notes",
      entityType: "income",
      entityId: incomeId,
      details: { field: "notes", oldValue: income.notes, newValue: newNotes },
    });
  } catch (err: any) {
    error = err?.message || "Could not update notes.";
  }

  if (error) redirect(`/income?error=${encodeURIComponent(error)}`);
  revalidatePath("/income");
  redirect("/income?success=1");
}

export async function voidIncome(formData: FormData) {
  const session = await requirePermission(PERMISSIONS.VOID_TRANSACTIONS);
  const incomeId = String(formData.get("incomeId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();

  const [income] = await sql`SELECT id, journal_entry_id, voided_at FROM income WHERE id = ${incomeId}`;
  if (!income) redirect(`/income?error=${encodeURIComponent("Income entry not found.")}`);
  if (income.voided_at) redirect(`/income?error=${encodeURIComponent("This income entry is already voided.")}`);

  let error: string | null = null;
  try {
    await voidJournalEntry({
      originalEntryId: income.journal_entry_id,
      reverseDescriptionPrefix: "Void income",
      createdBy: session.user.id,
      updateSource: async (tx) => {
        await tx`UPDATE income SET voided_at = now(), voided_by = ${session.user.id} WHERE id = ${incomeId}`;
      },
    });

    await logAudit({
      actorId: session.user.id,
      action: "void",
      entityType: "income",
      entityId: incomeId,
      details: { reason },
    });
  } catch (err: any) {
    error = err?.message || "Could not void income entry.";
  }

  if (error) redirect(`/income?error=${encodeURIComponent(error)}`);
  revalidatePath("/income");
  redirect("/income?success=1");
}

/**
 * Fixes a miscategorized income entry without editing the posted entry
 * in place — same pattern as reclassifyExpense. Income has no
 * active-payment guard to reuse (it's always received immediately, no
 * payments-table involvement at all), so this only needs the
 * not-already-voided check.
 */
export async function reclassifyIncome(formData: FormData) {
  const session = await requirePermission(PERMISSIONS.VOID_TRANSACTIONS);
  const incomeId = String(formData.get("incomeId") ?? "");
  const newCategoryAccountId = String(formData.get("newCategoryAccountId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();

  if (!incomeId || !newCategoryAccountId) {
    redirect(`/income?error=${encodeURIComponent("Choose an account to reclassify to.")}`);
  }

  const [income] = await sql`
    SELECT id, source, category_account_id, amount, payment_account_id, notes, journal_entry_id, voided_at
    FROM income WHERE id = ${incomeId}
  `;
  if (!income) redirect(`/income?error=${encodeURIComponent("Income entry not found.")}`);
  if (income.voided_at) redirect(`/income?error=${encodeURIComponent("This income entry is already voided.")}`);

  if (String(income.category_account_id) === newCategoryAccountId) {
    redirect(`/income?error=${encodeURIComponent("Choose a different account to reclassify to.")}`);
  }

  const [newCategory] = await sql`
    SELECT id, name FROM accounts WHERE id = ${newCategoryAccountId} AND type = 'revenue' AND code != '4900' AND is_active = true
  `;
  if (!newCategory) redirect(`/income?error=${encodeURIComponent("Choose a valid revenue/other-income category.")}`);

  const today = todayISO();
  const amount = Number(income.amount);
  let error: string | null = null;
  let newIncomeId: number | undefined;
  try {
    await voidJournalEntry({
      originalEntryId: income.journal_entry_id,
      reverseDescriptionPrefix: "Reclassify income",
      createdBy: session.user.id,
      updateSource: async (tx) => {
        await tx`UPDATE income SET voided_at = now(), voided_by = ${session.user.id} WHERE id = ${incomeId}`;

        const description = `Income: ${newCategory.name}${income.source ? ` — ${income.source}` : ""}`;

        const [newEntry] = await tx`
          INSERT INTO journal_entries (entry_date, description, source_type, source_id, created_by)
          VALUES (${today}, ${description}, 'reclassify', NULL, ${session.user.id})
          RETURNING id
        `;
        await tx`
          INSERT INTO journal_lines (entry_id, account_id, debit, credit)
          VALUES (${newEntry.id}, ${income.payment_account_id}, ${amount}, 0)
        `;
        await tx`
          INSERT INTO journal_lines (entry_id, account_id, debit, credit)
          VALUES (${newEntry.id}, ${newCategoryAccountId}, 0, ${amount})
        `;

        const [newIncome] = await tx`
          INSERT INTO income (
            income_date, category_account_id, source, amount, payment_account_id, notes, journal_entry_id, created_by
          )
          VALUES (
            ${today}, ${newCategoryAccountId}, ${income.source}, ${amount}, ${income.payment_account_id}, ${income.notes}, ${newEntry.id}, ${session.user.id}
          )
          RETURNING id
        `;
        newIncomeId = newIncome.id;

        await tx`UPDATE journal_entries SET source_id = ${newIncome.id} WHERE id = ${newEntry.id}`;
      },
    });

    await logAudit({
      actorId: session.user.id,
      action: "reclassify",
      entityType: "income",
      entityId: incomeId,
      details: { fromAccountId: income.category_account_id, toAccountId: newCategoryAccountId, newIncomeId, reason },
    });
  } catch (err: any) {
    error = err?.message || "Could not reclassify income entry.";
  }

  if (error) redirect(`/income?error=${encodeURIComponent(error)}`);
  revalidatePath("/income");
  redirect("/income?success=1");
}

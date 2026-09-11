"use server";

import sql from "@/lib/db";
import { requirePermission } from "@/lib/authz";
import { logAudit } from "@/lib/audit";
import { postJournalEntry } from "@/lib/journal";
import { voidJournalEntry } from "@/lib/voidTransaction";
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
    SELECT id, name FROM accounts WHERE id = ${categoryAccountId} AND type = 'revenue' AND is_active = true
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

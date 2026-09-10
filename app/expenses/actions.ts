"use server";

import sql from "@/lib/db";
import { requirePermission } from "@/lib/authz";
import { logAudit } from "@/lib/audit";
import { postJournalEntry } from "@/lib/journal";
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
            payment_status, payment_account_id, notes, journal_entry_id, created_by
          )
          VALUES (
            ${expenseDate}, ${vendorId}, ${categoryAccountId}, ${amount},
            ${isOnCredit ? "unpaid" : "paid"}, ${paymentAccountId}, ${notes || null}, ${journalEntryId}, ${session.user.id}
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

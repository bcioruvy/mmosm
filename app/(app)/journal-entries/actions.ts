"use server";

import sql from "@/lib/db";
import { requirePermission } from "@/lib/authz";
import { logAudit } from "@/lib/audit";
import { postJournalEntry } from "@/lib/journal";
import { voidJournalEntry } from "@/lib/voidTransaction";
import { PERMISSIONS } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function toISODate(d: string | Date) {
  return new Date(d).toISOString().slice(0, 10);
}

type RawLine = { accountId: string; debit: string; credit: string };

export async function createManualJournalEntry(formData: FormData) {
  const session = await requirePermission(PERMISSIONS.MANAGE_JOURNAL_ENTRIES);

  const entryDate = String(formData.get("entryDate") ?? "");
  const description = String(formData.get("description") ?? "").trim();
  const linesJson = String(formData.get("linesJson") ?? "[]");

  if (!entryDate || !description) {
    redirect(`/journal-entries?error=${encodeURIComponent("Date and description are required.")}`);
  }

  let rawLines: RawLine[] = [];
  try {
    rawLines = JSON.parse(linesJson);
  } catch {
    redirect(`/journal-entries?error=${encodeURIComponent("Invalid line data.")}`);
  }

  const lines = rawLines
    .map((l) => ({
      accountId: l.accountId,
      debit: Number(l.debit) || 0,
      credit: Number(l.credit) || 0,
    }))
    .filter((l) => l.accountId && (l.debit > 0 || l.credit > 0));

  if (lines.length < 2) {
    redirect(`/journal-entries?error=${encodeURIComponent("At least two lines, each with an account and a debit or credit amount, are required.")}`);
  }
  if (lines.some((l) => l.debit > 0 && l.credit > 0)) {
    redirect(`/journal-entries?error=${encodeURIComponent("A line can't have both a debit and a credit — split it into two lines.")}`);
  }

  const totalDebit = lines.reduce((sum, l) => sum + l.debit, 0);
  const totalCredit = lines.reduce((sum, l) => sum + l.credit, 0);
  if (Math.round(totalDebit * 100) !== Math.round(totalCredit * 100)) {
    redirect(
      `/journal-entries?error=${encodeURIComponent(`Entry is not balanced: debits ${totalDebit.toFixed(2)}, credits ${totalCredit.toFixed(2)}.`)}`
    );
  }

  let error: string | null = null;
  let entryId: number | undefined;
  try {
    const result = await postJournalEntry({
      entryDate,
      description,
      sourceType: "manual",
      createdBy: session.user.id,
      lines: lines.map((l) => ({ accountId: l.accountId, debit: l.debit || undefined, credit: l.credit || undefined })),
      linkSource: async () => null,
    });
    entryId = result.entryId;
  } catch (err: any) {
    error = err?.message || "Could not save journal entry.";
  }

  if (error) redirect(`/journal-entries?error=${encodeURIComponent(error)}`);

  await logAudit({
    actorId: session.user.id,
    action: "create",
    entityType: "manual_journal_entry",
    entityId: entryId!,
    details: { entryDate, description, lines },
  });
  revalidatePath("/journal-entries");
  redirect("/journal-entries?success=1");
}

/**
 * Edits only the description field on a manual entry — no financial
 * data. Scoped to source_type = 'manual' so an auto-generated entry's
 * description (Expense/Payment/Income/Credit-note/Void postings) can
 * never be reached through this action. description is NOT NULL on
 * journal_entries, so (unlike the other entities' notes) it can be
 * shortened but not cleared to empty. Blocked once voided.
 */
export async function updateJournalEntryDescription(formData: FormData) {
  const session = await requirePermission(PERMISSIONS.MANAGE_JOURNAL_ENTRIES);
  const entryId = String(formData.get("entryId") ?? "");
  const newDescription = String(formData.get("description") ?? "").trim();

  if (!newDescription) {
    redirect(`/journal-entries?error=${encodeURIComponent("Description can't be empty.")}`);
  }

  const [entry] = await sql`
    SELECT id, description, voided_at FROM journal_entries WHERE id = ${entryId} AND source_type = 'manual'
  `;
  if (!entry) redirect(`/journal-entries?error=${encodeURIComponent("Journal entry not found.")}`);
  if (entry.voided_at) {
    redirect(`/journal-entries?error=${encodeURIComponent("Can't edit the description on a voided entry.")}`);
  }

  if (entry.description === newDescription) {
    redirect("/journal-entries?success=1");
  }

  let error: string | null = null;
  try {
    await sql`UPDATE journal_entries SET description = ${newDescription} WHERE id = ${entryId}`;
    await logAudit({
      actorId: session.user.id,
      action: "edit_notes",
      entityType: "manual_journal_entry",
      entityId: entryId,
      details: { field: "description", oldValue: entry.description, newValue: newDescription },
    });
  } catch (err: any) {
    error = err?.message || "Could not update description.";
  }

  if (error) redirect(`/journal-entries?error=${encodeURIComponent(error)}`);
  revalidatePath("/journal-entries");
  redirect("/journal-entries?success=1");
}

/**
 * Fixes a manual entry posted with the wrong date without editing it in
 * place — a date determines which reporting period a transaction lands
 * in, so it goes through void + repost like any other change with real
 * reporting consequences, not a raw edit. Same pattern as
 * reclassifyExpense/Income: void the original via the unchanged
 * voidJournalEntry mechanism, then post an identical replacement (same
 * accounts, same debits/credits, same description) dated today's
 * chosen new date, inside the same DB transaction — one atomic
 * operation, one audit_log entry.
 *
 * Unlike Reclassify, there's no business row to insert alongside the
 * new entry (a manual entry has none to begin with), so this only
 * needs journal_entries + journal_lines. The new entry's source_type
 * stays 'manual' — deliberately not a distinct value the way
 * Reclassify used 'reclassify' — because this page's own list query is
 * `WHERE source_type = 'manual'`; a different value would make the
 * corrected entry vanish from view instead of showing up corrected.
 */
export async function correctManualJournalEntryDate(formData: FormData) {
  const session = await requirePermission(PERMISSIONS.VOID_TRANSACTIONS);
  const entryId = String(formData.get("entryId") ?? "");
  const newDate = String(formData.get("newDate") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();

  if (!entryId || !newDate) {
    redirect(`/journal-entries?error=${encodeURIComponent("Choose a new date.")}`);
  }

  const [entry] = await sql`
    SELECT id, entry_date, description, voided_at FROM journal_entries WHERE id = ${entryId} AND source_type = 'manual'
  `;
  if (!entry) redirect(`/journal-entries?error=${encodeURIComponent("Journal entry not found.")}`);
  if (entry.voided_at) {
    redirect(`/journal-entries?error=${encodeURIComponent("Can't correct the date on a voided entry.")}`);
  }

  const oldDate = toISODate(entry.entry_date);
  if (oldDate === newDate) {
    redirect(`/journal-entries?error=${encodeURIComponent("Choose a different date to correct to.")}`);
  }

  const originalLines = await sql`SELECT account_id, debit, credit FROM journal_lines WHERE entry_id = ${entryId}`;

  let error: string | null = null;
  let newEntryId: number | undefined;
  try {
    await voidJournalEntry({
      originalEntryId: entry.id,
      reverseDescriptionPrefix: "Correct date",
      createdBy: session.user.id,
      updateSource: async (tx) => {
        const [newEntry] = await tx`
          INSERT INTO journal_entries (entry_date, description, source_type, source_id, created_by)
          VALUES (${newDate}, ${entry.description}, 'manual', NULL, ${session.user.id})
          RETURNING id
        `;
        for (const line of originalLines) {
          await tx`
            INSERT INTO journal_lines (entry_id, account_id, debit, credit)
            VALUES (${newEntry.id}, ${line.account_id}, ${line.debit}, ${line.credit})
          `;
        }
        newEntryId = newEntry.id;
      },
    });

    await logAudit({
      actorId: session.user.id,
      action: "correct_date",
      entityType: "manual_journal_entry",
      entityId: entryId,
      details: { oldDate, newDate, newEntryId, reason },
    });
  } catch (err: any) {
    error = err?.message || "Could not correct the entry's date.";
  }

  if (error) redirect(`/journal-entries?error=${encodeURIComponent(error)}`);
  revalidatePath("/journal-entries");
  redirect("/journal-entries?success=1");
}

export async function voidManualJournalEntry(formData: FormData) {
  const session = await requirePermission(PERMISSIONS.VOID_TRANSACTIONS);
  const entryId = String(formData.get("entryId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();

  const [entry] = await sql`SELECT id, voided_at FROM journal_entries WHERE id = ${entryId} AND source_type = 'manual'`;
  if (!entry) redirect(`/journal-entries?error=${encodeURIComponent("Journal entry not found.")}`);
  if (entry.voided_at) redirect(`/journal-entries?error=${encodeURIComponent("This entry is already voided.")}`);

  let error: string | null = null;
  try {
    await voidJournalEntry({
      originalEntryId: entry.id,
      reverseDescriptionPrefix: "Void manual journal entry",
      createdBy: session.user.id,
      updateSource: async () => {},
    });

    await logAudit({
      actorId: session.user.id,
      action: "void",
      entityType: "manual_journal_entry",
      entityId: entryId,
      details: { reason },
    });
  } catch (err: any) {
    error = err?.message || "Could not void journal entry.";
  }

  if (error) redirect(`/journal-entries?error=${encodeURIComponent(error)}`);
  revalidatePath("/journal-entries");
  redirect("/journal-entries?success=1");
}

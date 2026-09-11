import sql from "@/lib/db";
import { postJournalEntry } from "@/lib/journal";
import { todayISO } from "@/lib/reports/dates";
import type postgres from "postgres";

type Tx = postgres.TransactionSql;

/**
 * Reverses a posted journal entry: posts a new offsetting entry (every
 * line's debit/credit swapped) dated *today* — not the original entry's
 * date, so a correction never silently changes a prior period's
 * reported numbers — then marks the original entry voided in the same
 * transaction. The reversing entry's source_type is 'void' and its
 * source_id is the *original* journal_entries.id, so it's always
 * traceable which entry a given reversal undoes.
 *
 * `updateSource` runs in the same transaction and is where the caller
 * marks its own business record voided (and recomputes anything that
 * depended on it, e.g. an invoice's status after voiding a payment).
 */
export async function voidJournalEntry(params: {
  originalEntryId: number;
  reverseDescriptionPrefix: string;
  createdBy: string | number;
  updateSource: (tx: Tx) => Promise<void>;
}) {
  const [original] = await sql`
    SELECT entry_date, description, voided_at FROM journal_entries WHERE id = ${params.originalEntryId}
  `;
  if (!original) throw new Error("Journal entry not found.");
  if (original.voided_at) throw new Error("This has already been voided.");

  const originalLines = await sql`
    SELECT account_id, debit, credit FROM journal_lines WHERE entry_id = ${params.originalEntryId}
  `;
  if (originalLines.length === 0) throw new Error("Original journal entry has no lines.");

  return postJournalEntry({
    entryDate: todayISO(),
    description: `${params.reverseDescriptionPrefix} — reversal of: ${original.description}`,
    sourceType: "void",
    createdBy: params.createdBy,
    lines: originalLines.map((l: any) => ({
      accountId: l.account_id,
      debit: Number(l.credit),
      credit: Number(l.debit),
    })),
    linkSource: async (tx) => {
      await tx`
        UPDATE journal_entries SET voided_at = now(), voided_by = ${params.createdBy}
        WHERE id = ${params.originalEntryId}
      `;
      await params.updateSource(tx);
      return params.originalEntryId;
    },
  });
}

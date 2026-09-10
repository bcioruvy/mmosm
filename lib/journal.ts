import sql from "@/lib/db";
import type postgres from "postgres";

type Tx = postgres.TransactionSql;

/**
 * Posts a balanced journal entry and links it back to the business record
 * that caused it, in one DB transaction:
 *   1. insert journal_entries (source_id left null for a moment)
 *   2. insert journal_lines (the balance-enforcing trigger on this table
 *      is deferred to commit, per the DB — don't split this across
 *      multiple transactions)
 *   3. call linkSource() to insert/update the caller's own row (which
 *      needs journal_entry_id) and return its id
 *   4. update journal_entries.source_id to that id
 *
 * Throws before touching the DB if the lines don't balance — the DB
 * trigger is still the real enforcement, this is just a clearer error
 * than a raised Postgres exception.
 */
export async function postJournalEntry<T>(params: {
  entryDate: string;
  description: string;
  sourceType: string;
  createdBy: string | number;
  lines: { accountId: string | number; debit?: number; credit?: number }[];
  linkSource: (tx: Tx, journalEntryId: number) => Promise<T>;
}): Promise<{ entryId: number; sourceId: T }> {
  const totalDebit = params.lines.reduce((sum, l) => sum + (l.debit ?? 0), 0);
  const totalCredit = params.lines.reduce((sum, l) => sum + (l.credit ?? 0), 0);
  if (Math.round(totalDebit * 100) !== Math.round(totalCredit * 100)) {
    throw new Error(`Journal entry is not balanced: debits=${totalDebit}, credits=${totalCredit}`);
  }

  return sql.begin(async (tx) => {
    const [entry] = await tx`
      INSERT INTO journal_entries (entry_date, description, source_type, source_id, created_by)
      VALUES (${params.entryDate}, ${params.description}, ${params.sourceType}, NULL, ${params.createdBy})
      RETURNING id
    `;

    for (const line of params.lines) {
      await tx`
        INSERT INTO journal_lines (entry_id, account_id, debit, credit)
        VALUES (${entry.id}, ${line.accountId}, ${line.debit ?? 0}, ${line.credit ?? 0})
      `;
    }

    const sourceId = await params.linkSource(tx, entry.id);
    await tx`UPDATE journal_entries SET source_id = ${sourceId as any} WHERE id = ${entry.id}`;

    return { entryId: entry.id, sourceId };
  });
}

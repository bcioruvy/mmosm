import sql from "@/lib/db";

/**
 * Journal lines posted on or before a date.
 *
 * Deliberately does NOT filter out voided entries. Voiding here works by
 * posting a new offsetting entry, never editing or deleting the
 * original — so a voided entry's debits/credits are still real history
 * that must stay counted for the period it happened in. The reversal
 * entry (dated when the void happened) is what brings the net effect to
 * zero from that point on; excluding the original instead would rewrite
 * closed periods and leave the reversal's side uncancelled.
 * journal_entries.voided_at is informational only (traceability, and
 * stopping double-voids) — never a report filter.
 */
export function journalLinesThroughDate(asOf: string) {
  return sql`
    SELECT jl.account_id, jl.debit, jl.credit
    FROM journal_lines jl
    JOIN journal_entries je ON je.id = jl.entry_id
    WHERE je.entry_date <= ${asOf}
  `;
}

/** Journal lines posted within a date range (inclusive). See journalLinesThroughDate for why voided entries are not excluded. */
export function journalLinesInRange(start: string, end: string) {
  return sql`
    SELECT jl.account_id, jl.debit, jl.credit
    FROM journal_lines jl
    JOIN journal_entries je ON je.id = jl.entry_id
    WHERE je.entry_date BETWEEN ${start} AND ${end}
  `;
}

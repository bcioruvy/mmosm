import sql from "@/lib/db";

/** Journal lines posted on or before a date, excluding voided entries. */
export function journalLinesThroughDate(asOf: string) {
  return sql`
    SELECT jl.account_id, jl.debit, jl.credit
    FROM journal_lines jl
    JOIN journal_entries je ON je.id = jl.entry_id
    WHERE je.voided_at IS NULL AND je.entry_date <= ${asOf}
  `;
}

/** Journal lines posted within a date range (inclusive), excluding voided entries. */
export function journalLinesInRange(start: string, end: string) {
  return sql`
    SELECT jl.account_id, jl.debit, jl.credit
    FROM journal_lines jl
    JOIN journal_entries je ON je.id = jl.entry_id
    WHERE je.voided_at IS NULL AND je.entry_date BETWEEN ${start} AND ${end}
  `;
}

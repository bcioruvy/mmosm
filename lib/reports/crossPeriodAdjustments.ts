import sql from "@/lib/db";

export type CrossPeriodAdjustment = {
  accountId: number;
  accountCode: string;
  accountName: string;
  /** Signed debit − credit, as it nets into this period's subtotal — i.e. exactly the one-sided amount. */
  amount: number;
  reversalDate: string;
  originalDate: string;
  originalDescription: string;
};

/**
 * Finds void reversals dated inside [start, end] whose original entry is
 * dated outside it — either before start or after end (NOT BETWEEN
 * covers both symmetrically).
 *
 * A void never edits the original; it posts a new offsetting entry dated
 * the day the void happened (see lib/voidTransaction.ts). Range-based
 * reports (Profit & Loss, and the Dashboard's period figures) have no
 * opening balance — unlike Trial Balance/Balance Sheet (as-of, so a void
 * pair always resolves by any asOf on or after it happened) and General
 * Ledger (carries an explicit opening balance) — so when a pair like
 * this straddles the range boundary, only one side lands in the query,
 * making that account's period subtotal look one-sided. The subtotal is
 * still mathematically correct (it's a real transaction that really
 * happened inside this period); this just surfaces *why*, instead of
 * letting it read as a sign bug.
 */
export async function findCrossPeriodAdjustments(start: string, end: string): Promise<CrossPeriodAdjustment[]> {
  const rows = await sql`
    SELECT
      jl.account_id, a.code AS account_code, a.name AS account_name,
      jl.debit, jl.credit,
      reversal.entry_date AS reversal_date,
      original.entry_date AS original_date,
      original.description AS original_description
    FROM journal_entries reversal
    JOIN journal_entries original ON original.id = reversal.source_id
    JOIN journal_lines jl ON jl.entry_id = reversal.id
    JOIN accounts a ON a.id = jl.account_id
    WHERE reversal.source_type = 'void'
      AND reversal.entry_date BETWEEN ${start} AND ${end}
      AND original.entry_date NOT BETWEEN ${start} AND ${end}
    ORDER BY a.code, reversal.entry_date
  `;

  return rows.map((r: any) => ({
    accountId: r.account_id,
    accountCode: r.account_code,
    accountName: r.account_name,
    amount: Number(r.debit) - Number(r.credit),
    reversalDate: r.reversal_date,
    originalDate: r.original_date,
    originalDescription: r.original_description,
  }));
}

/** Cheaper existence check for callers that only need a flag (e.g. one bar in a trend chart). */
export async function hasCrossPeriodAdjustments(start: string, end: string): Promise<boolean> {
  const [row] = await sql`
    SELECT EXISTS (
      SELECT 1
      FROM journal_entries reversal
      JOIN journal_entries original ON original.id = reversal.source_id
      WHERE reversal.source_type = 'void'
        AND reversal.entry_date BETWEEN ${start} AND ${end}
        AND original.entry_date NOT BETWEEN ${start} AND ${end}
    ) AS exists
  `;
  return row.exists as boolean;
}

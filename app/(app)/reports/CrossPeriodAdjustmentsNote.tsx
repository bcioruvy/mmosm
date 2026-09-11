import { formatCurrency } from "@/lib/currency";
import type { CrossPeriodAdjustment } from "@/lib/reports/crossPeriodAdjustments";

/**
 * Explains an account subtotal that looks one-sided because a void's
 * reversal (dated when the void happened) fell inside this period while
 * the original transaction it corrects didn't. See
 * lib/reports/crossPeriodAdjustments.ts for the full reasoning.
 */
export default function CrossPeriodAdjustmentsNote({ adjustments }: { adjustments: CrossPeriodAdjustment[] }) {
  if (adjustments.length === 0) return null;

  return (
    <div
      style={{
        background: "var(--color-warning-bg)",
        border: "1px solid var(--color-warning)",
        borderRadius: 6,
        padding: "12px 16px",
        marginBottom: 24,
        fontSize: "0.9em",
      }}
    >
      <p style={{ margin: 0, fontWeight: 600, color: "var(--color-warning)" }}>
        {adjustments.length} correction{adjustments.length > 1 ? "s" : ""} in this period correct
        {adjustments.length === 1 ? "s" : ""} a transaction dated outside it
      </p>
      <p style={{ margin: "4px 0 8px", color: "var(--color-text-muted)" }}>
        Voiding posts a new offsetting entry dated the day it happened, not the original transaction's date. When
        the original falls outside this date range, only the correction shows up here — the figures below are
        still correct, just one-sided for that account. Widen the range to cover both dates to see them net out.
      </p>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ textAlign: "left" }}>
            <th>Account</th>
            <th style={{ textAlign: "right" }}>Amount this period</th>
            <th>Correction dated</th>
            <th>Corrects transaction dated</th>
          </tr>
        </thead>
        <tbody>
          {adjustments.map((a, i) => (
            <tr key={i}>
              <td>
                {a.accountCode} — {a.accountName}
              </td>
              <td style={{ textAlign: "right" }}>{formatCurrency(a.amount)}</td>
              <td>{new Date(a.reversalDate).toLocaleDateString()}</td>
              <td>
                {new Date(a.originalDate).toLocaleDateString()} ({a.originalDescription})
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

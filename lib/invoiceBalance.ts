import sql from "@/lib/db";
import type postgres from "postgres";

type Executor = postgres.Sql<{}> | postgres.TransactionSql;

/**
 * How much of an invoice is still owed and how much of what's been paid
 * could still be refunded in cash — accounting for both real payments
 * and credit notes (which reduce the balance two different ways
 * depending on whether they applied to the balance owed or refunded
 * cash already received). Voided payments/credit notes never count.
 *
 * Accepts an optional transaction handle so it can participate in a
 * caller's transaction (e.g. a void action recomputing an invoice's
 * status) instead of always running against a fresh connection.
 */
export async function getInvoiceBalance(invoiceId: string | number, executor: Executor = sql) {
  const [{ total }] = await executor`
    SELECT COALESCE(SUM(line_total), 0) AS total FROM invoice_lines WHERE invoice_id = ${invoiceId}
  `;
  const [{ paid }] = await executor`
    SELECT COALESCE(SUM(amount), 0) AS paid FROM payments
    WHERE applied_to_type = 'invoice' AND applied_to_id = ${invoiceId} AND voided_at IS NULL
  `;
  const [{ credited_to_ar }] = await executor`
    SELECT COALESCE(SUM(amount), 0) AS credited_to_ar FROM credit_notes
    WHERE invoice_id = ${invoiceId} AND refund_account_id IS NULL AND voided_at IS NULL
  `;
  const [{ cash_refunded }] = await executor`
    SELECT COALESCE(SUM(amount), 0) AS cash_refunded FROM credit_notes
    WHERE invoice_id = ${invoiceId} AND refund_account_id IS NOT NULL AND voided_at IS NULL
  `;

  const totalNum = Number(total);
  const paidNum = Number(paid);
  const creditedToARNum = Number(credited_to_ar);
  const cashRefundedNum = Number(cash_refunded);

  return {
    total: totalNum,
    paid: paidNum,
    creditedToAR: creditedToARNum,
    cashRefunded: cashRefundedNum,
    remainingOwed: Math.round((totalNum - paidNum - creditedToARNum) * 100) / 100,
    refundableCash: Math.round((paidNum - cashRefundedNum) * 100) / 100,
  };
}

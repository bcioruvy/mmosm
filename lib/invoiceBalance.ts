import sql from "@/lib/db";

/**
 * How much of an invoice is still owed and how much of what's been paid
 * could still be refunded in cash — accounting for both real payments
 * and credit notes (which reduce the balance two different ways
 * depending on whether they applied to the balance owed or refunded
 * cash already received).
 */
export async function getInvoiceBalance(invoiceId: string | number) {
  const [{ total }] = await sql`
    SELECT COALESCE(SUM(line_total), 0) AS total FROM invoice_lines WHERE invoice_id = ${invoiceId}
  `;
  const [{ paid }] = await sql`
    SELECT COALESCE(SUM(amount), 0) AS paid FROM payments WHERE applied_to_type = 'invoice' AND applied_to_id = ${invoiceId}
  `;
  const [{ credited_to_ar }] = await sql`
    SELECT COALESCE(SUM(amount), 0) AS credited_to_ar FROM credit_notes
    WHERE invoice_id = ${invoiceId} AND refund_account_id IS NULL
  `;
  const [{ cash_refunded }] = await sql`
    SELECT COALESCE(SUM(amount), 0) AS cash_refunded FROM credit_notes
    WHERE invoice_id = ${invoiceId} AND refund_account_id IS NOT NULL
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

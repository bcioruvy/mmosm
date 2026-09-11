import sql from "@/lib/db";
import type postgres from "postgres";

type Executor = postgres.Sql<{}> | postgres.TransactionSql;

/**
 * How much of an on-credit expense (bill) is still owed. Mirrors
 * getInvoiceBalance's shape. Only meaningful for expenses that went
 * through Accounts Payable (payment_status started as 'unpaid') — an
 * expense paid in full at creation never posts to AP or into the
 * payments table, so it has nothing to compute a balance from and
 * should never reach this helper (callers gate on payment_status
 * being 'unpaid'/'partial' before calling).
 *
 * Accepts an optional transaction handle so it can participate in a
 * caller's transaction (e.g. a void action recomputing an expense's
 * status) instead of always running against a fresh connection.
 */
export async function getExpenseBalance(expenseId: string | number, executor: Executor = sql) {
  const [{ amount }] = await executor`SELECT amount FROM expenses WHERE id = ${expenseId}`;
  const [{ paid }] = await executor`
    SELECT COALESCE(SUM(amount), 0) AS paid FROM payments
    WHERE applied_to_type = 'expense' AND applied_to_id = ${expenseId} AND voided_at IS NULL
  `;

  const amountNum = Number(amount);
  const paidNum = Number(paid);

  return {
    amount: amountNum,
    paid: paidNum,
    remainingOwed: Math.round((amountNum - paidNum) * 100) / 100,
  };
}

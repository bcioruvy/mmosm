import { auth } from "@/auth";
import sql from "@/lib/db";
import { redirect } from "next/navigation";
import { PERMISSIONS } from "@/lib/permissions";
import { getCashOrBankAccounts } from "@/lib/controlAccounts";
import { formatCurrency } from "@/lib/currency";
import { Fragment } from "react";
import { createExpense, voidExpense, updateExpenseNotes, reclassifyExpense } from "./actions";
import { recordExpensePayment } from "../payments/actions";
import { Receipt, CreditCard, Ban, Plus, ArrowRightLeft } from "lucide-react";
import InlineEditField from "../InlineEditField";
import Disclosure from "../Disclosure";
import HideVoidedToggle from "../HideVoidedToggle";

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: { error?: string; success?: string; showVoided?: string };
}) {
  const session = await auth();
  const permissions = session?.user?.permissions ?? [];
  if (!session?.user || !permissions.includes(PERMISSIONS.MANAGE_TRANSACTIONS)) {
    redirect("/");
  }
  const canVoid = permissions.includes(PERMISSIONS.VOID_TRANSACTIONS);

  const [expensesRaw, categoryAccounts, vendors, cashAccounts] = await Promise.all([
    sql`
      SELECT e.id, e.expense_date, e.amount, e.payment_status, e.notes, e.voided_at,
        e.category_account_id, cat.code AS category_code, cat.name AS category_name,
        v.name AS vendor_name,
        pay.code AS payment_code, pay.name AS payment_name,
        COALESCE(p.paid, 0) AS paid
      FROM expenses e
      JOIN accounts cat ON cat.id = e.category_account_id
      LEFT JOIN vendors v ON v.id = e.vendor_id
      LEFT JOIN accounts pay ON pay.id = e.payment_account_id
      LEFT JOIN (
        SELECT applied_to_id, SUM(amount) AS paid FROM payments
        WHERE applied_to_type = 'expense' AND voided_at IS NULL
        GROUP BY applied_to_id
      ) p ON p.applied_to_id = e.id
      ORDER BY e.expense_date DESC, e.id DESC
    `,
    sql`SELECT id, code, name FROM accounts WHERE is_active = true AND type IN ('expense', 'cogs') ORDER BY code`,
    sql`SELECT id, name FROM vendors WHERE is_active = true ORDER BY name`,
    getCashOrBankAccounts(),
  ]);

  const expenses = expensesRaw.map((e: any) => ({
    ...e,
    remaining: Math.round((Number(e.amount) - Number(e.paid)) * 100) / 100,
  }));

  const showVoided = searchParams.showVoided === "1";
  const visibleExpenses = showVoided ? expenses : expenses.filter((e: any) => !e.voided_at);
  const hiddenCount = expenses.length - visibleExpenses.length;

  return (
    <main className="max-w-screen-2xl px-6 py-10">
      <h1 className="flex items-center gap-2 text-2xl font-bold">
        <Receipt className="h-6 w-6 text-brand" />
        Expenses
      </h1>
      {searchParams.error && <p className="mt-3 text-sm font-medium text-error">{searchParams.error}</p>}
      {searchParams.success && <p className="mt-3 text-sm font-medium text-success">Done.</p>}

      <div className="mt-3">
        <HideVoidedToggle showVoided={showVoided} hiddenCount={hiddenCount} />
      </div>

      {cashAccounts.length === 0 && (
        <p className="mt-3 text-sm font-medium text-error">
          No account is tagged "Cash or Bank" yet — go to <a href="/accounts">Chart of Accounts</a> and
          tag at least one before recording a paid expense. On-credit (bill) expenses still work without
          one.
        </p>
      )}

      <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-surface p-5 shadow-sm">
        <table className="w-full min-w-[800px] border-collapse">
          <thead>
            <tr className="border-b text-left">
              <th>Date</th>
              <th>Category</th>
              <th>Vendor</th>
              <th>Amount</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {visibleExpenses.map((e: any) => (
              <Fragment key={e.id}>
                <tr className="border-b" style={{ opacity: e.voided_at ? 0.5 : 1 }}>
                  <td className="pt-3">{new Date(e.expense_date).toLocaleDateString()}</td>
                  <td className="pt-3">
                    {e.category_code} — {e.category_name}
                  </td>
                  <td className="pt-3">{e.vendor_name ?? "—"}</td>
                  <td className="pt-3">{formatCurrency(Number(e.amount))}</td>
                  <td className="pt-3">
                    {e.voided_at
                      ? "Voided"
                      : e.payment_status === "paid"
                        ? e.payment_code
                          ? `Paid (${e.payment_code} ${e.payment_name})`
                          : "Paid"
                        : e.payment_status === "partial"
                          ? `Partial — ${formatCurrency(e.remaining)} owed`
                          : "Unpaid (bill)"}
                  </td>
                </tr>
                <tr className="border-b" style={{ opacity: e.voided_at ? 0.5 : 1 }}>
                  <td colSpan={5} className="pb-3 pt-1">
                    {e.voided_at ? (
                      <span className="text-sm text-muted">{e.notes ?? ""}</span>
                    ) : (
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <InlineEditField
                          action={updateExpenseNotes}
                          hiddenFields={{ expenseId: e.id }}
                          fieldName="notes"
                          value={e.notes ?? null}
                          placeholder="Notes"
                        />
                        <div className="flex flex-wrap items-center gap-3">
                          {(e.payment_status === "unpaid" || e.payment_status === "partial") &&
                            cashAccounts.length > 0 && (
                              <Disclosure label="Pay" icon={<CreditCard className="h-3.5 w-3.5" />}>
                                <form action={recordExpensePayment} className="flex flex-wrap items-center gap-1.5">
                                  <input type="hidden" name="expenseId" value={e.id} />
                                  <input name="paymentDate" type="date" required style={{ width: 130 }} />
                                  <select name="accountId" required defaultValue="">
                                    <option value="" disabled>
                                      Pay from…
                                    </option>
                                    {cashAccounts.map((a: any) => (
                                      <option key={a.id} value={a.id}>
                                        {a.code} — {a.name}
                                      </option>
                                    ))}
                                  </select>
                                  <input
                                    name="amount"
                                    type="number"
                                    step="0.01"
                                    min="0.01"
                                    max={e.remaining}
                                    defaultValue={e.remaining}
                                    placeholder="Amount"
                                    required
                                    style={{ width: 90 }}
                                  />
                                  <button type="submit" className="text-xs">
                                    Confirm
                                  </button>
                                </form>
                              </Disclosure>
                            )}
                          {canVoid && Number(e.paid) === 0 && (
                            <Disclosure label="Reclassify" icon={<ArrowRightLeft className="h-3.5 w-3.5" />}>
                              <form action={reclassifyExpense} className="flex flex-wrap items-center gap-1.5">
                                <input type="hidden" name="expenseId" value={e.id} />
                                <select name="newCategoryAccountId" required defaultValue="">
                                  <option value="" disabled>
                                    Reclassify to…
                                  </option>
                                  {categoryAccounts
                                    .filter((a: any) => a.id !== e.category_account_id)
                                    .map((a: any) => (
                                      <option key={a.id} value={a.id}>
                                        {a.code} — {a.name}
                                      </option>
                                    ))}
                                </select>
                                <input name="reason" placeholder="Reason (optional)" style={{ width: 130 }} />
                                <button type="submit" className="text-xs">
                                  Confirm
                                </button>
                              </form>
                            </Disclosure>
                          )}
                          {canVoid && (
                            <Disclosure label="Void" icon={<Ban className="h-3.5 w-3.5" />}>
                              <form action={voidExpense} className="flex flex-wrap items-center gap-1.5">
                                <input type="hidden" name="expenseId" value={e.id} />
                                <input name="reason" placeholder="Reason (optional)" style={{ width: 130 }} />
                                <button type="submit" className="text-xs">
                                  Confirm
                                </button>
                              </form>
                            </Disclosure>
                          )}
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 rounded-xl border border-border bg-surface p-5 shadow-sm">
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
          <Plus className="h-4 w-4 text-brand" />
          Add expense
        </h2>
        <form action={createExpense} className="flex flex-wrap items-center gap-2">
          <input name="expenseDate" type="date" required />
          <select name="categoryAccountId" required defaultValue="">
            <option value="" disabled>
              Category…
            </option>
            {categoryAccounts.map((a: any) => (
              <option key={a.id} value={a.id}>
                {a.code} — {a.name}
              </option>
            ))}
          </select>
          <select name="vendorId" defaultValue="">
            <option value="">No vendor</option>
            {vendors.map((v: any) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
          <input name="amount" type="number" step="0.01" min="0.01" placeholder="Amount" required />
          <select name="paymentChoice" required defaultValue="">
            <option value="" disabled>
              Payment method…
            </option>
            {cashAccounts.map((a: any) => (
              <option key={a.id} value={a.id}>
                {a.code} — {a.name}
              </option>
            ))}
            <option value="on_credit">On credit (bill — pay later)</option>
          </select>
          <label className="flex items-center gap-2 text-sm text-muted">
            Due date (bills only) <input name="dueDate" type="date" />
          </label>
          <input name="notes" placeholder="Notes" />
          <button type="submit">Add</button>
        </form>
      </div>
    </main>
  );
}

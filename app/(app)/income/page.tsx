import { auth } from "@/auth";
import sql from "@/lib/db";
import { redirect } from "next/navigation";
import { PERMISSIONS } from "@/lib/permissions";
import { getCashOrBankAccounts } from "@/lib/controlAccounts";
import { formatCurrency } from "@/lib/currency";
import { Fragment } from "react";
import { createIncome, voidIncome, updateIncomeNotes, reclassifyIncome } from "./actions";
import { TrendingUp, Ban, Plus, ArrowRightLeft } from "lucide-react";
import InlineEditField from "../InlineEditField";
import Disclosure from "../Disclosure";

export default async function IncomePage({
  searchParams,
}: {
  searchParams: { error?: string; success?: string };
}) {
  const session = await auth();
  const permissions = session?.user?.permissions ?? [];
  if (!session?.user || !permissions.includes(PERMISSIONS.MANAGE_TRANSACTIONS)) {
    redirect("/");
  }
  const canVoid = permissions.includes(PERMISSIONS.VOID_TRANSACTIONS);

  const [income, categoryAccounts, cashAccounts] = await Promise.all([
    sql`
      SELECT i.id, i.income_date, i.amount, i.source, i.notes, i.voided_at,
        i.category_account_id, cat.code AS category_code, cat.name AS category_name,
        pay.code AS payment_code, pay.name AS payment_name
      FROM income i
      JOIN accounts cat ON cat.id = i.category_account_id
      JOIN accounts pay ON pay.id = i.payment_account_id
      ORDER BY i.income_date DESC, i.id DESC
    `,
    sql`SELECT id, code, name FROM accounts WHERE is_active = true AND type = 'revenue' ORDER BY code`,
    getCashOrBankAccounts(),
  ]);

  return (
    <main className="max-w-screen-2xl px-6 py-10">
      <h1 className="flex items-center gap-2 text-2xl font-bold">
        <TrendingUp className="h-6 w-6 text-brand" />
        Income
      </h1>
      {searchParams.error && <p className="mt-3 text-sm font-medium text-error">{searchParams.error}</p>}
      {searchParams.success && <p className="mt-3 text-sm font-medium text-success">Done.</p>}

      {cashAccounts.length === 0 && (
        <p className="mt-3 text-sm font-medium text-error">
          No account is tagged "Cash or Bank" yet — go to <a href="/accounts">Chart of Accounts</a> and tag
          at least one before recording income.
        </p>
      )}

      <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-surface p-5 shadow-sm">
        <table className="w-full min-w-[800px] border-collapse">
          <thead>
            <tr className="border-b text-left">
              <th>Date</th>
              <th>Category</th>
              <th>Source</th>
              <th>Amount</th>
              <th>Received into</th>
            </tr>
          </thead>
          <tbody>
            {income.map((i: any) => (
              <Fragment key={i.id}>
                <tr className="border-b" style={{ opacity: i.voided_at ? 0.5 : 1 }}>
                  <td className="pt-3">{new Date(i.income_date).toLocaleDateString()}</td>
                  <td className="pt-3">
                    {i.category_code} — {i.category_name}
                  </td>
                  <td className="pt-3">{i.source ?? ""}</td>
                  <td className="pt-3">{formatCurrency(Number(i.amount))}</td>
                  <td className="pt-3">{i.voided_at ? "Voided" : `${i.payment_code} — ${i.payment_name}`}</td>
                </tr>
                <tr className="border-b" style={{ opacity: i.voided_at ? 0.5 : 1 }}>
                  <td colSpan={5} className="pb-3 pt-1">
                    {i.voided_at ? (
                      <span className="text-sm text-muted">{i.notes ?? ""}</span>
                    ) : (
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <InlineEditField
                          action={updateIncomeNotes}
                          hiddenFields={{ incomeId: i.id }}
                          fieldName="notes"
                          value={i.notes ?? null}
                          placeholder="Notes"
                        />
                        <div className="flex flex-wrap items-center gap-3">
                          {canVoid && (
                            <Disclosure label="Reclassify" icon={<ArrowRightLeft className="h-3.5 w-3.5" />}>
                              <form action={reclassifyIncome} className="flex flex-wrap items-center gap-1.5">
                                <input type="hidden" name="incomeId" value={i.id} />
                                <select name="newCategoryAccountId" required defaultValue="">
                                  <option value="" disabled>
                                    Reclassify to…
                                  </option>
                                  {categoryAccounts
                                    .filter((a: any) => a.id !== i.category_account_id)
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
                              <form action={voidIncome} className="flex flex-wrap items-center gap-1.5">
                                <input type="hidden" name="incomeId" value={i.id} />
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
          Add income
        </h2>
        <form action={createIncome} className="flex flex-wrap items-center gap-2">
          <input name="incomeDate" type="date" required />
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
          <input name="source" placeholder="Source (who/what)" />
          <input name="amount" type="number" step="0.01" min="0.01" placeholder="Amount" required />
          <select name="paymentAccountId" required defaultValue="">
            <option value="" disabled>
              Received into…
            </option>
            {cashAccounts.map((a: any) => (
              <option key={a.id} value={a.id}>
                {a.code} — {a.name}
              </option>
            ))}
          </select>
          <input name="notes" placeholder="Notes" />
          <button type="submit">Add</button>
        </form>
      </div>
    </main>
  );
}

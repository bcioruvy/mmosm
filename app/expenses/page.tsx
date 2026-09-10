import { auth } from "@/auth";
import sql from "@/lib/db";
import { redirect } from "next/navigation";
import { PERMISSIONS } from "@/lib/permissions";
import { getCashOrBankAccounts } from "@/lib/controlAccounts";
import { formatCurrency } from "@/lib/currency";
import { createExpense } from "./actions";
import { payExpense } from "../payments/actions";

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: { error?: string; success?: string };
}) {
  const session = await auth();
  const permissions = session?.user?.permissions ?? [];
  if (!session?.user || !permissions.includes(PERMISSIONS.MANAGE_TRANSACTIONS)) {
    redirect("/");
  }

  const [expenses, categoryAccounts, vendors, cashAccounts] = await Promise.all([
    sql`
      SELECT e.id, e.expense_date, e.amount, e.payment_status, e.notes,
        cat.code AS category_code, cat.name AS category_name,
        v.name AS vendor_name,
        pay.code AS payment_code, pay.name AS payment_name
      FROM expenses e
      JOIN accounts cat ON cat.id = e.category_account_id
      LEFT JOIN vendors v ON v.id = e.vendor_id
      LEFT JOIN accounts pay ON pay.id = e.payment_account_id
      ORDER BY e.expense_date DESC, e.id DESC
    `,
    sql`SELECT id, code, name FROM accounts WHERE is_active = true AND type IN ('expense', 'cogs') ORDER BY code`,
    sql`SELECT id, name FROM vendors WHERE is_active = true ORDER BY name`,
    getCashOrBankAccounts(),
  ]);

  return (
    <main style={{ maxWidth: 1000, margin: "40px auto", padding: 24 }}>
      <p>
        <a href="/">&larr; Home</a>
      </p>
      <h1>Expenses</h1>
      {searchParams.error && <p style={{ color: "#b00020" }}>{searchParams.error}</p>}
      {searchParams.success && <p style={{ color: "#1b7a3d" }}>Expense saved.</p>}

      {cashAccounts.length === 0 && (
        <p style={{ color: "#b00020" }}>
          No account is tagged "Cash or Bank" yet — go to{" "}
          <a href="/accounts">Chart of Accounts</a> and tag at least one before recording a paid
          expense. On-credit (bill) expenses still work without one.
        </p>
      )}

      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 16 }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>
            <th>Date</th>
            <th>Category</th>
            <th>Vendor</th>
            <th>Amount</th>
            <th>Status</th>
            <th>Notes</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {expenses.map((e: any) => (
            <tr key={e.id} style={{ borderBottom: "1px solid #eee" }}>
              <td>{new Date(e.expense_date).toLocaleDateString()}</td>
              <td>
                {e.category_code} — {e.category_name}
              </td>
              <td>{e.vendor_name ?? "—"}</td>
              <td>{formatCurrency(Number(e.amount))}</td>
              <td>
                {e.payment_status === "paid" ? `Paid (${e.payment_code} ${e.payment_name})` : "Unpaid (bill)"}
              </td>
              <td>{e.notes ?? ""}</td>
              <td>
                {e.payment_status === "unpaid" && cashAccounts.length > 0 && (
                  <form action={payExpense} style={{ display: "flex", gap: 4 }}>
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
                    <button type="submit">Pay</button>
                  </form>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 style={{ marginTop: 32 }}>Add expense</h2>
      <form action={createExpense} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
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
        <input name="notes" placeholder="Notes" />
        <button type="submit">Add</button>
      </form>
    </main>
  );
}

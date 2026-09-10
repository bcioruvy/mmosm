import { auth } from "@/auth";
import sql from "@/lib/db";
import { redirect } from "next/navigation";
import { PERMISSIONS } from "@/lib/permissions";
import { getCashOrBankAccounts } from "@/lib/controlAccounts";
import { createIncome } from "./actions";

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

  const [income, categoryAccounts, cashAccounts] = await Promise.all([
    sql`
      SELECT i.id, i.income_date, i.amount, i.source, i.notes,
        cat.code AS category_code, cat.name AS category_name,
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
    <main style={{ maxWidth: 1000, margin: "40px auto", padding: 24 }}>
      <p>
        <a href="/">&larr; Home</a>
      </p>
      <h1>Income</h1>
      {searchParams.error && <p style={{ color: "#b00020" }}>{searchParams.error}</p>}
      {searchParams.success && <p style={{ color: "#1b7a3d" }}>Income saved.</p>}

      {cashAccounts.length === 0 && (
        <p style={{ color: "#b00020" }}>
          No account is tagged "Cash or Bank" yet — go to <a href="/accounts">Chart of Accounts</a>{" "}
          and tag at least one before recording income.
        </p>
      )}

      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 16 }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>
            <th>Date</th>
            <th>Category</th>
            <th>Source</th>
            <th>Amount</th>
            <th>Received into</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          {income.map((i: any) => (
            <tr key={i.id} style={{ borderBottom: "1px solid #eee" }}>
              <td>{new Date(i.income_date).toLocaleDateString()}</td>
              <td>
                {i.category_code} — {i.category_name}
              </td>
              <td>{i.source ?? ""}</td>
              <td>${Number(i.amount).toFixed(2)}</td>
              <td>
                {i.payment_code} — {i.payment_name}
              </td>
              <td>{i.notes ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 style={{ marginTop: 32 }}>Add income</h2>
      <form action={createIncome} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
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
    </main>
  );
}

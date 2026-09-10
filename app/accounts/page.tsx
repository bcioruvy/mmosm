import { auth } from "@/auth";
import sql from "@/lib/db";
import { redirect } from "next/navigation";
import { PERMISSIONS } from "@/lib/permissions";
import { createAccount, updateAccount, setAccountActive, setAccountSystemRole } from "./actions";

const ACCOUNT_TYPES = ["asset", "liability", "equity", "revenue", "cogs", "expense"];
const SYSTEM_ROLES = [
  { value: "", label: "—" },
  { value: "accounts_receivable", label: "Accounts Receivable" },
  { value: "accounts_payable", label: "Accounts Payable" },
  { value: "cash_or_bank", label: "Cash or Bank" },
];

export default async function AccountsPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const session = await auth();
  const permissions = session?.user?.permissions ?? [];
  if (!session?.user || !permissions.includes(PERMISSIONS.MANAGE_ACCOUNTS)) {
    redirect("/");
  }

  const accounts = await sql`
    SELECT id, code, name, type, is_active, system_role FROM accounts ORDER BY code
  `;

  return (
    <main style={{ maxWidth: 900, margin: "40px auto", padding: 24 }}>
      <p>
        <a href="/">&larr; Home</a>
      </p>
      <h1>Chart of Accounts</h1>
      {searchParams.error && <p style={{ color: "#b00020" }}>{searchParams.error}</p>}

      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 16 }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>
            <th>Code</th>
            <th>Name / Type</th>
            <th>Status</th>
            <th>Role</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {accounts.map((a: any) => (
            <tr key={a.id} style={{ borderBottom: "1px solid #eee", opacity: a.is_active ? 1 : 0.5 }}>
              <td>{a.code}</td>
              <td>
                <form action={updateAccount} style={{ display: "flex", gap: 8 }}>
                  <input type="hidden" name="id" value={a.id} />
                  <input name="name" defaultValue={a.name} required />
                  <select name="type" defaultValue={a.type}>
                    {ACCOUNT_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <button type="submit">Save</button>
                </form>
              </td>
              <td>{a.is_active ? "Active" : "Inactive"}</td>
              <td>
                <form action={setAccountSystemRole} style={{ display: "flex", gap: 8 }}>
                  <input type="hidden" name="id" value={a.id} />
                  <select name="systemRole" defaultValue={a.system_role ?? ""}>
                    {SYSTEM_ROLES.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                  <button type="submit">Save</button>
                </form>
              </td>
              <td>
                <form action={setAccountActive}>
                  <input type="hidden" name="id" value={a.id} />
                  <input type="hidden" name="isActive" value={(!a.is_active).toString()} />
                  <button type="submit">{a.is_active ? "Deactivate" : "Reactivate"}</button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 style={{ marginTop: 32 }}>Add account</h2>
      <form action={createAccount} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input name="code" placeholder="Code" required style={{ width: 80 }} />
        <input name="name" placeholder="Name" required />
        <select name="type" required defaultValue="">
          <option value="" disabled>
            Type…
          </option>
          {ACCOUNT_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <button type="submit">Add</button>
      </form>
    </main>
  );
}

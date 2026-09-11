import { auth } from "@/auth";
import sql from "@/lib/db";
import { redirect } from "next/navigation";
import { PERMISSIONS } from "@/lib/permissions";
import { createAccount, updateAccount, setAccountActive, setAccountSystemRole } from "./actions";
import { BookOpen, UserX, UserCheck, Plus } from "lucide-react";

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
    <main className="max-w-screen-2xl px-6 py-10">
      <h1 className="flex items-center gap-2 text-2xl font-bold">
        <BookOpen className="h-6 w-6 text-brand" />
        Chart of Accounts
      </h1>
      {searchParams.error && <p className="mt-3 text-sm font-medium text-error">{searchParams.error}</p>}

      <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-surface p-5 shadow-sm">
        <table className="w-full min-w-[800px] border-collapse">
          <thead>
            <tr className="border-b text-left">
              <th>Code</th>
              <th>Name / Type</th>
              <th>Status</th>
              <th>Role</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((a: any) => (
              <tr key={a.id} className="border-b" style={{ opacity: a.is_active ? 1 : 0.5 }}>
                <td>{a.code}</td>
                <td>
                  <form action={updateAccount} className="flex items-center gap-2 py-2">
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
                  <form action={setAccountSystemRole} className="flex items-center gap-2">
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
                    <button type="submit" className="inline-flex items-center gap-1.5">
                      {a.is_active ? <UserX className="h-3.5 w-3.5" /> : <UserCheck className="h-3.5 w-3.5" />}
                      {a.is_active ? "Deactivate" : "Reactivate"}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 rounded-xl border border-border bg-surface p-5 shadow-sm">
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
          <Plus className="h-4 w-4 text-brand" />
          Add account
        </h2>
        <form action={createAccount} className="flex flex-wrap items-center gap-2">
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
      </div>
    </main>
  );
}

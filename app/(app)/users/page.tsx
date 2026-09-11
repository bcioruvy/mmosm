import { auth } from "@/auth";
import sql from "@/lib/db";
import { redirect } from "next/navigation";
import { PERMISSIONS } from "@/lib/permissions";
import { createUser, updateUserRole, setUserActive, resetUserPassword } from "./actions";
import { UserCog, UserX, UserCheck, KeyRound, Plus } from "lucide-react";

export default async function UsersPage({
  searchParams,
}: {
  searchParams: { error?: string; success?: string };
}) {
  const session = await auth();
  const permissions = session?.user?.permissions ?? [];
  if (!session?.user || !permissions.includes(PERMISSIONS.MANAGE_USERS)) {
    redirect("/");
  }

  const [users, roles] = await Promise.all([
    sql`
      SELECT u.id, u.name, u.email, u.is_active, u.role_id, r.name AS role_name
      FROM users u JOIN roles r ON r.id = u.role_id
      ORDER BY u.name
    `,
    sql`SELECT id, name FROM roles ORDER BY name`,
  ]);

  return (
    <main className="max-w-[1100px] px-6 py-10">
      <h1 className="flex items-center gap-2 text-2xl font-bold">
        <UserCog className="h-6 w-6 text-brand" />
        Users
      </h1>
      {searchParams.error && <p className="mt-3 text-sm font-medium text-error">{searchParams.error}</p>}
      {searchParams.success && <p className="mt-3 text-sm font-medium text-success">Done.</p>}

      <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-surface p-5 shadow-sm">
        <table className="w-full min-w-[800px] border-collapse">
          <thead>
            <tr className="border-b text-left">
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Reset password</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u: any) => (
              <tr key={u.id} className="border-b" style={{ opacity: u.is_active ? 1 : 0.5 }}>
                <td>{u.name}</td>
                <td>{u.email}</td>
                <td>
                  <form action={updateUserRole} className="flex items-center gap-2 py-2">
                    <input type="hidden" name="id" value={u.id} />
                    <select name="roleId" defaultValue={u.role_id}>
                      {roles.map((r: any) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                    <button type="submit">Save</button>
                  </form>
                </td>
                <td>
                  <form action={setUserActive}>
                    <input type="hidden" name="id" value={u.id} />
                    <input type="hidden" name="isActive" value={(!u.is_active).toString()} />
                    <button type="submit" disabled={u.id === session.user.id} className="inline-flex items-center gap-1.5">
                      {u.is_active ? <UserX className="h-3.5 w-3.5" /> : <UserCheck className="h-3.5 w-3.5" />}
                      {u.is_active ? "Deactivate" : "Reactivate"}
                    </button>
                  </form>
                </td>
                <td>
                  <form action={resetUserPassword} className="flex items-center gap-2">
                    <input type="hidden" name="id" value={u.id} />
                    <input type="password" name="newPassword" placeholder="New password" minLength={8} required />
                    <button type="submit" className="inline-flex items-center gap-1.5">
                      <KeyRound className="h-3.5 w-3.5" />
                      Reset
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
          Add user
        </h2>
        <form action={createUser} className="flex flex-wrap items-center gap-2">
          <input name="name" placeholder="Full name" required />
          <input name="email" type="email" placeholder="Email" required />
          <select name="roleId" required defaultValue="">
            <option value="" disabled>
              Role…
            </option>
            {roles.map((r: any) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          <input name="password" type="password" placeholder="Initial password (8+ chars)" minLength={8} required />
          <button type="submit">Create</button>
        </form>
      </div>
    </main>
  );
}

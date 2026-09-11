import { auth } from "@/auth";
import sql from "@/lib/db";
import { redirect } from "next/navigation";
import { PERMISSIONS } from "@/lib/permissions";
import { createUser, updateUserRole, setUserActive, resetUserPassword } from "./actions";

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
    <main style={{ maxWidth: 900, margin: "40px auto", padding: 24 }}>
      <p>
        <a href="/">&larr; Home</a>
      </p>
      <h1>Users</h1>
      {searchParams.error && <p style={{ color: "#b00020" }}>{searchParams.error}</p>}
      {searchParams.success && <p style={{ color: "#1b7a3d" }}>Done.</p>}

      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 16 }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>
            <th>Name</th>
            <th>Email</th>
            <th>Role</th>
            <th>Status</th>
            <th>Reset password</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u: any) => (
            <tr key={u.id} style={{ borderBottom: "1px solid #eee", opacity: u.is_active ? 1 : 0.5 }}>
              <td>{u.name}</td>
              <td>{u.email}</td>
              <td>
                <form action={updateUserRole} style={{ display: "flex", gap: 8 }}>
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
                  <button type="submit" disabled={u.id === session.user.id}>
                    {u.is_active ? "Deactivate" : "Reactivate"}
                  </button>
                </form>
              </td>
              <td>
                <form action={resetUserPassword} style={{ display: "flex", gap: 8 }}>
                  <input type="hidden" name="id" value={u.id} />
                  <input type="password" name="newPassword" placeholder="New password" minLength={8} required />
                  <button type="submit">Reset</button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 style={{ marginTop: 32 }}>Add user</h2>
      <form action={createUser} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
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
    </main>
  );
}

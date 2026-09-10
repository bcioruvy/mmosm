import { auth, signOut } from "@/auth";
import sql from "@/lib/db";
import { PERMISSIONS } from "@/lib/permissions";

export default async function Home() {
  const session = await auth();
  const permissions = session?.user?.permissions ?? [];
  const accounts = await sql`SELECT code, name, type FROM accounts WHERE is_active = true ORDER BY code`;

  return (
    <main style={{ maxWidth: 640, margin: "40px auto", padding: 24 }}>
      <h1>mmosm Accounting</h1>
      <p>
        Signed in as {session?.user?.name} ({session?.user?.role})
      </p>
      <nav style={{ display: "flex", gap: 16, margin: "16px 0" }}>
        {permissions.includes(PERMISSIONS.MANAGE_ACCOUNTS) && <a href="/accounts">Chart of Accounts</a>}
        {permissions.includes(PERMISSIONS.MANAGE_USERS) && <a href="/users">Users</a>}
        <a href="/change-password">Change password</a>
      </nav>
      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/login" });
        }}
      >
        <button type="submit">Sign out</button>
      </form>

      <h2>Chart of Accounts</h2>
      <ul>
        {accounts.map((a: any) => (
          <li key={a.code}>
            {a.code} — {a.name} ({a.type})
          </li>
        ))}
      </ul>
    </main>
  );
}

import { auth } from "@/auth";
import sql from "@/lib/db";

export default async function Home() {
  const session = await auth();
  const accounts = await sql`SELECT code, name, type FROM accounts WHERE is_active = true ORDER BY code`;

  return (
    <main style={{ maxWidth: 640, margin: "40px auto", padding: 24 }}>
      <h1>mmosm Accounting</h1>
      <p>
        Signed in as {session?.user?.name} ({session?.user?.role})
      </p>

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

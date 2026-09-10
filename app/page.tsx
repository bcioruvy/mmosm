import { auth, signOut } from "@/auth";
import sql from "@/lib/db";

export default async function Home() {
  const session = await auth();
  const accounts = await sql`SELECT code, name, type FROM accounts ORDER BY code`;

  return (
    <main style={{ maxWidth: 640, margin: "40px auto", padding: 24 }}>
      <h1>mmosm Accounting</h1>
      <p>
        Signed in as {session?.user?.name} ({(session?.user as any)?.role})
      </p>
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
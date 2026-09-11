import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { PERMISSIONS } from "@/lib/permissions";

export default async function ReportsPage() {
  const session = await auth();
  const permissions = session?.user?.permissions ?? [];
  if (!session?.user || !permissions.includes(PERMISSIONS.VIEW_REPORTS)) {
    redirect("/");
  }

  return (
    <main style={{ maxWidth: 640, margin: "40px auto", padding: 24 }}>
      <p>
        <a href="/">&larr; Home</a>
      </p>
      <h1>Reports</h1>
      <ul>
        <li>
          <a href="/reports/trial-balance">Trial Balance</a>
        </li>
        <li>
          <a href="/reports/profit-loss">Profit &amp; Loss</a>
        </li>
        <li>
          <a href="/reports/balance-sheet">Balance Sheet</a>
        </li>
      </ul>
    </main>
  );
}

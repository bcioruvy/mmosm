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
        <li>
          <a href="/reports/general-ledger">General Ledger</a>
        </li>
        <li>
          <a href="/reports/ar-aging">AR Aging</a>
        </li>
        <li>
          <a href="/reports/ap-aging">AP Aging</a>
        </li>
        <li>
          <a href="/reports/sales">Sales Report</a>
        </li>
        <li>
          <a href="/reports/expenses">Expense Report</a>
        </li>
        <li>
          <a href="/reports/income">Income Report</a>
        </li>
      </ul>
    </main>
  );
}

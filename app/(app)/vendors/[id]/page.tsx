import { auth } from "@/auth";
import sql from "@/lib/db";
import { redirect, notFound } from "next/navigation";
import { PERMISSIONS } from "@/lib/permissions";
import { formatCurrency } from "@/lib/currency";
import { getExpenseBalance } from "@/lib/expenseBalance";
import { StatCard } from "../../DashboardCards";
import HideVoidedToggle from "../../HideVoidedToggle";
import { Truck, Wallet, ArrowUpCircle } from "lucide-react";

export default async function VendorActivityPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { showVoided?: string };
}) {
  const session = await auth();
  const permissions = session?.user?.permissions ?? [];
  if (!session?.user || !permissions.includes(PERMISSIONS.MANAGE_VENDORS)) {
    redirect("/");
  }

  const [vendor] = await sql`SELECT id, name FROM vendors WHERE id = ${params.id}`;
  if (!vendor) notFound();

  const expensesRaw = await sql`
    SELECT e.id, e.expense_date, e.amount, e.payment_status, e.notes, e.voided_at,
      cat.code AS category_code, cat.name AS category_name
    FROM expenses e
    JOIN accounts cat ON cat.id = e.category_account_id
    WHERE e.vendor_id = ${params.id}
    ORDER BY e.expense_date DESC, e.id DESC
  `;

  // getExpenseBalance assumes the expense went through Accounts Payable
  // (payment_status started as 'unpaid') — an expense paid in full at
  // creation never posts to AP or into the payments table, so it has
  // nothing to compute a balance from and getExpenseBalance would
  // wrongly report the full amount as still owed. Every other caller in
  // the app already gates on this (recordExpensePayment, AP Aging,
  // Dashboard's Upcoming Bills); this page needs the same guard.
  const expenses = await Promise.all(
    expensesRaw.map(async (e: any) => ({
      ...e,
      remaining:
        e.payment_status === "unpaid" || e.payment_status === "partial"
          ? (await getExpenseBalance(e.id)).remainingOwed
          : 0,
    }))
  );

  const totalSpent = expenses.filter((e: any) => !e.voided_at).reduce((sum: number, e: any) => sum + Number(e.amount), 0);
  const totalOwed = expenses.filter((e: any) => !e.voided_at).reduce((sum: number, e: any) => sum + e.remaining, 0);

  const showVoided = searchParams.showVoided === "1";
  const visibleExpenses = showVoided ? expenses : expenses.filter((e: any) => !e.voided_at);
  const hiddenCount = expenses.length - visibleExpenses.length;

  return (
    <main className="max-w-screen-2xl px-6 py-10">
      <p>
        <a href="/vendors">&larr; Vendors</a>
      </p>
      <h1 className="mt-2 flex items-center gap-2 text-2xl font-bold">
        <Truck className="h-6 w-6 text-brand" />
        {vendor.name}
      </h1>

      <div className="mb-6 mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <StatCard icon={Wallet} label="Total Spent" value={formatCurrency(totalSpent)} />
        <StatCard icon={ArrowUpCircle} label="Total Still Owed" value={formatCurrency(totalOwed)} />
      </div>

      <div className="mb-3">
        <HideVoidedToggle showVoided={showVoided} hiddenCount={hiddenCount} />
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-surface p-5 shadow-sm">
        <table className="w-full min-w-[700px] border-collapse">
          <thead>
            <tr className="border-b text-left">
              <th>Date</th>
              <th>Category</th>
              <th>Notes</th>
              <th>Amount</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {visibleExpenses.map((e: any) => (
              <tr key={e.id} className="border-b" style={{ opacity: e.voided_at ? 0.5 : 1 }}>
                <td>{new Date(e.expense_date).toLocaleDateString()}</td>
                <td>
                  {e.category_code} — {e.category_name}
                </td>
                <td>{e.notes ?? ""}</td>
                <td>{formatCurrency(Number(e.amount))}</td>
                <td>
                  {e.voided_at
                    ? "Voided"
                    : e.payment_status === "paid"
                      ? "Paid"
                      : e.payment_status === "partial"
                        ? `Partial — ${formatCurrency(e.remaining)} owed`
                        : "Unpaid (bill)"}
                </td>
              </tr>
            ))}
            {visibleExpenses.length === 0 && (
              <tr>
                <td colSpan={5} className="text-muted">
                  No expenses recorded for this vendor.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}

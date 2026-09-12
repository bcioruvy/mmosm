import { auth } from "@/auth";
import sql from "@/lib/db";
import { redirect, notFound } from "next/navigation";
import { PERMISSIONS } from "@/lib/permissions";
import { formatCurrency } from "@/lib/currency";
import { getInvoiceBalance } from "@/lib/invoiceBalance";
import { StatCard } from "../../DashboardCards";
import HideVoidedToggle from "../../HideVoidedToggle";
import { Users, FileText, ArrowDownCircle } from "lucide-react";

export default async function CustomerActivityPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { showVoided?: string };
}) {
  const session = await auth();
  const permissions = session?.user?.permissions ?? [];
  if (!session?.user || !permissions.includes(PERMISSIONS.MANAGE_CUSTOMERS)) {
    redirect("/");
  }

  const [customer] = await sql`SELECT id, name FROM customers WHERE id = ${params.id}`;
  if (!customer) notFound();

  const invoicesRaw = await sql`
    SELECT i.id, i.invoice_number, i.invoice_date, i.status,
      COALESCE((SELECT SUM(line_total) FROM invoice_lines WHERE invoice_id = i.id), 0) AS total
    FROM invoices i
    WHERE i.customer_id = ${params.id}
    ORDER BY i.invoice_date DESC, i.id DESC
  `;

  // A draft never posted to AR (no journal_entry_id) and a void invoice
  // has nothing left to owe — getInvoiceBalance is only meaningful for
  // sent/partial/paid, so skip the query rather than compute (and
  // display) a number that doesn't mean anything for those two states.
  const invoices = await Promise.all(
    invoicesRaw.map(async (inv: any) => ({
      ...inv,
      remaining:
        inv.status === "draft" || inv.status === "void" ? 0 : (await getInvoiceBalance(inv.id)).remainingOwed,
    }))
  );

  // Drafts haven't posted to the ledger and aren't real revenue yet — same
  // reasoning as excluding an unposted expense from "total spent".
  const posted = invoices.filter((inv: any) => inv.status !== "draft" && inv.status !== "void");
  const totalInvoiced = posted.reduce((sum: number, inv: any) => sum + Number(inv.total), 0);
  const totalOwed = posted.reduce((sum: number, inv: any) => sum + inv.remaining, 0);

  const showVoided = searchParams.showVoided === "1";
  const visibleInvoices = showVoided ? invoices : invoices.filter((inv: any) => inv.status !== "void");
  const hiddenCount = invoices.length - visibleInvoices.length;

  return (
    <main className="max-w-screen-2xl px-6 py-10">
      <p>
        <a href="/customers">&larr; Customers</a>
      </p>
      <h1 className="mt-2 flex items-center gap-2 text-2xl font-bold">
        <Users className="h-6 w-6 text-brand" />
        {customer.name}
      </h1>

      <div className="mb-6 mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <StatCard icon={FileText} label="Total Invoiced" value={formatCurrency(totalInvoiced)} />
        <StatCard icon={ArrowDownCircle} label="Total Still Owed" value={formatCurrency(totalOwed)} />
      </div>

      <div className="mb-3">
        <HideVoidedToggle showVoided={showVoided} hiddenCount={hiddenCount} />
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-surface p-5 shadow-sm">
        <table className="w-full min-w-[700px] border-collapse">
          <thead>
            <tr className="border-b text-left">
              <th>Date</th>
              <th>Invoice</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Owed</th>
            </tr>
          </thead>
          <tbody>
            {visibleInvoices.map((inv: any) => (
              <tr key={inv.id} className="border-b" style={{ opacity: inv.status === "void" ? 0.5 : 1 }}>
                <td>{new Date(inv.invoice_date).toLocaleDateString()}</td>
                <td>
                  <a href={`/invoices/${inv.id}`}>{inv.invoice_number}</a>
                </td>
                <td>{formatCurrency(Number(inv.total))}</td>
                <td>{inv.status === "void" ? "Voided" : inv.status}</td>
                <td>{inv.status === "void" || inv.status === "draft" ? "" : formatCurrency(inv.remaining)}</td>
              </tr>
            ))}
            {visibleInvoices.length === 0 && (
              <tr>
                <td colSpan={5} className="text-muted">
                  No invoices recorded for this customer.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}

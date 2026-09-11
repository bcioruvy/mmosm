import { auth } from "@/auth";
import sql from "@/lib/db";
import { redirect } from "next/navigation";
import { PERMISSIONS } from "@/lib/permissions";
import { formatCurrency } from "@/lib/currency";
import { createInvoice } from "./actions";
import InvoiceLineEditor from "./InvoiceLineEditor";
import { FileText, Plus } from "lucide-react";

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: { error?: string; success?: string };
}) {
  const session = await auth();
  const permissions = session?.user?.permissions ?? [];
  if (!session?.user || !permissions.includes(PERMISSIONS.MANAGE_TRANSACTIONS)) {
    redirect("/");
  }

  const [invoices, customers, revenueAccounts] = await Promise.all([
    sql`
      SELECT i.id, i.invoice_number, i.invoice_date, i.due_date, i.status, c.name AS customer_name,
        COALESCE((SELECT SUM(line_total) FROM invoice_lines WHERE invoice_id = i.id), 0) AS total
      FROM invoices i JOIN customers c ON c.id = i.customer_id
      ORDER BY i.invoice_date DESC, i.id DESC
    `,
    sql`SELECT id, name FROM customers WHERE is_active = true ORDER BY name`,
    sql`SELECT id, code, name FROM accounts WHERE is_active = true AND type = 'revenue' AND code != '4900' ORDER BY code`,
  ]);

  // Own try/catch, deliberately outside the Promise.all above: this
  // deploys before 013_products.sql is necessarily run, and a missing
  // products table here must not 500 a page that already works today —
  // the picker is a convenience, invoice creation doesn't depend on it.
  let products: any[] = [];
  try {
    products = await sql`SELECT id, sku, name, default_price FROM products WHERE is_active = true ORDER BY name`;
  } catch {
    products = [];
  }

  return (
    <main className="max-w-screen-2xl px-6 py-10">
      <h1 className="flex items-center gap-2 text-2xl font-bold">
        <FileText className="h-6 w-6 text-brand" />
        Invoices
      </h1>
      {searchParams.error && <p className="mt-3 text-sm font-medium text-error">{searchParams.error}</p>}
      {searchParams.success && <p className="mt-3 text-sm font-medium text-success">Done.</p>}

      <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-surface p-5 shadow-sm">
        <table className="w-full min-w-[700px] border-collapse">
          <thead>
            <tr className="border-b text-left">
              <th>Number</th>
              <th>Customer</th>
              <th>Date</th>
              <th>Due</th>
              <th>Status</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv: any) => (
              <tr key={inv.id} className="border-b" style={{ opacity: inv.status === "void" ? 0.5 : 1 }}>
                <td>
                  <a href={`/invoices/${inv.id}`}>{inv.invoice_number}</a>
                </td>
                <td>{inv.customer_name}</td>
                <td>{new Date(inv.invoice_date).toLocaleDateString()}</td>
                <td>{new Date(inv.due_date).toLocaleDateString()}</td>
                <td>{inv.status === "void" ? "Voided" : inv.status}</td>
                <td>{formatCurrency(Number(inv.total))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 rounded-xl border border-border bg-surface p-5 shadow-sm">
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
          <Plus className="h-4 w-4 text-brand" />
          New invoice
        </h2>
        <form action={createInvoice} className="flex flex-col gap-3" style={{ maxWidth: 700 }}>
          <div className="flex flex-wrap items-center gap-2">
            <select name="customerId" required defaultValue="">
              <option value="" disabled>
                Customer…
              </option>
              {customers.map((c: any) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-sm text-muted">
              Invoice date <input name="invoiceDate" type="date" required />
            </label>
            <label className="flex items-center gap-2 text-sm text-muted">
              Due date <input name="dueDate" type="date" required />
            </label>
            <select name="revenueAccountId" required defaultValue="">
              <option value="" disabled>
                Revenue account…
              </option>
              {revenueAccounts.map((a: any) => (
                <option key={a.id} value={a.id}>
                  {a.code} — {a.name}
                </option>
              ))}
            </select>
          </div>

          <InvoiceLineEditor products={products} />

          <input name="notes" placeholder="Notes" />
          <button type="submit" className="self-start">
            Save as draft
          </button>
        </form>
      </div>
    </main>
  );
}

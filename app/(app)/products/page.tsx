import { auth } from "@/auth";
import sql from "@/lib/db";
import { redirect } from "next/navigation";
import { PERMISSIONS } from "@/lib/permissions";
import { createProduct, updateProduct, setProductActive } from "./actions";
import { Package, UserX, UserCheck, Plus } from "lucide-react";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const session = await auth();
  const permissions = session?.user?.permissions ?? [];
  if (!session?.user || !permissions.includes(PERMISSIONS.MANAGE_PRODUCTS)) {
    redirect("/");
  }

  const products = await sql`
    SELECT id, sku, name, description, default_price, is_active FROM products ORDER BY name
  `;

  return (
    <main className="max-w-screen-2xl px-6 py-10">
      <h1 className="flex items-center gap-2 text-2xl font-bold">
        <Package className="h-6 w-6 text-brand" />
        Products
      </h1>
      {searchParams.error && <p className="mt-3 text-sm font-medium text-error">{searchParams.error}</p>}

      <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-surface p-5 shadow-sm">
        <table className="w-full min-w-[800px] border-collapse">
          <thead>
            <tr className="border-b text-left">
              <th>SKU / Name / Description / Default price</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {products.map((p: any) => (
              <tr key={p.id} className="border-b" style={{ opacity: p.is_active ? 1 : 0.5 }}>
                <td>
                  <form action={updateProduct} className="flex flex-wrap items-center gap-2 py-2">
                    <input type="hidden" name="id" value={p.id} />
                    <input name="sku" defaultValue={p.sku ?? ""} placeholder="SKU" className="w-28 shrink-0" />
                    <input name="name" defaultValue={p.name} required className="min-w-[180px] flex-1" />
                    <input
                      name="description"
                      defaultValue={p.description ?? ""}
                      placeholder="Description"
                      className="min-w-[200px] flex-[2]"
                    />
                    <input
                      name="defaultPrice"
                      type="number"
                      step="0.01"
                      min="0"
                      defaultValue={p.default_price ?? ""}
                      placeholder="Default price"
                      className="w-36 shrink-0"
                    />
                    <button type="submit">Save</button>
                  </form>
                </td>
                <td>{p.is_active ? "Active" : "Inactive"}</td>
                <td>
                  <form action={setProductActive}>
                    <input type="hidden" name="id" value={p.id} />
                    <input type="hidden" name="isActive" value={(!p.is_active).toString()} />
                    <button type="submit" className="inline-flex items-center gap-1.5">
                      {p.is_active ? <UserX className="h-3.5 w-3.5" /> : <UserCheck className="h-3.5 w-3.5" />}
                      {p.is_active ? "Deactivate" : "Reactivate"}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {products.length === 0 && (
              <tr>
                <td colSpan={3} className="py-3 text-muted">
                  No products yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-6 rounded-xl border border-border bg-surface p-5 shadow-sm">
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
          <Plus className="h-4 w-4 text-brand" />
          Add product
        </h2>
        <form action={createProduct} className="flex flex-wrap items-center gap-3">
          <input name="sku" placeholder="SKU (optional)" className="min-w-[150px] flex-1" />
          <input name="name" placeholder="Name" required className="min-w-[180px] flex-[2]" />
          <input name="description" placeholder="Description" className="min-w-[220px] flex-[3]" />
          <input
            name="defaultPrice"
            type="number"
            step="0.01"
            min="0"
            placeholder="Default price (optional)"
            className="min-w-[200px] flex-1"
          />
          <button type="submit">Add</button>
        </form>
      </div>
    </main>
  );
}

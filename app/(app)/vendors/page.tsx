import { auth } from "@/auth";
import sql from "@/lib/db";
import { redirect } from "next/navigation";
import { PERMISSIONS } from "@/lib/permissions";
import { createVendor, updateVendor, setVendorActive } from "./actions";
import { Truck, UserX, UserCheck, Plus } from "lucide-react";

export default async function VendorsPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const session = await auth();
  const permissions = session?.user?.permissions ?? [];
  if (!session?.user || !permissions.includes(PERMISSIONS.MANAGE_VENDORS)) {
    redirect("/");
  }

  const vendors = await sql`
    SELECT id, name, email, phone, address, notes, is_active FROM vendors ORDER BY name
  `;

  return (
    <main className="max-w-[1100px] px-6 py-10">
      <h1 className="flex items-center gap-2 text-2xl font-bold">
        <Truck className="h-6 w-6 text-brand" />
        Vendors
      </h1>
      {searchParams.error && <p className="mt-3 text-sm font-medium text-error">{searchParams.error}</p>}

      <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-surface p-5 shadow-sm">
        <table className="w-full min-w-[700px] border-collapse">
          <thead>
            <tr className="border-b text-left">
              <th>Name / contact</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {vendors.map((v: any) => (
              <tr key={v.id} className="border-b" style={{ opacity: v.is_active ? 1 : 0.5 }}>
                <td>
                  <form action={updateVendor} className="flex flex-wrap items-center gap-2 py-2">
                    <input type="hidden" name="id" value={v.id} />
                    <input name="name" defaultValue={v.name} required />
                    <input name="email" type="email" defaultValue={v.email ?? ""} placeholder="Email" />
                    <input name="phone" defaultValue={v.phone ?? ""} placeholder="Phone" />
                    <input name="address" defaultValue={v.address ?? ""} placeholder="Address" />
                    <input name="notes" defaultValue={v.notes ?? ""} placeholder="Notes" />
                    <button type="submit">Save</button>
                  </form>
                </td>
                <td>{v.is_active ? "Active" : "Inactive"}</td>
                <td>
                  <form action={setVendorActive}>
                    <input type="hidden" name="id" value={v.id} />
                    <input type="hidden" name="isActive" value={(!v.is_active).toString()} />
                    <button type="submit" className="inline-flex items-center gap-1.5">
                      {v.is_active ? <UserX className="h-3.5 w-3.5" /> : <UserCheck className="h-3.5 w-3.5" />}
                      {v.is_active ? "Deactivate" : "Reactivate"}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 rounded-xl border border-border bg-surface p-5 shadow-sm">
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
          <Plus className="h-4 w-4 text-brand" />
          Add vendor
        </h2>
        <form action={createVendor} className="flex flex-wrap items-center gap-2">
          <input name="name" placeholder="Name" required />
          <input name="email" type="email" placeholder="Email" />
          <input name="phone" placeholder="Phone" />
          <input name="address" placeholder="Address" />
          <input name="notes" placeholder="Notes" />
          <button type="submit">Add</button>
        </form>
      </div>
    </main>
  );
}

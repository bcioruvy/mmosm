import { auth } from "@/auth";
import sql from "@/lib/db";
import { redirect } from "next/navigation";
import { PERMISSIONS } from "@/lib/permissions";
import { createVendor, updateVendor, setVendorActive } from "./actions";

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
    <main style={{ maxWidth: 900, margin: "40px auto", padding: 24 }}>
      <p>
        <a href="/">&larr; Home</a>
      </p>
      <h1>Vendors</h1>
      {searchParams.error && <p style={{ color: "#b00020" }}>{searchParams.error}</p>}

      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 16 }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>
            <th>Name / contact</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {vendors.map((v: any) => (
            <tr key={v.id} style={{ borderBottom: "1px solid #eee", opacity: v.is_active ? 1 : 0.5 }}>
              <td>
                <form action={updateVendor} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
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
                  <button type="submit">{v.is_active ? "Deactivate" : "Reactivate"}</button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 style={{ marginTop: 32 }}>Add vendor</h2>
      <form action={createVendor} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input name="name" placeholder="Name" required />
        <input name="email" type="email" placeholder="Email" />
        <input name="phone" placeholder="Phone" />
        <input name="address" placeholder="Address" />
        <input name="notes" placeholder="Notes" />
        <button type="submit">Add</button>
      </form>
    </main>
  );
}

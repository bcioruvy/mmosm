import { auth } from "@/auth";
import sql from "@/lib/db";
import { redirect } from "next/navigation";
import { PERMISSIONS } from "@/lib/permissions";
import { createCustomer, updateCustomer, setCustomerActive } from "./actions";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const session = await auth();
  const permissions = session?.user?.permissions ?? [];
  if (!session?.user || !permissions.includes(PERMISSIONS.MANAGE_CUSTOMERS)) {
    redirect("/");
  }

  const customers = await sql`
    SELECT id, name, email, phone, address, notes, is_active FROM customers ORDER BY name
  `;

  return (
    <main style={{ maxWidth: 900, margin: "40px auto", padding: 24 }}>
      <p>
        <a href="/">&larr; Home</a>
      </p>
      <h1>Customers</h1>
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
          {customers.map((c: any) => (
            <tr key={c.id} style={{ borderBottom: "1px solid #eee", opacity: c.is_active ? 1 : 0.5 }}>
              <td>
                <form action={updateCustomer} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <input type="hidden" name="id" value={c.id} />
                  <input name="name" defaultValue={c.name} required />
                  <input name="email" type="email" defaultValue={c.email ?? ""} placeholder="Email" />
                  <input name="phone" defaultValue={c.phone ?? ""} placeholder="Phone" />
                  <input name="address" defaultValue={c.address ?? ""} placeholder="Address" />
                  <input name="notes" defaultValue={c.notes ?? ""} placeholder="Notes" />
                  <button type="submit">Save</button>
                </form>
              </td>
              <td>{c.is_active ? "Active" : "Inactive"}</td>
              <td>
                <form action={setCustomerActive}>
                  <input type="hidden" name="id" value={c.id} />
                  <input type="hidden" name="isActive" value={(!c.is_active).toString()} />
                  <button type="submit">{c.is_active ? "Deactivate" : "Reactivate"}</button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 style={{ marginTop: 32 }}>Add customer</h2>
      <form action={createCustomer} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
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

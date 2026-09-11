import { auth } from "@/auth";
import sql from "@/lib/db";
import { redirect } from "next/navigation";
import { PERMISSIONS } from "@/lib/permissions";
import { updateSettings } from "./actions";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: { error?: string; success?: string };
}) {
  const session = await auth();
  const permissions = session?.user?.permissions ?? [];
  if (!session?.user || !permissions.includes(PERMISSIONS.MANAGE_SETTINGS)) {
    redirect("/");
  }

  const [settings] = await sql`SELECT * FROM business_settings WHERE id = 1`;

  return (
    <main style={{ maxWidth: 600, margin: "40px auto", padding: 24 }}>
      <h1>Settings</h1>
      {searchParams.error && <p style={{ color: "var(--color-error)" }}>{searchParams.error}</p>}
      {searchParams.success && <p style={{ color: "var(--color-success)" }}>Settings saved.</p>}

      <form action={updateSettings} style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 420 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          Business name
          <input name="businessName" defaultValue={settings?.business_name ?? ""} required />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          Contact email
          <input name="contactEmail" type="email" defaultValue={settings?.contact_email ?? ""} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          Contact phone
          <input name="contactPhone" defaultValue={settings?.contact_phone ?? ""} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          Address
          <input name="address" defaultValue={settings?.address ?? ""} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          Invoice number prefix
          <input name="invoicePrefix" defaultValue={settings?.invoice_prefix ?? "INV"} required />
        </label>
        <p style={{ fontSize: "0.85em", color: "var(--color-text-muted)", margin: 0 }}>
          Changing the prefix only affects invoices created from now on — invoices already issued keep
          their original numbers exactly as they were.
        </p>
        <button type="submit" style={{ alignSelf: "flex-start" }}>
          Save
        </button>
      </form>

      <h2 style={{ marginTop: 32 }}>Not built yet</h2>
      <p style={{ color: "var(--color-text-muted)" }}>
        Logo upload isn't available — it needs a file-storage decision (same gap as expense receipts).
        Ask when you're ready and it can be wired up alongside receipts.
      </p>
    </main>
  );
}

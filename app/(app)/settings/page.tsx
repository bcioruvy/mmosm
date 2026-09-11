import { auth } from "@/auth";
import sql from "@/lib/db";
import { redirect } from "next/navigation";
import { PERMISSIONS } from "@/lib/permissions";
import { updateSettings } from "./actions";
import { Settings as SettingsIcon } from "lucide-react";

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
    <main className="max-w-2xl px-6 py-10">
      <h1 className="flex items-center gap-2 text-2xl font-bold">
        <SettingsIcon className="h-6 w-6 text-brand" />
        Settings
      </h1>
      {searchParams.error && <p className="mt-3 text-sm font-medium text-error">{searchParams.error}</p>}
      {searchParams.success && <p className="mt-3 text-sm font-medium text-success">Settings saved.</p>}

      <div className="mt-6 rounded-xl border border-border bg-surface p-5 shadow-sm">
        <form action={updateSettings} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm text-muted">
            Business name
            <input name="businessName" defaultValue={settings?.business_name ?? ""} required />
          </label>
          <label className="flex flex-col gap-1 text-sm text-muted">
            Contact email
            <input name="contactEmail" type="email" defaultValue={settings?.contact_email ?? ""} />
          </label>
          <label className="flex flex-col gap-1 text-sm text-muted">
            Contact phone
            <input name="contactPhone" defaultValue={settings?.contact_phone ?? ""} />
          </label>
          <label className="flex flex-col gap-1 text-sm text-muted">
            Address
            <input name="address" defaultValue={settings?.address ?? ""} />
          </label>
          <label className="flex flex-col gap-1 text-sm text-muted">
            Invoice number prefix
            <input name="invoicePrefix" defaultValue={settings?.invoice_prefix ?? "INV"} required />
          </label>
          <p className="m-0 text-sm text-muted">
            Changing the prefix only affects invoices created from now on — invoices already issued keep
            their original numbers exactly as they were.
          </p>
          <button type="submit" className="self-start">
            Save
          </button>
        </form>
      </div>

      <div className="mt-6 rounded-xl border border-border bg-surface p-5 shadow-sm">
        <h2 className="text-base font-semibold">Not built yet</h2>
        <p className="mt-1 text-sm text-muted">
          Logo upload isn't available — it needs a file-storage decision (same gap as expense receipts).
          Ask when you're ready and it can be wired up alongside receipts.
        </p>
      </div>
    </main>
  );
}

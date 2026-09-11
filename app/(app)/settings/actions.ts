"use server";

import sql from "@/lib/db";
import { requirePermission } from "@/lib/authz";
import { logAudit } from "@/lib/audit";
import { PERMISSIONS } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function updateSettings(formData: FormData) {
  const session = await requirePermission(PERMISSIONS.MANAGE_SETTINGS);

  const businessName = String(formData.get("businessName") ?? "").trim();
  const contactEmail = String(formData.get("contactEmail") ?? "").trim();
  const contactPhone = String(formData.get("contactPhone") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const invoicePrefix = String(formData.get("invoicePrefix") ?? "")
    .trim()
    .toUpperCase();

  if (!businessName || !invoicePrefix) {
    redirect(`/settings?error=${encodeURIComponent("Business name and invoice prefix are required.")}`);
  }
  if (!/^[A-Z0-9-]{1,10}$/.test(invoicePrefix)) {
    redirect(
      `/settings?error=${encodeURIComponent("Invoice prefix must be 1-10 characters: letters, digits, or hyphens.")}`
    );
  }

  const [before] = await sql`SELECT * FROM business_settings WHERE id = 1`;

  await sql`
    UPDATE business_settings
    SET business_name = ${businessName}, contact_email = ${contactEmail || null},
        contact_phone = ${contactPhone || null}, address = ${address || null},
        invoice_prefix = ${invoicePrefix}, updated_at = now(), updated_by = ${session.user.id}
    WHERE id = 1
  `;

  await logAudit({
    actorId: session.user.id,
    action: "update",
    entityType: "business_settings",
    entityId: 1,
    details: {
      before,
      after: { businessName, contactEmail, contactPhone, address, invoicePrefix },
    },
  });

  revalidatePath("/settings");
  redirect("/settings?success=1");
}

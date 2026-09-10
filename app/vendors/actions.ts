"use server";

import sql from "@/lib/db";
import { requirePermission } from "@/lib/authz";
import { logAudit } from "@/lib/audit";
import { PERMISSIONS } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createVendor(formData: FormData) {
  const session = await requirePermission(PERMISSIONS.MANAGE_VENDORS);
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!name) {
    redirect(`/vendors?error=${encodeURIComponent("Name is required.")}`);
  }

  const [vendor] = await sql`
    INSERT INTO vendors (name, email, phone, address, notes, is_active)
    VALUES (${name}, ${email || null}, ${phone || null}, ${address || null}, ${notes || null}, true)
    RETURNING id
  `;
  await logAudit({
    actorId: session.user.id,
    action: "create",
    entityType: "vendor",
    entityId: vendor.id,
    details: { name, email, phone },
  });
  revalidatePath("/vendors");
}

export async function updateVendor(formData: FormData) {
  const session = await requirePermission(PERMISSIONS.MANAGE_VENDORS);
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!id || !name) {
    redirect(`/vendors?error=${encodeURIComponent("Name is required.")}`);
  }

  const [before] = await sql`SELECT name, email, phone, address, notes FROM vendors WHERE id = ${id}`;
  if (!before) redirect(`/vendors?error=${encodeURIComponent("Vendor not found.")}`);

  await sql`
    UPDATE vendors
    SET name = ${name}, email = ${email || null}, phone = ${phone || null},
        address = ${address || null}, notes = ${notes || null}
    WHERE id = ${id}
  `;
  await logAudit({
    actorId: session.user.id,
    action: "update",
    entityType: "vendor",
    entityId: id,
    details: { before, after: { name, email, phone, address, notes } },
  });
  revalidatePath("/vendors");
}

export async function setVendorActive(formData: FormData) {
  const session = await requirePermission(PERMISSIONS.MANAGE_VENDORS);
  const id = String(formData.get("id") ?? "");
  const isActive = formData.get("isActive") === "true";

  const [before] = await sql`SELECT is_active FROM vendors WHERE id = ${id}`;
  if (!before) redirect(`/vendors?error=${encodeURIComponent("Vendor not found.")}`);

  await sql`UPDATE vendors SET is_active = ${isActive} WHERE id = ${id}`;
  await logAudit({
    actorId: session.user.id,
    action: isActive ? "reactivate" : "deactivate",
    entityType: "vendor",
    entityId: id,
    details: { before: before.is_active, after: isActive },
  });
  revalidatePath("/vendors");
}

"use server";

import sql from "@/lib/db";
import { requirePermission } from "@/lib/authz";
import { logAudit } from "@/lib/audit";
import { PERMISSIONS } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createCustomer(formData: FormData) {
  const session = await requirePermission(PERMISSIONS.MANAGE_CUSTOMERS);
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!name) {
    redirect(`/customers?error=${encodeURIComponent("Name is required.")}`);
  }

  const [customer] = await sql`
    INSERT INTO customers (name, email, phone, address, notes, is_active)
    VALUES (${name}, ${email || null}, ${phone || null}, ${address || null}, ${notes || null}, true)
    RETURNING id
  `;
  await logAudit({
    actorId: session.user.id,
    action: "create",
    entityType: "customer",
    entityId: customer.id,
    details: { name, email, phone },
  });
  revalidatePath("/customers");
}

export async function updateCustomer(formData: FormData) {
  const session = await requirePermission(PERMISSIONS.MANAGE_CUSTOMERS);
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!id || !name) {
    redirect(`/customers?error=${encodeURIComponent("Name is required.")}`);
  }

  const [before] = await sql`SELECT name, email, phone, address, notes FROM customers WHERE id = ${id}`;
  if (!before) redirect(`/customers?error=${encodeURIComponent("Customer not found.")}`);

  await sql`
    UPDATE customers
    SET name = ${name}, email = ${email || null}, phone = ${phone || null},
        address = ${address || null}, notes = ${notes || null}
    WHERE id = ${id}
  `;
  await logAudit({
    actorId: session.user.id,
    action: "update",
    entityType: "customer",
    entityId: id,
    details: { before, after: { name, email, phone, address, notes } },
  });
  revalidatePath("/customers");
}

export async function setCustomerActive(formData: FormData) {
  const session = await requirePermission(PERMISSIONS.MANAGE_CUSTOMERS);
  const id = String(formData.get("id") ?? "");
  const isActive = formData.get("isActive") === "true";

  const [before] = await sql`SELECT is_active FROM customers WHERE id = ${id}`;
  if (!before) redirect(`/customers?error=${encodeURIComponent("Customer not found.")}`);

  await sql`UPDATE customers SET is_active = ${isActive} WHERE id = ${id}`;
  await logAudit({
    actorId: session.user.id,
    action: isActive ? "reactivate" : "deactivate",
    entityType: "customer",
    entityId: id,
    details: { before: before.is_active, after: isActive },
  });
  revalidatePath("/customers");
}

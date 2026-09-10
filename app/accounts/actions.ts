"use server";

import sql from "@/lib/db";
import { requirePermission } from "@/lib/authz";
import { logAudit } from "@/lib/audit";
import { PERMISSIONS } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const ACCOUNT_TYPES = ["asset", "liability", "equity", "revenue", "cogs", "expense"];

export async function createAccount(formData: FormData) {
  const session = await requirePermission(PERMISSIONS.MANAGE_ACCOUNTS);
  const code = String(formData.get("code") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const type = String(formData.get("type") ?? "");

  let error: string | null = null;
  if (!code || !name || !ACCOUNT_TYPES.includes(type)) {
    error = "Code, name, and a valid type are required.";
  }

  if (!error) {
    try {
      const [account] = await sql`
        INSERT INTO accounts (code, name, type, is_active)
        VALUES (${code}, ${name}, ${type}, true)
        RETURNING id
      `;
      await logAudit({
        actorId: session.user.id,
        action: "create",
        entityType: "account",
        entityId: account.id,
        details: { code, name, type },
      });
    } catch (err: any) {
      error = err?.code === "23505" ? "An account with that code already exists." : "Could not create account.";
    }
  }

  if (error) redirect(`/accounts?error=${encodeURIComponent(error)}`);
  revalidatePath("/accounts");
}

export async function updateAccount(formData: FormData) {
  const session = await requirePermission(PERMISSIONS.MANAGE_ACCOUNTS);
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const type = String(formData.get("type") ?? "");

  if (!id || !name || !ACCOUNT_TYPES.includes(type)) {
    redirect(`/accounts?error=${encodeURIComponent("Name and a valid type are required.")}`);
  }

  const [before] = await sql`SELECT name, type FROM accounts WHERE id = ${id}`;
  if (!before) redirect(`/accounts?error=${encodeURIComponent("Account not found.")}`);

  await sql`UPDATE accounts SET name = ${name}, type = ${type} WHERE id = ${id}`;
  await logAudit({
    actorId: session.user.id,
    action: "update",
    entityType: "account",
    entityId: id,
    details: { before: { name: before.name, type: before.type }, after: { name, type } },
  });
  revalidatePath("/accounts");
}

export async function setAccountActive(formData: FormData) {
  const session = await requirePermission(PERMISSIONS.MANAGE_ACCOUNTS);
  const id = String(formData.get("id") ?? "");
  const isActive = formData.get("isActive") === "true";

  const [before] = await sql`SELECT is_active FROM accounts WHERE id = ${id}`;
  if (!before) redirect(`/accounts?error=${encodeURIComponent("Account not found.")}`);

  await sql`UPDATE accounts SET is_active = ${isActive} WHERE id = ${id}`;
  await logAudit({
    actorId: session.user.id,
    action: isActive ? "reactivate" : "deactivate",
    entityType: "account",
    entityId: id,
    details: { before: before.is_active, after: isActive },
  });
  revalidatePath("/accounts");
}

export async function setAccountSystemRole(formData: FormData) {
  const session = await requirePermission(PERMISSIONS.MANAGE_ACCOUNTS);
  const id = String(formData.get("id") ?? "");
  const systemRoleRaw = String(formData.get("systemRole") ?? "");
  const systemRole = systemRoleRaw === "" ? null : systemRoleRaw;

  const [before] = await sql`SELECT system_role FROM accounts WHERE id = ${id}`;
  if (!before) redirect(`/accounts?error=${encodeURIComponent("Account not found.")}`);

  try {
    await sql`UPDATE accounts SET system_role = ${systemRole} WHERE id = ${id}`;
  } catch (err: any) {
    const message =
      err?.code === "23505"
        ? "Another account is already tagged with that role — untag it first."
        : "Could not update the account role.";
    redirect(`/accounts?error=${encodeURIComponent(message)}`);
  }

  await logAudit({
    actorId: session.user.id,
    action: "update_system_role",
    entityType: "account",
    entityId: id,
    details: { before: before.system_role, after: systemRole },
  });
  revalidatePath("/accounts");
}

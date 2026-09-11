"use server";

import bcrypt from "bcryptjs";
import sql from "@/lib/db";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/authz";
import { logAudit } from "@/lib/audit";
import { PERMISSIONS } from "@/lib/permissions";

export async function createUser(formData: FormData) {
  const session = await requirePermission(PERMISSIONS.MANAGE_USERS);
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const roleId = String(formData.get("roleId") ?? "");
  const password = String(formData.get("password") ?? "");

  let error: string | null = null;
  if (!name || !email || !roleId) error = "Name, email, and role are required.";
  else if (password.length < 8) error = "Password must be at least 8 characters.";

  if (!error) {
    const passwordHash = await bcrypt.hash(password, 12);
    try {
      const [user] = await sql`
        INSERT INTO users (name, email, password_hash, role_id, is_active)
        VALUES (${name}, ${email}, ${passwordHash}, ${roleId}, true)
        RETURNING id
      `;
      await logAudit({
        actorId: session.user.id,
        action: "create",
        entityType: "user",
        entityId: user.id,
        details: { name, email, roleId },
      });
    } catch (err: any) {
      error = err?.code === "23505" ? "A user with that email already exists." : "Could not create user.";
    }
  }

  if (error) redirect(`/users?error=${encodeURIComponent(error)}`);
  revalidatePath("/users");
  redirect("/users?success=1");
}

export async function updateUserRole(formData: FormData) {
  const session = await requirePermission(PERMISSIONS.MANAGE_USERS);
  const id = String(formData.get("id") ?? "");
  const roleId = String(formData.get("roleId") ?? "");

  const [before] = await sql`SELECT role_id FROM users WHERE id = ${id}`;
  if (!before) redirect(`/users?error=${encodeURIComponent("User not found.")}`);

  await sql`UPDATE users SET role_id = ${roleId} WHERE id = ${id}`;
  await logAudit({
    actorId: session.user.id,
    action: "update_role",
    entityType: "user",
    entityId: id,
    details: { before: before.role_id, after: roleId },
  });
  revalidatePath("/users");
  redirect("/users?success=1");
}

export async function setUserActive(formData: FormData) {
  const session = await requirePermission(PERMISSIONS.MANAGE_USERS);
  const id = String(formData.get("id") ?? "");
  const isActive = formData.get("isActive") === "true";

  if (id === String(session.user.id)) {
    redirect(`/users?error=${encodeURIComponent("You cannot deactivate your own account.")}`);
  }

  if (!isActive) {
    const [target] = await sql`
      SELECT r.name AS role_name FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = ${id}
    `;
    if (target?.role_name === "owner_admin") {
      const [{ count }] = await sql`
        SELECT count(*)::int FROM users u JOIN roles r ON r.id = u.role_id
        WHERE r.name = 'owner_admin' AND u.is_active = true AND u.id != ${id}
      `;
      if (count === 0) {
        redirect(`/users?error=${encodeURIComponent("Cannot deactivate the last active owner admin.")}`);
      }
    }
  }

  await sql`UPDATE users SET is_active = ${isActive} WHERE id = ${id}`;
  await logAudit({
    actorId: session.user.id,
    action: isActive ? "reactivate" : "deactivate",
    entityType: "user",
    entityId: id,
    details: { isActive },
  });
  revalidatePath("/users");
  redirect("/users?success=1");
}

export async function resetUserPassword(formData: FormData) {
  const session = await requirePermission(PERMISSIONS.MANAGE_USERS);
  const id = String(formData.get("id") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");

  if (newPassword.length < 8) {
    redirect(`/users?error=${encodeURIComponent("Password must be at least 8 characters.")}`);
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await sql`UPDATE users SET password_hash = ${passwordHash} WHERE id = ${id}`;
  await logAudit({
    actorId: session.user.id,
    action: "reset_password",
    entityType: "user",
    entityId: id,
    details: {},
  });
  revalidatePath("/users");
  redirect("/users?success=1");
}

"use server";

import bcrypt from "bcryptjs";
import sql from "@/lib/db";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { logAudit } from "@/lib/audit";

export async function changePassword(formData: FormData) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const userId = session.user.id;
  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  let error: string | null = null;
  if (newPassword.length < 8) error = "New password must be at least 8 characters.";
  else if (newPassword !== confirmPassword) error = "New passwords do not match.";

  if (!error) {
    const [user] = await sql`SELECT password_hash FROM users WHERE id = ${userId}`;
    const valid = user && (await bcrypt.compare(currentPassword, user.password_hash));
    if (!valid) error = "Current password is incorrect.";
  }

  if (error) {
    redirect(`/change-password?error=${encodeURIComponent(error)}`);
  }

  const newHash = await bcrypt.hash(newPassword, 12);
  await sql`UPDATE users SET password_hash = ${newHash} WHERE id = ${userId}`;
  await logAudit({
    actorId: userId,
    action: "change_password",
    entityType: "user",
    entityId: userId,
    details: {},
  });
  redirect("/change-password?success=1");
}

import { auth } from "@/auth";
import type { Permission } from "@/lib/permissions";

/**
 * Server-side permission check for use at the top of every mutation
 * (server action / route handler). UI hiding is not enough — this is the
 * actual gate.
 */
export async function requirePermission(permission: Permission) {
  const session = await auth();
  const permissions = session?.user?.permissions ?? [];
  if (!session?.user || !permissions.includes(permission)) {
    throw new Error(`Forbidden: missing permission "${permission}"`);
  }
  return session;
}

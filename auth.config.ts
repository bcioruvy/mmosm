import type { NextAuthConfig } from "next-auth";
import { PERMISSIONS } from "@/lib/permissions";

export const authConfig: NextAuthConfig = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [], // real provider (with DB access) only lives in auth.ts
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        const u = user as { id: string; name?: string | null; email?: string | null; role: string; permissions?: string[] };
        token.id = u.id;
        token.name = u.name;
        token.email = u.email;
        token.role = u.role;
        token.permissions = u.permissions ?? [];
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.name = token.name as string;
        session.user.email = token.email as string;
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.permissions = token.permissions ?? [];
      }
      return session;
    },
    // Edge-safe route protection: runs in middleware, no DB access — role
    // and permissions ride in the JWT already, set at login.
    authorized({ request, auth: session }) {
      if (!session?.user) return false; // not logged in -> redirect to /login

      const { pathname } = request.nextUrl;
      const permissions = session.user.permissions ?? [];

      const routePermissions: [string, string][] = [
        ["/accounts", PERMISSIONS.MANAGE_ACCOUNTS],
        ["/users", PERMISSIONS.MANAGE_USERS],
        ["/customers", PERMISSIONS.MANAGE_CUSTOMERS],
        ["/vendors", PERMISSIONS.MANAGE_VENDORS],
        ["/products", PERMISSIONS.MANAGE_PRODUCTS],
        ["/expenses", PERMISSIONS.MANAGE_TRANSACTIONS],
        ["/income", PERMISSIONS.MANAGE_TRANSACTIONS],
        ["/invoices", PERMISSIONS.MANAGE_TRANSACTIONS],
        ["/payments", PERMISSIONS.MANAGE_TRANSACTIONS],
        ["/credit-notes", PERMISSIONS.MANAGE_TRANSACTIONS],
        ["/journal-entries", PERMISSIONS.MANAGE_JOURNAL_ENTRIES],
        ["/reports", PERMISSIONS.VIEW_REPORTS],
        ["/audit-log", PERMISSIONS.VIEW_AUDIT_LOG],
        ["/settings", PERMISSIONS.MANAGE_SETTINGS],
      ];

      for (const [prefix, permission] of routePermissions) {
        if (pathname.startsWith(prefix) && !permissions.includes(permission)) {
          return Response.redirect(new URL("/", request.nextUrl));
        }
      }

      return true;
    },
  },
};

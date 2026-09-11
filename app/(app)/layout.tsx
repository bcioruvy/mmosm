import { auth, signOut } from "@/auth";
import sql from "@/lib/db";
import { PERMISSIONS } from "@/lib/permissions";
import { KeyRound, LogOut } from "lucide-react";
import Sidebar from "./Sidebar";

const NAV_ITEMS: { href: string; label: string; permission?: string }[] = [
  { href: "/", label: "Dashboard" },
  { href: "/accounts", label: "Chart of Accounts", permission: PERMISSIONS.MANAGE_ACCOUNTS },
  { href: "/customers", label: "Customers", permission: PERMISSIONS.MANAGE_CUSTOMERS },
  { href: "/vendors", label: "Vendors", permission: PERMISSIONS.MANAGE_VENDORS },
  { href: "/expenses", label: "Expenses", permission: PERMISSIONS.MANAGE_TRANSACTIONS },
  { href: "/income", label: "Income", permission: PERMISSIONS.MANAGE_TRANSACTIONS },
  { href: "/invoices", label: "Invoices", permission: PERMISSIONS.MANAGE_TRANSACTIONS },
  { href: "/payments", label: "Payments", permission: PERMISSIONS.MANAGE_TRANSACTIONS },
  { href: "/credit-notes", label: "Credit Notes", permission: PERMISSIONS.MANAGE_TRANSACTIONS },
  { href: "/reports", label: "Reports", permission: PERMISSIONS.VIEW_REPORTS },
  { href: "/audit-log", label: "Audit Trail", permission: PERMISSIONS.VIEW_AUDIT_LOG },
  { href: "/users", label: "Users", permission: PERMISSIONS.MANAGE_USERS },
  { href: "/settings", label: "Settings", permission: PERMISSIONS.MANAGE_SETTINGS },
];

const linkClasses =
  "sidebar-row flex items-center gap-3 rounded-md px-3 py-2.5 text-sm no-underline text-brand-contrast-muted hover:bg-brand-hover hover:text-brand-contrast focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-contrast";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const permissions = session?.user?.permissions ?? [];

  const visibleItems = NAV_ITEMS.filter((item) => !item.permission || permissions.includes(item.permission));

  let businessName = "mmosm Accounting";
  if (session?.user) {
    const [settings] = await sql`SELECT business_name FROM business_settings WHERE id = 1`;
    if (settings?.business_name) businessName = settings.business_name;
  }

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Sidebar businessName={businessName} navItems={visibleItems}>
        <a href="/change-password" title="Change password" className={linkClasses}>
          <KeyRound className="h-4 w-4 shrink-0" />
          <span className="sidebar-label">Change password</span>
        </a>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <button type="submit" title="Sign out" className={`w-full border-0 bg-transparent text-left ${linkClasses}`}>
            <LogOut className="h-4 w-4 shrink-0" />
            <span className="sidebar-label">Sign out</span>
          </button>
        </form>
      </Sidebar>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

import { auth, signOut } from "@/auth";
import sql from "@/lib/db";
import { PERMISSIONS } from "@/lib/permissions";

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
    <div style={{ minHeight: "100vh" }}>
      <header
        style={{
          background: "var(--color-brand)",
          color: "var(--color-brand-contrast)",
          padding: "12px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <a href="/" style={{ color: "var(--color-brand-contrast)", fontWeight: 700, fontSize: "1.1em" }}>
          {businessName}
        </a>
        <nav style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
          {visibleItems.map((item) => (
            <a key={item.href} href={item.href} style={{ color: "var(--color-brand-contrast)" }}>
              {item.label}
            </a>
          ))}
          <a href="/change-password" style={{ color: "var(--color-brand-contrast)" }}>
            Change password
          </a>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button
              type="submit"
              style={{
                background: "transparent",
                border: "1px solid var(--color-brand-contrast)",
                color: "var(--color-brand-contrast)",
              }}
            >
              Sign out
            </button>
          </form>
        </nav>
      </header>
      <div style={{ padding: "0 24px" }}>{children}</div>
    </div>
  );
}

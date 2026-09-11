import { auth, signOut } from "@/auth";
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
  { href: "/users", label: "Users", permission: PERMISSIONS.MANAGE_USERS },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const permissions = session?.user?.permissions ?? [];

  const visibleItems = NAV_ITEMS.filter((item) => !item.permission || permissions.includes(item.permission));

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
          mmosm Accounting
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

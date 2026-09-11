"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  BookOpen,
  Users,
  Truck,
  Package,
  Receipt,
  TrendingUp,
  FileText,
  CreditCard,
  Undo2,
  BarChart3,
  History,
  UserCog,
  Settings,
  Menu,
  X,
  ChevronsLeft,
  ChevronsRight,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  "/": LayoutDashboard,
  "/accounts": BookOpen,
  "/customers": Users,
  "/vendors": Truck,
  "/products": Package,
  "/expenses": Receipt,
  "/income": TrendingUp,
  "/invoices": FileText,
  "/payments": CreditCard,
  "/credit-notes": Undo2,
  "/reports": BarChart3,
  "/audit-log": History,
  "/users": UserCog,
  "/settings": Settings,
};

const COLLAPSE_STORAGE_KEY = "mmosm-sidebar-collapsed";

type NavItem = { href: string; label: string };

/**
 * children slots in the change-password link and sign-out form — those
 * stay server-rendered (sign-out is a server action) and are just laid
 * out here alongside the nav, rather than re-implemented client-side.
 * They pick up collapse/label behavior via the shared "sidebar-row" /
 * "sidebar-label" CSS classes (see globals.css), since collapse state
 * lives here but those rows don't.
 */
export default function Sidebar({
  businessName,
  navItems,
  children,
}: {
  businessName: string;
  navItems: NavItem[];
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_STORAGE_KEY) === "1");
    } catch {
      // localStorage unavailable (private mode, blocked) — just stay expanded.
    }
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(COLLAPSE_STORAGE_KEY, next ? "1" : "0");
      } catch {
        // ignore — nothing to persist to
      }
      return next;
    });
  };

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <>
      <div className="flex items-center justify-between border-b border-brand-hover bg-brand px-4 py-3 text-brand-contrast md:hidden">
        <Link href="/" className="text-lg font-bold text-brand-contrast no-underline">
          {businessName}
        </Link>
        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="Toggle navigation"
          className="rounded-md border border-brand-hover bg-transparent p-2 text-brand-contrast focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-contrast"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-20 bg-black/40 md:hidden" onClick={() => setMobileOpen(false)} />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-30 flex w-64 flex-col bg-brand text-brand-contrast transition-all duration-200 md:sticky md:top-0 md:h-screen md:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } ${collapsed ? "md:w-16" : "md:w-64"} ${collapsed ? "sidebar-collapsed" : ""}`}
      >
        <div className="sidebar-row hidden items-center justify-between gap-2 border-b border-brand-hover px-4 py-5 md:flex">
          <Link href="/" className="sidebar-label truncate text-lg font-bold text-brand-contrast no-underline">
            {businessName}
          </Link>
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="shrink-0 rounded-md p-1.5 text-brand-contrast-muted hover:bg-brand-hover hover:text-brand-contrast focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-contrast"
          >
            {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-3">
          {navItems.map((item) => {
            const Icon = ICONS[item.href] ?? LayoutDashboard;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                title={item.label}
                className={`sidebar-row relative flex items-center gap-3 rounded-md px-3 py-2.5 text-sm no-underline transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-contrast ${
                  active
                    ? "bg-brand-hover font-semibold text-brand-contrast"
                    : "text-brand-contrast-muted hover:bg-brand-hover hover:text-brand-contrast"
                }`}
              >
                {active && (
                  <span className="absolute inset-y-1 left-0 w-1 rounded-r bg-brand-contrast" aria-hidden="true" />
                )}
                <Icon className="h-4 w-4 shrink-0" />
                <span className="sidebar-label truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="space-y-1 border-t border-brand-hover px-3 py-3">{children}</div>
      </aside>
    </>
  );
}

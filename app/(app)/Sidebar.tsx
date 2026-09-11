"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  BookOpen,
  Users,
  Truck,
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
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  "/": LayoutDashboard,
  "/accounts": BookOpen,
  "/customers": Users,
  "/vendors": Truck,
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

type NavItem = { href: string; label: string };

/**
 * children slots in the change-password link and sign-out form — those
 * stay server-rendered (sign-out is a server action) and are just laid
 * out here alongside the nav, rather than re-implemented client-side.
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
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <>
      <div className="flex items-center justify-between bg-brand px-4 py-3 text-brand-contrast md:hidden">
        <Link href="/" className="text-lg font-bold text-brand-contrast no-underline">
          {businessName}
        </Link>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle navigation"
          className="rounded-md border border-brand-contrast/40 bg-transparent p-2 text-brand-contrast"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && <div className="fixed inset-0 z-20 bg-black/40 md:hidden" onClick={() => setOpen(false)} />}

      <aside
        className={`fixed inset-y-0 left-0 z-30 flex w-64 flex-col bg-brand text-brand-contrast transition-transform duration-200 md:sticky md:top-0 md:h-screen md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="hidden px-5 py-5 md:block">
          <Link href="/" className="text-lg font-bold text-brand-contrast no-underline">
            {businessName}
          </Link>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
          {navItems.map((item) => {
            const Icon = ICONS[item.href] ?? LayoutDashboard;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm no-underline transition-colors ${
                  active ? "bg-brand-hover font-semibold text-brand-contrast" : "text-brand-contrast/85 hover:bg-brand-hover"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="space-y-1 border-t border-brand-contrast/20 px-3 py-3">{children}</div>
      </aside>
    </>
  );
}

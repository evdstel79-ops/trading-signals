"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  href: string;
  label: string;
  description: string;
};

const navItems: NavItem[] = [
  {
    href: "/",
    label: "Dashboard",
    description: "Latest signals across all sources",
  },
  {
    href: "/political-trades",
    label: "Political Trades",
    description: "Congressional stock disclosures",
  },
  {
    href: "/insider-trades",
    label: "SEC Insider Trades",
    description: "Form 4 filings from corporate insiders",
  },
  {
    href: "/paper-trading",
    label: "Paper Trading",
    description: "Simulated trades + live P&L",
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col border-r border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
      <div className="px-6 py-6">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-emerald-600 text-sm font-semibold text-white">
            TS
          </div>
          <div>
            <div className="text-sm font-semibold leading-tight">
              Trading Signals
            </div>
            <div className="text-xs text-neutral-500 dark:text-neutral-400">
              Political &amp; insider flow
            </div>
          </div>
        </Link>
      </div>

      <nav className="flex-1 px-3">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`block rounded-md px-3 py-2 text-sm transition-colors ${
                    isActive
                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                      : "text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
                  }`}
                >
                  <div className="font-medium">{item.label}</div>
                  <div className="text-xs text-neutral-500 dark:text-neutral-400">
                    {item.description}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-neutral-200 px-6 py-4 text-xs text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
        v0.1.0
      </div>
    </aside>
  );
}

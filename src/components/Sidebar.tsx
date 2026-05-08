"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import GlobalSearch from "@/components/GlobalSearch";
import NotificationCenter from "@/components/NotificationCenter";
import ThemeToggle from "@/components/ThemeToggle";

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
    href: "/signals",
    label: "Signals",
    description: "Tickers ranked by signal strength",
  },
  {
    href: "/correlations",
    label: "Correlations",
    description: "Tickers traded by multiple members",
  },
  {
    href: "/alerts",
    label: "Alerts",
    description: "Price-cross browser notifications",
  },
  {
    href: "/politicians",
    label: "Politicians",
    description: "Members ranked by trading return",
  },
  {
    href: "/parties",
    label: "Parties",
    description: "Republicans vs. Democrats breakdown",
  },
  {
    href: "/insiders",
    label: "Insiders",
    description: "Corporate insiders ranked by buys",
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
    href: "/watchlist",
    label: "Watchlist",
    description: "Starred tickers + live prices",
  },
  {
    href: "/paper-trading",
    label: "Paper Trading",
    description: "Simulated trades + live P&L",
  },
  {
    href: "/journal",
    label: "Journal",
    description: "Notes and tags per trade",
  },
  {
    href: "/compare",
    label: "Compare",
    description: "Two tickers side by side",
  },
  {
    href: "/backtest",
    label: "Backtest",
    description: "Equal-weighted political-buy returns",
  },
  {
    href: "/movers",
    label: "Top Movers",
    description: "Best and worst political buys",
  },
  {
    href: "/sectors",
    label: "Sectors",
    description: "Where Congress is rotating capital",
  },
];

export default function Sidebar({
  mobileOpen,
  onClose,
}: {
  mobileOpen: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();

  return (
    <>
      {mobileOpen && (
        <div
          onClick={onClose}
          aria-hidden
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px] lg:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-screen w-64 shrink-0 transform flex-col border-r border-neutral-200 bg-white transition-transform duration-200 ease-out dark:border-neutral-800 dark:bg-neutral-900 lg:sticky lg:top-0 lg:translate-x-0 lg:transition-none ${
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
        aria-label="Primary navigation"
      >
        <div className="px-6 py-6">
          <Link
            href="/"
            onClick={onClose}
            className="flex items-center gap-2"
          >
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

        <div className="px-3 pb-3">
          <GlobalSearch />
        </div>

        <nav className="flex-1 overflow-y-auto px-3">
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
                    onClick={onClose}
                    className={`block min-h-[44px] rounded-md px-3 py-2 text-sm transition-colors lg:min-h-0 ${
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

        <div className="border-t border-neutral-200 px-3 py-3 dark:border-neutral-800">
          <div className="px-3">
            <NotificationCenter />
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-neutral-200 px-6 py-4 text-xs text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
          <ThemeToggle />
          <span>v0.1.0</span>
        </div>
      </aside>
    </>
  );
}

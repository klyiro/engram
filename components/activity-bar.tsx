"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GitBranch, Home, Network, Plug, Settings } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";

const ITEMS = [
  { href: "/", icon: Home, label: "Home", exact: true },
  { href: "/graph", icon: Network, label: "Graph" },
  { href: "/workspaces", icon: GitBranch, label: "Workspaces" },
  { href: "/connect", icon: Plug, label: "Connect an agent" },
  { href: "/settings", icon: Settings, label: "Settings" },
];

/** Icon rail left of the sidebar — the home for navigation + workspace/agent/settings controls. */
export function ActivityBar() {
  const pathname = usePathname();
  return (
    <aside className="flex h-dvh w-12 shrink-0 flex-col items-center gap-1 border-r border-border bg-sidebar py-2">
      {ITEMS.map(({ href, icon: Icon, label, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-label={label}
            className={`group relative inline-flex size-9 items-center justify-center rounded-md transition-colors ${
              active ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
            }`}
          >
            <Icon size={17} />
            <span className="pointer-events-none absolute left-11 z-30 whitespace-nowrap rounded-md border border-border bg-popover px-2 py-1 text-xs opacity-0 shadow-md transition-opacity group-hover:opacity-100">
              {label}
            </span>
          </Link>
        );
      })}
      <div className="mt-auto">
        <ThemeToggle />
      </div>
    </aside>
  );
}

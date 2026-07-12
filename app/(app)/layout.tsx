"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import useSWR from "swr";
import { Menu, Search } from "lucide-react";
import { ActivityBar } from "@/components/activity-bar";
import { Sidebar } from "@/components/sidebar";
import { CommandPalette } from "@/components/command-palette";
import { useArrowNav } from "@/lib/use-arrow-nav";
import { fetcher } from "@/lib/client";
import { cn } from "@/lib/utils";

const FALLBACK_NAME = process.env.NEXT_PUBLIC_APP_NAME || "Engram";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  useArrowNav();
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { data: feat } = useSWR<{ appName?: string }>("/api/features", fetcher);
  const appName = feat?.appName || FALLBACK_NAME;

  // Close the mobile nav drawer whenever the route changes (e.g. tapping a note).
  useEffect(() => setOpen(false), [pathname]);

  return (
    <div className="flex h-dvh flex-col overflow-hidden md:flex-row">
      {/* Mobile top bar — hidden on desktop, where the nav is always visible. */}
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border bg-sidebar px-2 md:hidden">
        <button
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
        >
          <Menu size={18} />
        </button>
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-primary" />
          <span className="text-sm font-medium tracking-tight">{appName}</span>
        </div>
        <button
          onClick={() => (window as unknown as { __openPalette?: () => void }).__openPalette?.()}
          aria-label="Search"
          className="ml-auto inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
        >
          <Search size={17} />
        </button>
      </header>

      {/* Backdrop — mobile only, when the drawer is open. */}
      {open && (
        <div className="fixed inset-0 z-30 bg-black/50 md:hidden" onClick={() => setOpen(false)} aria-hidden />
      )}

      {/* Nav: activity bar + sidebar. Off-canvas drawer on mobile, static column on desktop. */}
      <div
        className={cn(
          "z-40 flex shrink-0 transition-transform duration-200 ease-out",
          "fixed inset-y-0 left-0 md:static md:translate-x-0",
          open ? "translate-x-0 shadow-2xl" : "-translate-x-full",
        )}
      >
        <ActivityBar />
        <Sidebar />
      </div>

      <main className="relative min-w-0 flex-1 overflow-hidden">{children}</main>
      <CommandPalette />
    </div>
  );
}

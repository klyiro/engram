"use client";

import { Sidebar } from "@/components/sidebar";
import { CommandPalette } from "@/components/command-palette";
import { ThemeToggle } from "@/components/theme-toggle";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-dvh overflow-hidden">
      <Sidebar />
      <main className="relative flex-1 overflow-y-auto">
        <div className="absolute right-3 top-3 z-10">
          <ThemeToggle />
        </div>
        {children}
      </main>
      <CommandPalette />
    </div>
  );
}

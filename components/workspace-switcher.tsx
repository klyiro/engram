"use client";

import useSWR, { useSWRConfig } from "swr";
import Link from "next/link";
import { useState } from "react";
import { Check, ChevronsUpDown, Settings2 } from "lucide-react";
import { fetcher } from "@/lib/client";

interface Repo {
  id: string;
  name: string;
  active: boolean;
}

export function WorkspaceSwitcher() {
  const { data } = useSWR<{ repos: Repo[]; active: Repo | null }>("/api/repos", fetcher);
  const { mutate } = useSWRConfig();
  const [open, setOpen] = useState(false);

  const repos = data?.repos ?? [];
  const activeName = data?.active?.name ?? "Sample vault";

  async function switchTo(id: string) {
    await fetch("/api/repos/active", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) });
    for (const k of ["/api/repos", "/api/tree", "/api/notes"]) mutate(k);
    setOpen(false);
  }

  return (
    <div className="relative px-2 pb-2">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 rounded-md border border-border px-2 py-1.5 text-xs"
      >
        <span className="flex-1 truncate text-left text-foreground">{activeName}</span>
        <ChevronsUpDown size={13} className="shrink-0 text-muted-foreground" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-2 right-2 z-20 mt-1 rounded-md border border-border bg-popover p-1 shadow-lg">
            {repos.length === 0 && <div className="px-2 py-1.5 text-xs text-muted-foreground">Sample vault (no repos yet)</div>}
            {repos.map((r) => (
              <button
                key={r.id}
                onClick={() => switchTo(r.id)}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors hover:bg-accent"
              >
                <Check size={12} className={r.active ? "opacity-100" : "opacity-0"} />
                <span className="truncate">{r.name}</span>
              </button>
            ))}
            <Link
              href="/workspaces"
              onClick={() => setOpen(false)}
              className="mt-1 flex items-center gap-2 border-t border-border px-2 pb-1 pt-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              <Settings2 size={12} /> Manage workspaces
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

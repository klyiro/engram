"use client";

import useSWR, { useSWRConfig } from "swr";
import Link from "next/link";
import { useState } from "react";
import { Check, ChevronsUpDown, RefreshCw, Settings2 } from "lucide-react";
import { fetcher } from "@/lib/client";

interface Repo {
  id: string;
  name: string;
  active: boolean;
}
interface Sync {
  enabled: boolean;
  branch?: string;
  ahead?: number;
  behind?: number;
  dirty?: number;
  error?: boolean;
}

export function WorkspaceSwitcher() {
  const { data } = useSWR<{ repos: Repo[]; active: Repo | null }>("/api/repos", fetcher);
  const { data: sync } = useSWR<Sync>("/api/sync", fetcher, { refreshInterval: 10000 });
  const { mutate } = useSWRConfig();
  const [open, setOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const repos = data?.repos ?? [];
  const activeName = data?.active?.name ?? "Sample vault";
  const hasRemote = !!data?.active;

  // Live git status line — makes "it's a git repo" a constant truth, not a hidden setting.
  const branch = sync?.branch || "main";
  const changes = (sync?.ahead || 0) + (sync?.behind || 0) + (sync?.dirty || 0);
  const [dot, status] = !hasRemote
    ? ["bg-muted-foreground/40", "sample vault · local"]
    : sync?.enabled === false
      ? ["bg-muted-foreground/40", "sync off"]
      : sync?.error
        ? ["bg-amber-500", `${branch} · sync error`]
        : changes > 0
          ? ["bg-amber-500", `${branch} · ↑${sync?.ahead || 0} ↓${sync?.behind || 0}${sync?.dirty ? ` · ${sync.dirty} local` : ""}`]
          : ["bg-emerald-500", `${branch} · synced`];

  async function switchTo(id: string) {
    await fetch("/api/repos/active", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) });
    for (const k of ["/api/repos", "/api/tree", "/api/notes"]) mutate(k);
    setOpen(false);
  }

  async function refresh() {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await fetch("/api/sync", { method: "POST" });
      for (const k of ["/api/tree", "/api/notes", "/api/sync"]) mutate(k);
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="relative px-2 pb-2">
      <div className="flex items-center gap-1">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-md border border-border px-2 py-1.5 text-xs"
        >
          <span className="flex-1 truncate text-left text-foreground">{activeName}</span>
          <ChevronsUpDown size={13} className="shrink-0 text-muted-foreground" />
        </button>
        {hasRemote && (
          <button
            onClick={refresh}
            disabled={refreshing}
            title="Pull latest from the remote"
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
          >
            <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
          </button>
        )}
      </div>

      <div className="mt-1 flex items-center gap-1.5 px-1 text-[10px] text-muted-foreground">
        <span className={`size-1.5 shrink-0 rounded-full ${dot}`} />
        <span className="truncate">{status}</span>
      </div>

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

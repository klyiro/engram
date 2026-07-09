"use client";

import useSWR, { useSWRConfig } from "swr";
import { useState } from "react";
import { Check, GitBranch, Pencil, Plus, Trash2, X } from "lucide-react";
import { fetcher } from "@/lib/client";
import { timeAgo } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Repo {
  id: string;
  name: string;
  fullName?: string;
  url: string;
  branch: string;
  active: boolean;
  addedAt: string;
}
interface GhRepo {
  fullName: string;
  name: string;
  cloneUrl: string;
  private: boolean;
  defaultBranch: string;
}

function refresh(mutate: (key: string) => unknown) {
  for (const k of ["/api/repos", "/api/tree", "/api/notes", "/api/sync"]) mutate(k);
}

export default function WorkspacesPage() {
  const { data: gh } = useSWR<{ connected: boolean; login?: string; configured: boolean }>("/api/github/status", fetcher);
  const { data: reposData } = useSWR<{ repos: Repo[] }>("/api/repos", fetcher);
  const { data: ghRepos } = useSWR<{ repos: GhRepo[] }>(gh?.connected ? "/api/github/repos" : null, fetcher);
  const { mutate } = useSWRConfig();

  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [manual, setManual] = useState({ url: "", token: "", name: "" });
  const [ghSearch, setGhSearch] = useState("");
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);

  const repos = reposData?.repos ?? [];
  const addedNames = new Set(repos.map((r) => r.fullName));

  async function add(r: GhRepo) {
    setBusy(r.fullName);
    setErr("");
    try {
      const res = await fetch("/api/repos", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fullName: r.fullName, cloneUrl: r.cloneUrl, branch: r.defaultBranch }),
      });
      const d = await res.json();
      if (!res.ok) setErr(d.error || "add failed");
      else {
        refresh(mutate);
        setAddOpen(false);
      }
    } finally {
      setBusy(null);
    }
  }

  async function addManual() {
    if (!manual.url.trim()) return;
    setBusy("manual");
    setErr("");
    try {
      const res = await fetch("/api/repos", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          cloneUrl: manual.url.trim(),
          token: manual.token.trim() || undefined,
          name: manual.name.trim() || undefined,
        }),
      });
      const d = await res.json();
      if (!res.ok) setErr(d.error || "add failed");
      else {
        setManual({ url: "", token: "", name: "" });
        refresh(mutate);
        setAddOpen(false);
      }
    } finally {
      setBusy(null);
    }
  }

  async function switchTo(id: string) {
    await fetch("/api/repos/active", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) });
    refresh(mutate);
  }
  async function remove(id: string) {
    await fetch(`/api/repos/${id}`, { method: "DELETE" });
    refresh(mutate);
  }
  async function saveRename() {
    if (!editing) return;
    const { id, name } = editing;
    setEditing(null);
    if (!name.trim()) return;
    await fetch(`/api/repos/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ name }) });
    mutate("/api/repos");
  }

  const filteredGh = (ghRepos?.repos ?? []).filter((r) => r.fullName.toLowerCase().includes(ghSearch.toLowerCase()));

  return (
    <div className="scrollbar-none h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl px-8 py-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Workspaces</h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              Each workspace is a GitHub repo of markdown. The <span className="text-foreground">active</span> one is what
              the dashboard shows and what agents read/write — agents never see the others.
            </p>
          </div>

          <Dialog open={addOpen} onOpenChange={(o) => { setAddOpen(o); setErr(""); }}>
            <DialogTrigger asChild>
              <Button className="shrink-0">
                <Plus size={15} /> Add workspace
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Add a workspace</DialogTitle>
                <DialogDescription>Connect a GitHub repo of markdown as a vault.</DialogDescription>
              </DialogHeader>

              {/* GitHub path */}
              <div className="space-y-2">
                <Label>From GitHub</Label>
                {!gh?.configured ? (
                  <p className="text-xs text-muted-foreground">
                    GitHub OAuth isn&apos;t configured on this server. Add <code className="rounded bg-muted px-1">GITHUB_CLIENT_ID</code> /{" "}
                    <code className="rounded bg-muted px-1">GITHUB_CLIENT_SECRET</code> in Settings, or use the URL option below.
                  </p>
                ) : !gh?.connected ? (
                  <Button asChild variant="outline" className="w-full">
                    <a href="/api/github/login?next=/workspaces">
                      <GitBranch size={15} /> Connect GitHub
                    </a>
                  </Button>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                      Connected as <span className="text-foreground">{gh.login}</span>.
                    </p>
                    <Input placeholder="Filter repos…" value={ghSearch} onChange={(e) => setGhSearch(e.target.value)} />
                    <div className="scrollbar-none max-h-52 divide-y divide-border overflow-y-auto rounded-lg border border-border">
                      {filteredGh.length === 0 && <p className="px-3 py-3 text-xs text-muted-foreground">No repos match.</p>}
                      {filteredGh.map((r) => (
                        <div key={r.fullName} className="flex items-center justify-between gap-2 px-3 py-2">
                          <span className="truncate text-sm">
                            {r.fullName}
                            {r.private && <span className="ml-2 text-[10px] text-muted-foreground">private</span>}
                          </span>
                          {addedNames.has(r.fullName) ? (
                            <span className="shrink-0 text-xs text-muted-foreground">added</span>
                          ) : (
                            <Button size="sm" variant="outline" disabled={busy === r.fullName} onClick={() => add(r)}>
                              {busy === r.fullName ? "Adding…" : "Add"}
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* OR divider */}
              <div className="flex items-center gap-3">
                <Separator className="flex-1" />
                <span className="text-xs font-medium text-muted-foreground">OR</span>
                <Separator className="flex-1" />
              </div>

              {/* URL + token path */}
              <div className="space-y-2">
                <Label htmlFor="repoUrl">By URL + token</Label>
                <p className="text-xs text-muted-foreground">Works without connecting GitHub — the zero-setup path for self-hosting.</p>
                <Input
                  id="repoUrl"
                  value={manual.url}
                  onChange={(e) => setManual((m) => ({ ...m, url: e.target.value }))}
                  placeholder="https://github.com/you/vault.git"
                />
                <Input
                  type="password"
                  value={manual.token}
                  onChange={(e) => setManual((m) => ({ ...m, token: e.target.value }))}
                  placeholder="GitHub token with repo access (private repos / push)"
                />
                <div className="flex gap-2">
                  <Input
                    value={manual.name}
                    onChange={(e) => setManual((m) => ({ ...m, name: e.target.value }))}
                    placeholder="name (optional)"
                    className="flex-1"
                  />
                  <Button onClick={addManual} disabled={busy === "manual" || !manual.url.trim()}>
                    {busy === "manual" ? "Adding…" : "Add repo"}
                  </Button>
                </div>
              </div>

              {err && <p className="text-xs text-destructive">{err}</p>}
            </DialogContent>
          </Dialog>
        </div>

        {/* Connected workspaces */}
        <section className="mt-8 space-y-2.5">
          {repos.length === 0 ? (
            <Card className="items-center gap-2 border-dashed p-8 text-center">
              <GitBranch size={20} className="text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No workspaces yet. The dashboard is showing the bundled <span className="text-foreground">sample vault</span> —
                add a repo to make it your own.
              </p>
              <Button variant="outline" size="sm" onClick={() => setAddOpen(true)}>
                <Plus size={14} /> Add your first workspace
              </Button>
            </Card>
          ) : (
            repos.map((r) => (
              <Card key={r.id} className={`flex-row items-center gap-4 p-4 ${r.active ? "border-ring" : ""}`}>
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground">
                  <GitBranch size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  {editing?.id === r.id ? (
                    <div className="flex items-center gap-2">
                      <Input
                        autoFocus
                        value={editing.name}
                        onChange={(e) => setEditing({ id: r.id, name: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveRename();
                          if (e.key === "Escape") setEditing(null);
                        }}
                        className="h-7 max-w-xs"
                      />
                      <Button size="icon" variant="ghost" className="size-7" onClick={saveRename} title="Save">
                        <Check size={14} />
                      </Button>
                      <Button size="icon" variant="ghost" className="size-7" onClick={() => setEditing(null)} title="Cancel">
                        <X size={14} />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">{r.name}</span>
                      {r.active && <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">active</Badge>}
                    </div>
                  )}
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {r.fullName ?? r.url.replace(/^https?:\/\//, "").replace(/\.git$/, "")}
                    {" · "}
                    <span className="font-mono">{r.branch}</span>
                    {r.addedAt ? ` · added ${timeAgo(r.addedAt)}` : ""}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  {!r.active && (
                    <Button size="sm" variant="outline" onClick={() => switchTo(r.id)}>
                      Set active
                    </Button>
                  )}
                  <Button size="icon" variant="ghost" className="size-8 text-muted-foreground" title="Rename" onClick={() => setEditing({ id: r.id, name: r.name })}>
                    <Pencil size={14} />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="icon" variant="ghost" className="size-8 text-muted-foreground hover:text-destructive" title="Remove">
                        <Trash2 size={14} />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remove “{r.name}”?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This removes the workspace and its local clone from Engram. Your GitHub repo and its history are untouched —
                          you can re-add it anytime.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => remove(r.id)}>Remove</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </Card>
            ))
          )}
        </section>
      </div>
    </div>
  );
}

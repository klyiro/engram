"use client";

import useSWR, { useSWRConfig } from "swr";
import { useState } from "react";
import { GitBranch, Trash2 } from "lucide-react";
import { fetcher } from "@/lib/client";

interface Repo {
  id: string;
  name: string;
  fullName?: string;
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
  for (const k of ["/api/repos", "/api/tree", "/api/notes"]) mutate(k);
}

export default function WorkspacesPage() {
  const { data: gh } = useSWR<{ connected: boolean; login?: string; configured: boolean }>("/api/github/status", fetcher);
  const { data: reposData } = useSWR<{ repos: Repo[] }>("/api/repos", fetcher);
  const { data: ghRepos } = useSWR<{ repos: GhRepo[] }>(gh?.connected ? "/api/github/repos" : null, fetcher);
  const { mutate } = useSWRConfig();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [manual, setManual] = useState({ url: "", token: "", name: "" });

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
      else refresh(mutate);
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

  return (
    <div className="scrollbar-none h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl px-8 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Workspaces</h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          Each workspace is a GitHub repo of markdown. The <span className="text-foreground">active</span> one is what the
          dashboard shows and what agents read/write — agents never see the others.
        </p>

        <section className="mt-8 space-y-2">
          <h2 className="text-sm font-medium">GitHub</h2>
          {!gh?.configured ? (
            <p className="text-sm text-muted-foreground">GitHub OAuth isn&apos;t configured on this server (set GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET).</p>
          ) : gh?.connected ? (
            <p className="text-sm text-muted-foreground">
              Connected as <span className="text-foreground">{gh.login}</span>.
            </p>
          ) : (
            <a
              href="/api/github/login?next=/workspaces"
              className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
            >
              <GitBranch size={15} /> Connect GitHub
            </a>
          )}
        </section>

        <section className="mt-8 space-y-2">
          <h2 className="text-sm font-medium">Your workspaces</h2>
          {repos.length > 0 ? (
            <div className="overflow-hidden rounded-lg border border-border">
              <table className="w-full text-sm">
                <tbody>
                  {repos.map((r) => (
                    <tr key={r.id} className="border-b border-border last:border-0">
                      <td className="px-3 py-2">
                        {r.name}
                        {r.active && <span className="ml-2 rounded bg-accent px-1.5 py-0.5 text-[10px] text-foreground">active</span>}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {!r.active && (
                          <button onClick={() => switchTo(r.id)} className="mr-2 rounded-md border border-border px-2 py-1 text-xs transition-colors hover:bg-accent">
                            Switch
                          </button>
                        )}
                        <button
                          onClick={() => remove(r.id)}
                          title="Remove"
                          className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-destructive"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No workspaces yet — add a repo below. Until then, the dashboard shows the bundled sample vault.</p>
          )}
        </section>

        <section className="mt-8 space-y-2">
          <h2 className="text-sm font-medium">Add a repo by URL + token</h2>
          <p className="text-sm text-muted-foreground">
            Paste a repo URL and a GitHub token with access to it. Works without connecting GitHub — the
            zero-setup path for self-hosting.
          </p>
          {err && <p className="text-xs text-destructive">{err}</p>}
          <div className="space-y-2">
            <input
              value={manual.url}
              onChange={(e) => setManual((m) => ({ ...m, url: e.target.value }))}
              placeholder="https://github.com/you/vault.git"
              className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm outline-none placeholder:text-muted-foreground"
            />
            <input
              value={manual.token}
              onChange={(e) => setManual((m) => ({ ...m, token: e.target.value }))}
              type="password"
              placeholder="GitHub token with repo access (for private repos / push)"
              className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm outline-none placeholder:text-muted-foreground"
            />
            <div className="flex gap-2">
              <input
                value={manual.name}
                onChange={(e) => setManual((m) => ({ ...m, name: e.target.value }))}
                placeholder="name (optional)"
                className="w-56 rounded-md border border-border bg-background px-2.5 py-1.5 text-sm outline-none placeholder:text-muted-foreground"
              />
              <button
                onClick={addManual}
                disabled={busy === "manual"}
                className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                {busy === "manual" ? "Adding…" : "Add repo"}
              </button>
            </div>
          </div>
        </section>

        {gh?.connected && (
          <section className="mt-8 space-y-2">
            <h2 className="text-sm font-medium">Add from GitHub</h2>
            {err && <p className="text-xs text-destructive">{err}</p>}
            <div className="scrollbar-none max-h-96 overflow-y-auto overflow-hidden rounded-lg border border-border">
              <table className="w-full text-sm">
                <tbody>
                  {(ghRepos?.repos ?? []).map((r) => (
                    <tr key={r.fullName} className="border-b border-border last:border-0">
                      <td className="px-3 py-2">
                        {r.fullName}
                        {r.private && <span className="ml-2 text-[10px] text-muted-foreground">private</span>}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {addedNames.has(r.fullName) ? (
                          <span className="text-xs text-muted-foreground">added</span>
                        ) : (
                          <button
                            disabled={busy === r.fullName}
                            onClick={() => add(r)}
                            className="rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground disabled:opacity-50"
                          >
                            {busy === r.fullName ? "Adding…" : "Add"}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

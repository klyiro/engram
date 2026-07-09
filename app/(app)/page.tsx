"use client";

import Link from "next/link";
import useSWR, { useSWRConfig } from "swr";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Brain, Check, GitBranch, Plug, Search } from "lucide-react";
import { fetcher, folderColor } from "@/lib/client";
import { CuratorChat } from "@/components/curator-chat";
import { ActivityList, type ActivityEntry } from "@/components/activity-list";
import { RecentNotes } from "@/components/recent-notes";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";

interface Repo {
  id: string;
  name: string;
  fullName?: string;
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
interface Settings {
  gitSyncEnabled: boolean;
  harnessEnabledFlag: boolean;
  anthropicApiKeySet: boolean;
}
interface Stats {
  notes: number;
  folders: number;
  links: number;
}
interface Hit {
  path: string;
  title: string;
  folder: string;
  type?: string;
}

const iconBox = "flex size-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground";
const APP_NAME_FALLBACK = process.env.NEXT_PUBLIC_APP_NAME || "Engram";

function StatusDot({ ok, label }: { ok?: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1 text-xs ${ok ? "text-emerald-500" : "text-muted-foreground"}`}>
      <span className={`size-1.5 rounded-full ${ok ? "bg-emerald-500" : "bg-muted-foreground/50"}`} />
      {label}
    </span>
  );
}

function PillarBody({ icon, title, desc, state, ok }: { icon: React.ReactNode; title: string; desc: string; state?: string; ok?: boolean }) {
  return (
    <>
      <div className={iconBox}>{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{title}</span>
          {state && <StatusDot ok={ok} label={state} />}
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>
      </div>
    </>
  );
}

function LinkPillar(props: { icon: React.ReactNode; title: string; desc: string; state?: string; ok?: boolean; href: string; cta: string }) {
  return (
    <Link href={props.href} className="block">
      <Card className="group flex-row items-center gap-4 p-4 transition-colors hover:border-ring">
        <PillarBody icon={props.icon} title={props.title} desc={props.desc} state={props.state} ok={props.ok} />
        <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs text-muted-foreground transition-colors group-hover:text-foreground">
          {props.ok ? <Check size={13} /> : null}
          {props.cta}
          <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
        </span>
      </Card>
    </Link>
  );
}

function TogglePillar(props: { icon: React.ReactNode; title: string; desc: string; state?: string; ok?: boolean; on: boolean; onToggle: (v: boolean) => void; footer?: React.ReactNode }) {
  return (
    <Card className="gap-0 overflow-hidden p-0">
      <div className="flex items-center gap-4 p-4">
        <PillarBody icon={props.icon} title={props.title} desc={props.desc} state={props.state} ok={props.ok} />
        <Switch checked={props.on} onCheckedChange={props.onToggle} />
      </div>
      {props.footer && <div className="border-t border-border px-4 py-2 text-xs text-muted-foreground">{props.footer}</div>}
    </Card>
  );
}

export default function Home() {
  const { mutate } = useSWRConfig();
  const { data: repos } = useSWR<{ repos: Repo[]; active: Repo | null }>("/api/repos", fetcher);
  const { data: sync } = useSWR<Sync>("/api/sync", fetcher, { refreshInterval: 10000 });
  const { data: feat } = useSWR<{ harness?: boolean; mcpAuthRequired?: boolean; appName?: string }>("/api/features", fetcher);
  const { data: tok } = useSWR<{ tokens: { id: string }[] }>("/api/tokens", fetcher);
  const { data: settings } = useSWR<Settings>("/api/settings", fetcher);
  const { data: activity } = useSWR<{ activity: ActivityEntry[] }>("/api/activity?limit=8", fetcher, { refreshInterval: 15000 });
  const { data: stats } = useSWR<Stats>("/api/stats", fetcher);

  const active = repos?.active ?? null;
  const appName = feat?.appName || APP_NAME_FALLBACK;
  const tokenCount = tok?.tokens?.length ?? 0;

  // Toggle state mirrors saved settings; hydrate once they arrive.
  const [gitSyncOn, setGitSyncOn] = useState(false);
  const [curatorOn, setCuratorOn] = useState(false);
  useEffect(() => {
    if (!settings) return;
    setGitSyncOn(settings.gitSyncEnabled);
    setCuratorOn(settings.harnessEnabledFlag);
  }, [settings]);

  // Inline search over the vault.
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Hit[]>([]);
  const [searching, setSearching] = useState(false);
  const searchSeq = useRef(0);
  useEffect(() => {
    const query = q.trim();
    if (!query) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const seq = ++searchSeq.current;
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const d = await r.json();
        if (seq === searchSeq.current) setResults(d.results ?? []);
      } catch {
        if (seq === searchSeq.current) setResults([]);
      } finally {
        if (seq === searchSeq.current) setSearching(false);
      }
    }, 150);
    return () => clearTimeout(t);
  }, [q]);

  async function patch(body: Record<string, unknown>, ...keys: string[]) {
    await fetch("/api/settings", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    for (const k of keys) mutate(k);
  }
  function toggleGitSync(v: boolean) {
    setGitSyncOn(v);
    patch({ gitSyncEnabled: v }, "/api/settings", "/api/sync");
  }
  function toggleCurator(v: boolean) {
    setCuratorOn(v);
    patch({ harnessEnabled: v }, "/api/settings", "/api/features");
  }

  // Curator on → the home is a chat window over your brain.
  if (feat?.harness) return <CuratorChat />;

  const recent = activity?.activity ?? [];

  // ── No vault connected → focused onboarding (the one time setup belongs front-and-center). ──
  if (!active) {
    const curatorNeedsKey = curatorOn && !settings?.anthropicApiKeySet;
    return (
      <div className="scrollbar-none h-full overflow-y-auto">
        <div className="mx-auto flex min-h-full max-w-2xl flex-col px-8 py-12">
          <div className="my-auto space-y-6">
            <div>
              <div className="flex items-center gap-2">
                <div className="size-2 rounded-full bg-primary" />
                <h1 className="text-lg font-semibold tracking-tight">{appName}</h1>
              </div>
              <p className="mt-1.5 text-sm text-muted-foreground">
                A second brain your agents read and write — a git repo of markdown, live over MCP. Connect a vault to begin.
              </p>
            </div>
            <div className="space-y-2.5">
              <LinkPillar
                icon={<GitBranch size={16} />}
                title="Vault"
                ok={false}
                state="not connected"
                desc="Connect a git repo of markdown — the source of truth for humans and agents. Start here."
                href="/workspaces"
                cta="Connect a repo"
              />
              <LinkPillar
                icon={<Plug size={16} />}
                title="Agents"
                ok={tokenCount > 0}
                state={tokenCount > 0 ? `${tokenCount} token${tokenCount === 1 ? "" : "s"}` : "none yet"}
                desc="Point Claude Code, Cursor, Hermes, or Claude.ai at the MCP endpoint to read + write this brain."
                href="/connect"
                cta={tokenCount > 0 ? "Manage" : "Connect an agent"}
              />
              <TogglePillar
                icon={<Brain size={16} />}
                title="Curator"
                ok={false}
                state={curatorNeedsKey ? "needs API key" : curatorOn ? "on" : "off · optional"}
                desc="An optional chat agent that reads your notes to answer. Turn it on anytime."
                on={curatorOn}
                onToggle={toggleCurator}
                footer={
                  curatorNeedsKey ? (
                    <>
                      Add your Anthropic API key in{" "}
                      <Link href="/settings" className="text-foreground underline underline-offset-2">Settings</Link> to activate it.
                    </>
                  ) : undefined
                }
              />
            </div>
            <p className="text-center text-xs text-muted-foreground">
              Press <kbd className="rounded border border-border px-1.5 py-0.5 font-mono text-[11px]">⌘K</kbd> to search the sample vault.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Vault connected → the "brain home": search-first, with recents + activity. ──
  const gitDetail = sync?.error
    ? "sync error"
    : sync?.ahead || sync?.behind || sync?.dirty
      ? `${sync?.dirty || 0} local · ↑${sync?.ahead || 0} ↓${sync?.behind || 0}`
      : "synced";

  return (
    <div className="scrollbar-none h-full overflow-y-auto">
      <div className="mx-auto max-w-2xl px-8 py-12">
        <div className="flex items-baseline justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="size-2 rounded-full bg-primary" />
            <h1 className="text-lg font-semibold tracking-tight">{appName}</h1>
          </div>
          {stats && (
            <p className="text-xs text-muted-foreground">
              {stats.notes} notes · {stats.folders} folders · {stats.links} links
            </p>
          )}
        </div>

        <div className="relative mt-6">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search your brain…"
            className="h-11 pl-9 text-sm"
            aria-label="Search your brain"
          />
        </div>

        {q.trim() ? (
          <div className="mt-3 overflow-hidden rounded-lg border border-border">
            {results.length === 0 ? (
              <p className="px-3 py-3 text-sm text-muted-foreground">{searching ? "Searching…" : "No matches."}</p>
            ) : (
              <ul className="divide-y divide-border">
                {results.slice(0, 10).map((r) => (
                  <li key={r.path}>
                    <Link href={`/n/${r.path}`} className="flex items-center gap-2.5 px-3 py-2 transition-colors hover:bg-accent/60">
                      <span className="size-1.5 shrink-0 rounded-full" style={{ background: folderColor(r.folder) }} />
                      <span className="truncate text-sm">{r.title}</span>
                      <span className="ml-auto max-w-[45%] shrink-0 truncate font-mono text-xs text-muted-foreground">{r.path}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <div className="mt-8 space-y-8">
            <RecentNotes heading="Jump back in" />
            {recent.length > 0 && (
              <section>
                <div className="mb-1 flex items-center justify-between">
                  <h2 className="text-sm font-medium">Recent activity</h2>
                  <Link href="/activity" className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground">
                    View all <ArrowRight size={12} />
                  </Link>
                </div>
                <ActivityList entries={recent} />
              </section>
            )}
          </div>
        )}

        {/* Neutral controls — settings, not a checklist. */}
        <div className="mt-10 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border pt-4 text-xs text-muted-foreground">
          <label className="flex items-center gap-2">
            <Switch checked={gitSyncOn} onCheckedChange={toggleGitSync} />
            <span>Git sync {gitSyncOn ? <span className="text-muted-foreground/70">· {gitDetail}</span> : null}</span>
          </label>
          <label className="flex items-center gap-2">
            <Switch checked={curatorOn} onCheckedChange={toggleCurator} />
            <span>Curator {curatorOn && !settings?.anthropicApiKeySet ? <span className="text-amber-500/80">· needs key</span> : null}</span>
          </label>
          <Link href="/connect" className="inline-flex items-center gap-1 transition-colors hover:text-foreground">
            <Plug size={12} /> {tokenCount > 0 ? `${tokenCount} agent${tokenCount === 1 ? "" : "s"}` : "Connect an agent"}
          </Link>
          <Link href="/settings" className="inline-flex items-center gap-1 transition-colors hover:text-foreground">
            Settings
          </Link>
        </div>
      </div>
    </div>
  );
}

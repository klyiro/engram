"use client";

import Link from "next/link";
import useSWR, { useSWRConfig } from "swr";
import { useEffect, useState } from "react";
import { ArrowRight, Brain, Check, GitBranch, Plug, RefreshCw } from "lucide-react";
import { fetcher } from "@/lib/client";
import { CuratorChat } from "@/components/curator-chat";
import { ActivityList, type ActivityEntry } from "@/components/activity-list";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";

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

const iconBox = "flex size-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground";

function StatusDot({ ok, label }: { ok?: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1 text-xs ${ok ? "text-emerald-500" : "text-muted-foreground"}`}>
      <span className={`size-1.5 rounded-full ${ok ? "bg-emerald-500" : "bg-muted-foreground/50"}`} />
      {label}
    </span>
  );
}

function PillarBody({
  icon,
  title,
  desc,
  state,
  ok,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  state?: string;
  ok?: boolean;
}) {
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

/** Navigational pillar — the whole card links somewhere. */
function LinkPillar(props: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  state?: string;
  ok?: boolean;
  href: string;
  cta: string;
}) {
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

/** Feature pillar with an inline on/off Switch + optional footer note. */
function TogglePillar(props: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  state?: string;
  ok?: boolean;
  on: boolean;
  onToggle: (v: boolean) => void;
  footer?: React.ReactNode;
}) {
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

const APP_NAME_FALLBACK = process.env.NEXT_PUBLIC_APP_NAME || "Engram";

export default function Home() {
  const { mutate } = useSWRConfig();
  const { data: repos } = useSWR<{ repos: Repo[]; active: Repo | null }>("/api/repos", fetcher);
  const { data: sync } = useSWR<Sync>("/api/sync", fetcher, { refreshInterval: 10000 });
  const { data: feat } = useSWR<{ harness?: boolean; mcpAuthRequired?: boolean; appName?: string }>("/api/features", fetcher);
  const { data: tok } = useSWR<{ tokens: { id: string }[] }>("/api/tokens", fetcher);
  const { data: settings } = useSWR<Settings>("/api/settings", fetcher);
  const { data: activity } = useSWR<{ activity: ActivityEntry[] }>("/api/activity?limit=10", fetcher, { refreshInterval: 15000 });

  const active = repos?.active ?? null;
  const appName = feat?.appName || APP_NAME_FALLBACK;
  const tokenCount = tok?.tokens?.length ?? 0;

  // Toggle state mirrors the saved settings; hydrate once they arrive.
  const [gitSyncOn, setGitSyncOn] = useState(false);
  const [curatorOn, setCuratorOn] = useState(false);
  useEffect(() => {
    if (!settings) return;
    setGitSyncOn(settings.gitSyncEnabled);
    setCuratorOn(settings.harnessEnabledFlag);
  }, [settings]);

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

  const gitDetail = sync?.error
    ? "sync error"
    : sync?.ahead || sync?.behind || sync?.dirty
      ? `${sync?.dirty || 0} local · ↑${sync?.ahead || 0} ↓${sync?.behind || 0}`
      : "synced";
  const gitState = !active ? "no vault yet" : gitSyncOn ? gitDetail : "off";
  const gitOk = !!active && gitSyncOn && !sync?.error;

  const curatorNeedsKey = curatorOn && !settings?.anthropicApiKeySet;
  const recent = activity?.activity ?? [];

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
              A second brain your agents read and write — a git repo of markdown, live over MCP.
            </p>
          </div>

          <div className="flex flex-col gap-2.5">
            <LinkPillar
              icon={<GitBranch size={16} />}
              title="Vault"
              ok={!!active}
              state={active ? active.name : "not connected"}
              desc={active ? "Your notes live in this git repo — versioned and portable." : "Connect a git repo of markdown — the source of truth for humans and agents."}
              href="/workspaces"
              cta={active ? "Manage" : "Connect a repo"}
            />
            <TogglePillar
              icon={<RefreshCw size={16} />}
              title="Git sync"
              ok={gitOk}
              state={gitState}
              desc="Auto commit + push every change to the vault's remote. Author + advanced options in Settings."
              on={gitSyncOn}
              onToggle={toggleGitSync}
              footer={
                gitSyncOn && !active ? (
                  <>
                    Connect a vault in{" "}
                    <Link href="/workspaces" className="text-foreground underline underline-offset-2">Workspaces</Link>{" "}
                    to start syncing.
                  </>
                ) : undefined
              }
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
              state={curatorNeedsKey ? "needs API key" : curatorOn ? "on" : "off"}
              desc="A chat agent that reads your notes to answer, and files rough dumps into the right place."
              on={curatorOn}
              onToggle={toggleCurator}
              footer={
                curatorNeedsKey ? (
                  <>
                    Add your Anthropic API key in{" "}
                    <Link href="/settings" className="text-foreground underline underline-offset-2">Settings</Link>{" "}
                    to activate it.
                  </>
                ) : undefined
              }
            />
          </div>

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

          <p className="text-center text-xs text-muted-foreground">
            Select a note, or press{" "}
            <kbd className="rounded border border-border px-1.5 py-0.5 font-mono text-[11px]">⌘K</kbd> to search.
          </p>
        </div>
      </div>
    </div>
  );
}

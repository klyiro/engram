"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, FileText, GitCommit } from "lucide-react";
import { timeAgo } from "@/lib/utils";

export interface ActivityEntry {
  hash: string;
  message: string;
  author: string;
  date: string;
}

interface CommitFile {
  status: string;
  path: string;
  oldPath?: string;
}
interface CommitDetail {
  files: CommitFile[];
  diff: string;
  truncated: boolean;
}
type DetailState = CommitDetail | "loading" | "error" | undefined;

const STATUS_META: Record<string, { label: string; className: string }> = {
  A: { label: "added", className: "text-emerald-500" },
  M: { label: "modified", className: "text-amber-500" },
  D: { label: "deleted", className: "text-destructive" },
  R: { label: "renamed", className: "text-blue-400" },
  C: { label: "copied", className: "text-blue-400" },
  T: { label: "changed", className: "text-muted-foreground" },
};

/** One line of a unified diff, colored by its prefix. */
function diffLineClass(line: string): string {
  if (line.startsWith("diff --git") || line.startsWith("index ")) return "text-muted-foreground/60";
  if (line.startsWith("@@")) return "text-blue-400";
  if (line.startsWith("+++") || line.startsWith("---")) return "text-muted-foreground";
  if (line.startsWith("+")) return "text-emerald-500";
  if (line.startsWith("-")) return "text-destructive";
  return "text-muted-foreground";
}

function noteHref(f: CommitFile): string | null {
  return f.status !== "D" && f.path.toLowerCase().endsWith(".md") ? `/n/${f.path}` : null;
}

function CommitDetailView({ detail }: { detail: CommitDetail }) {
  const [showDiff, setShowDiff] = useState(false);
  return (
    <div className="mt-2 space-y-2 border-l border-border pl-3">
      <ul className="space-y-1">
        {detail.files.length === 0 && <li className="text-xs text-muted-foreground">No file changes.</li>}
        {detail.files.map((f, i) => {
          const meta = STATUS_META[f.status] ?? STATUS_META.T;
          const href = noteHref(f);
          return (
            <li key={`${f.path}-${i}`} className="flex items-center gap-2 text-xs">
              <span className={`w-4 shrink-0 text-center font-mono font-semibold ${meta.className}`} title={meta.label}>
                {f.status}
              </span>
              {href ? (
                <Link href={href} className="inline-flex items-center gap-1 truncate text-foreground hover:underline">
                  <FileText size={12} className="shrink-0 text-muted-foreground" />
                  {f.oldPath ? `${f.oldPath} → ${f.path}` : f.path}
                </Link>
              ) : (
                <span className="inline-flex items-center gap-1 truncate text-muted-foreground">
                  <FileText size={12} className="shrink-0" />
                  {f.oldPath ? `${f.oldPath} → ${f.path}` : f.path}
                </span>
              )}
            </li>
          );
        })}
      </ul>

      {detail.diff.trim() && (
        <div>
          <button onClick={() => setShowDiff((v) => !v)} className="text-xs text-muted-foreground transition-colors hover:text-foreground">
            {showDiff ? "Hide diff" : "Show diff"}
          </button>
          {showDiff && (
            <div className="mt-1.5 overflow-x-auto rounded-md border border-border bg-muted/30">
              <pre className="w-max min-w-full p-3 font-mono text-[11px] leading-relaxed">
                {detail.diff.split("\n").map((line, i) => (
                  <div key={i} className={diffLineClass(line)}>
                    {line || " "}
                  </div>
                ))}
              </pre>
              {detail.truncated && <p className="border-t border-border px-3 py-1.5 text-[11px] text-muted-foreground">Diff truncated — open the note to see the full content.</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** A commit feed for the vault — shared by the home preview and the full Activity page.
 *  Each entry expands to show the files it changed (linking to the note) plus the raw diff. */
export function ActivityList({ entries, empty }: { entries: ActivityEntry[]; empty?: string }) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [details, setDetails] = useState<Record<string, DetailState>>({});

  async function toggle(hash: string) {
    const next = new Set(open);
    if (next.has(hash)) {
      next.delete(hash);
      setOpen(next);
      return;
    }
    next.add(hash);
    setOpen(next);
    if (details[hash] && details[hash] !== "error") return; // already loaded
    setDetails((d) => ({ ...d, [hash]: "loading" }));
    try {
      const res = await fetch(`/api/activity/${hash}`);
      if (!res.ok) throw new Error();
      const data = (await res.json()) as CommitDetail;
      setDetails((d) => ({ ...d, [hash]: data }));
    } catch {
      setDetails((d) => ({ ...d, [hash]: "error" }));
    }
  }

  if (entries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {empty ?? "No activity yet — changes agents and teammates make to your vault will show up here."}
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border">
      {entries.map((e, i) => {
        const isOpen = open.has(e.hash);
        const detail = details[e.hash];
        return (
          <li key={`${e.hash}-${i}`} className="py-2.5">
            <button onClick={() => toggle(e.hash)} className="flex w-full items-start gap-3 text-left">
              <span className="mt-0.5 shrink-0 text-muted-foreground">
                <GitCommit size={15} className={isOpen ? "hidden" : ""} />
                <ChevronRight size={15} className={`${isOpen ? "rotate-90" : "hidden"} transition-transform`} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{e.message}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {e.author} · <span className="font-mono">{e.hash}</span> · {timeAgo(e.date)}
                </span>
              </span>
            </button>
            {isOpen && (
              <div className="ml-[27px]">
                {detail === "loading" && <p className="mt-2 text-xs text-muted-foreground">Loading changes…</p>}
                {detail === "error" && <p className="mt-2 text-xs text-destructive">Couldn&apos;t load this commit&apos;s changes.</p>}
                {detail && detail !== "loading" && detail !== "error" && <CommitDetailView detail={detail} />}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

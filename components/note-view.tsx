"use client";

import useSWR from "swr";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Columns2, Eye, Pencil } from "lucide-react";
import { fetcher, folderColor, type Note, type NoteMeta } from "@/lib/client";
import { cn } from "@/lib/utils";
import { recordView } from "@/lib/recents";
import { Markdown } from "./markdown";

type Mode = "preview" | "edit" | "split";
type SaveState = "idle" | "dirty" | "saving" | "saved";

function encodePath(path: string) {
  return path.split("/").map(encodeURIComponent).join("/");
}

/** Strip the YAML frontmatter block for the live preview. */
function stripFrontmatter(content: string): string {
  const m = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/.exec(content);
  return m ? content.slice(m[0].length) : content;
}

/** Drop a leading `# Title` from the body when it duplicates the note title. */
function stripDuplicateH1(body: string, title: string): string {
  const lines = body.split("\n");
  let i = 0;
  while (i < lines.length && lines[i].trim() === "") i++;
  if (i < lines.length && /^#\s+/.test(lines[i]) && lines[i].replace(/^#\s+/, "").trim() === title.trim()) {
    return lines.slice(i + 1).join("\n");
  }
  return body;
}

function Editor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      spellCheck={false}
      className="scrollbar-none h-full w-full resize-none bg-background px-6 py-6 font-mono text-[13px] leading-relaxed text-foreground outline-none"
    />
  );
}

function ModeButton({ active, onClick, title, children }: { active: boolean; onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        "inline-flex size-7 items-center justify-center rounded-md transition-colors",
        active ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

export function NoteView({ path }: { path: string }) {
  const key = `/api/notes/${encodePath(path)}`;
  const { data, error, isLoading, mutate } = useSWR<{ note: Note; backlinks: NoteMeta[] }>(key, fetcher);
  const { data: all } = useSWR<{ notes: NoteMeta[] }>("/api/notes", fetcher);

  const resolve = useMemo(() => {
    const map = new Map<string, string>();
    for (const n of all?.notes ?? []) if (!map.has(n.slug)) map.set(n.slug, n.path);
    return (stem: string) => map.get(stem);
  }, [all]);

  const [mode, setMode] = useState<Mode>("preview");
  const [draft, setDraft] = useState<string | null>(null);
  const [save, setSave] = useState<SaveState>("idle");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset editor state when navigating to a different note.
  useEffect(() => {
    setDraft(null);
    setMode("preview");
    setSave("idle");
  }, [path]);

  const note = data?.note;

  // Track this note in the browser's "recently viewed" list (localStorage only).
  useEffect(() => {
    if (note?.title) recordView(path, note.title, path.includes("/") ? path.split("/")[0] : "root");
  }, [path, note?.title]);

  async function persist(content: string) {
    setSave("saving");
    try {
      const res = await fetch(key, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) throw new Error();
      setSave("saved");
      mutate();
      setTimeout(() => setSave((s) => (s === "saved" ? "idle" : s)), 1500);
    } catch {
      setSave("dirty");
    }
  }

  function onEdit(v: string) {
    setDraft(v);
    setSave("dirty");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => persist(v), 800);
  }

  if (error) return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Note not found.</div>;
  if (isLoading || !note) return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;

  const raw = draft ?? note.raw;
  const previewBody = draft != null ? stripFrontmatter(draft) : stripDuplicateH1(note.body, note.title);

  const saveLabel =
    save === "saving" ? "Saving…" : save === "saved" ? "Saved" : save === "dirty" ? "Unsaved" : "";

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex h-11 shrink-0 items-center gap-3 border-b border-border px-4">
        <span className="size-1.5 shrink-0 rounded-full" style={{ background: folderColor(note.folder) }} />
        <span className="truncate font-mono text-xs text-muted-foreground">{note.path}</span>
        <div className="ml-auto flex items-center gap-3">
          {saveLabel && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              {save === "saved" && <Check size={12} />}
              {saveLabel}
            </span>
          )}
          <div className="flex items-center gap-0.5 rounded-lg border border-border p-0.5">
            <ModeButton active={mode === "preview"} onClick={() => setMode("preview")} title="Preview">
              <Eye size={15} />
            </ModeButton>
            <ModeButton active={mode === "edit"} onClick={() => setMode("edit")} title="Edit">
              <Pencil size={15} />
            </ModeButton>
            <ModeButton active={mode === "split"} onClick={() => setMode("split")} title="Split">
              <Columns2 size={15} />
            </ModeButton>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="min-h-0 flex-1">
        {mode === "edit" && <Editor value={raw} onChange={onEdit} />}

        {mode === "split" && (
          <div className="grid h-full grid-cols-2 divide-x divide-border">
            <Editor value={raw} onChange={onEdit} />
            <div className="scrollbar-none overflow-y-auto px-6 py-6">
              <Markdown content={previewBody} resolve={resolve} />
            </div>
          </div>
        )}

        {mode === "preview" && (
          <div className="scrollbar-none h-full overflow-y-auto">
            <article className="mx-auto max-w-5xl px-8 py-10">
              <header className="mb-7">
                <h1 className="text-2xl font-semibold tracking-tight">{note.title}</h1>
                {(note.tags.length > 0 || note.status || note.type) && (
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    {note.type && (
                      <span className="rounded-md border border-border px-2 py-0.5 text-xs text-muted-foreground">{note.type}</span>
                    )}
                    {note.status && (
                      <span className="rounded-md border border-border px-2 py-0.5 text-xs text-muted-foreground">{note.status}</span>
                    )}
                    {note.tags.map((t) => (
                      <span key={t} className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        #{t}
                      </span>
                    ))}
                  </div>
                )}
              </header>

              <Markdown content={previewBody} resolve={resolve} />

              {data.backlinks.length > 0 && (
                <footer className="mt-12 border-t border-border pt-5">
                  <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Linked from ({data.backlinks.length})
                  </h2>
                  <ul className="space-y-1">
                    {data.backlinks.map((b) => (
                      <li key={b.path}>
                        <Link href={`/n/${b.path}`} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                          {b.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </footer>
              )}
            </article>
          </div>
        )}
      </div>
    </div>
  );
}

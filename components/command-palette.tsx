"use client";

import { Command } from "cmdk";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { folderColor } from "@/lib/client";

interface Hit {
  path: string;
  title: string;
  folder: string;
  type?: string;
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Hit[]>([]);
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", onKey);
    (window as unknown as { __openPalette?: () => void }).__openPalette = () => setOpen(true);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(async () => {
      if (!q.trim()) {
        setResults([]);
        return;
      }
      try {
        const r = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        const d = await r.json();
        setResults(d.results ?? []);
      } catch {
        /* ignore */
      }
    }, 120);
    return () => clearTimeout(t);
  }, [q, open]);

  return (
    <Command.Dialog open={open} onOpenChange={setOpen} shouldFilter={false} label="Search the vault">
      <Command.Input value={q} onValueChange={setQ} placeholder="Search the vault…" autoFocus />
      <Command.List>
        {q.trim() && results.length === 0 && <Command.Empty>No results.</Command.Empty>}
        {results.map((r) => (
          <Command.Item
            key={r.path}
            value={r.path}
            onSelect={() => {
              setOpen(false);
              setQ("");
              router.push(`/n/${r.path}`);
            }}
          >
            <span className="size-1.5 shrink-0 rounded-full" style={{ background: folderColor(r.folder) }} />
            <span className="truncate">{r.title}</span>
            <span className="ml-auto max-w-[45%] shrink-0 truncate text-xs text-muted-foreground">{r.path}</span>
          </Command.Item>
        ))}
      </Command.List>
    </Command.Dialog>
  );
}

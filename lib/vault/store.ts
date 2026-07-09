import fs from "node:fs";
import path from "node:path";
import MiniSearch from "minisearch";
import { watch, type FSWatcher } from "chokidar";
import { VAULT_IGNORE } from "@/lib/config";
import { activeVaultDir } from "@/lib/repos";
import { scanVault } from "./scan";
import { parseNote, stemOf } from "./parse";
import type { Graph, GraphEdge, GraphNode, Note, NoteMeta, TreeNode } from "./types";

interface IndexState {
  dir: string;
  notes: Map<string, NoteMeta>;
  stemToPath: Map<string, string>;
  outEdges: Map<string, Set<string>>;
  inEdges: Map<string, Set<string>>;
  search: MiniSearch;
  builtAt: number;
}

let state: IndexState | null = null;
let watcher: FSWatcher | null = null;
let watchedDir = "";

function buildState(): IndexState {
  const dir = activeVaultDir();
  const files = scanVault(dir);
  const notes = new Map<string, NoteMeta>();
  const stemToPath = new Map<string, string>();
  const linksBySource = new Map<string, string[]>();
  const docs: Array<{ id: string; title: string; tags: string; body: string; folder: string; type: string }> = [];

  for (const f of files) {
    let raw = "";
    try {
      raw = fs.readFileSync(f.abs, "utf8");
    } catch {
      continue;
    }
    const { meta, body, rawLinks } = parseNote(f.rel, raw);
    const nm: NoteMeta = { ...meta, mtimeMs: f.mtimeMs };
    notes.set(f.rel, nm);
    if (!stemToPath.has(nm.slug)) {
      stemToPath.set(nm.slug, f.rel);
    } else if (process.env.NODE_ENV !== "production") {
      console.warn(`[vault] duplicate stem "${nm.slug}" (${stemToPath.get(nm.slug)} vs ${f.rel}) — links resolve to the first.`);
    }
    linksBySource.set(f.rel, rawLinks.map((l) => stemOf(l.target)));
    docs.push({ id: f.rel, title: nm.title, tags: nm.tags.join(" "), body, folder: nm.folder, type: nm.type ?? "" });
  }

  const outEdges = new Map<string, Set<string>>();
  const inEdges = new Map<string, Set<string>>();
  for (const [src, stems] of linksBySource) {
    for (const stem of stems) {
      const tgt = stemToPath.get(stem);
      if (!tgt || tgt === src) continue;
      (outEdges.get(src) ?? outEdges.set(src, new Set()).get(src)!).add(tgt);
      (inEdges.get(tgt) ?? inEdges.set(tgt, new Set()).get(tgt)!).add(src);
    }
  }

  const search = new MiniSearch({
    fields: ["title", "tags", "body", "folder", "type"],
    storeFields: ["title", "folder", "type"],
    searchOptions: { boost: { title: 3, tags: 2 }, prefix: true, fuzzy: 0.2, combineWith: "AND" },
  });
  search.addAll(docs);

  return { dir, notes, stemToPath, outEdges, inEdges, search, builtAt: Date.now() };
}

function startWatcher(dir: string) {
  if (watcher && watchedDir === dir) return;
  if (watcher) {
    watcher.close().catch(() => {});
    watcher = null;
  }
  watchedDir = dir;
  try {
    watcher = watch(dir, {
      ignoreInitial: true,
      persistent: true,
      depth: 12,
      ignored: (p) => {
        const base = path.basename(p);
        if (base.startsWith(".")) return true;
        return [...VAULT_IGNORE].some((ig) => base === ig || p.includes(`${path.sep}${ig}${path.sep}`));
      },
    });
    let t: ReturnType<typeof setTimeout> | null = null;
    const trigger = () => {
      if (t) clearTimeout(t);
      t = setTimeout(() => {
        try {
          state = buildState();
        } catch (e) {
          console.error("[vault] rebuild failed", e);
        }
      }, 250);
    };
    watcher.on("add", trigger).on("change", trigger).on("unlink", trigger).on("addDir", trigger).on("unlinkDir", trigger);
  } catch (e) {
    console.error("[vault] watcher failed to start", e);
  }
}

function ensure(): IndexState {
  const dir = activeVaultDir();
  if (!state || state.dir !== dir) state = buildState();
  startWatcher(dir);
  return state;
}

/** Force a synchronous rebuild (after a write or a workspace switch). */
export function rebuildIndex(): void {
  state = buildState();
  startWatcher(state.dir);
}

export function listNotes(): NoteMeta[] {
  return [...ensure().notes.values()];
}

export function getNote(relPath: string): Note | null {
  const s = ensure();
  const abs = path.join(s.dir, relPath);
  let raw: string;
  try {
    raw = fs.readFileSync(abs, "utf8");
  } catch {
    return null;
  }
  const { meta, body } = parseNote(relPath, raw);
  return { ...meta, mtimeMs: s.notes.get(relPath)?.mtimeMs ?? 0, body, raw };
}

export interface SearchHit {
  path: string;
  title: string;
  folder: string;
  type?: string;
  score: number;
}

export function searchNotes(q: string, limit = 40): SearchHit[] {
  const s = ensure();
  if (!q.trim()) return [];
  return s.search.search(q).slice(0, limit).map((r) => ({
    path: r.id as string,
    title: (r as unknown as { title: string }).title,
    folder: (r as unknown as { folder: string }).folder,
    type: (r as unknown as { type?: string }).type || undefined,
    score: r.score,
  }));
}

export function getBacklinks(relPath: string): NoteMeta[] {
  const s = ensure();
  return [...(s.inEdges.get(relPath) ?? [])].map((p) => s.notes.get(p)).filter(Boolean) as NoteMeta[];
}

export function getOutlinks(relPath: string): NoteMeta[] {
  const s = ensure();
  return [...(s.outEdges.get(relPath) ?? [])].map((p) => s.notes.get(p)).filter(Boolean) as NoteMeta[];
}

export function getGraph(folder?: string): Graph {
  const s = ensure();
  const inScope = (p: string) => !folder || s.notes.get(p)?.folder === folder;
  const degree = new Map<string, number>();
  const bump = (p: string) => degree.set(p, (degree.get(p) ?? 0) + 1);

  const edges: GraphEdge[] = [];
  for (const [src, set] of s.outEdges) {
    for (const tgt of set) {
      if (!inScope(src) || !inScope(tgt)) continue;
      edges.push({ source: src, target: tgt });
      bump(src);
      bump(tgt);
    }
  }
  const nodes: GraphNode[] = [...s.notes.values()]
    .filter((n) => inScope(n.path))
    .map((n) => ({ id: n.path, label: n.title, folder: n.folder, type: n.type, degree: degree.get(n.path) ?? 0 }));

  return { nodes, edges };
}

export function getTree(): TreeNode {
  const s = ensure();
  const root: TreeNode = { name: "", path: "", type: "dir", children: [] };
  const dirs = new Map<string, TreeNode>([["", root]]);

  function ensureDir(dirPath: string): TreeNode {
    const existing = dirs.get(dirPath);
    if (existing) return existing;
    const parentPath = dirPath.split("/").slice(0, -1).join("/");
    const parent = ensureDir(parentPath);
    const node: TreeNode = { name: dirPath.split("/").pop()!, path: dirPath, type: "dir", children: [] };
    parent.children!.push(node);
    dirs.set(dirPath, node);
    return node;
  }

  for (const n of [...s.notes.values()].sort((a, b) => a.path.localeCompare(b.path))) {
    const dirPath = n.path.split("/").slice(0, -1).join("/");
    ensureDir(dirPath).children!.push({ name: n.slug, path: n.path, type: "file", title: n.title });
  }

  (function sortRec(node: TreeNode) {
    node.children?.sort((a, b) => (a.type !== b.type ? (a.type === "dir" ? -1 : 1) : a.name.localeCompare(b.name)));
    node.children?.forEach(sortRec);
  })(root);

  return root;
}

/** Read a top-level meta file (SCHEMA.md / INDEX.md) from the active vault, or null. */
export function readVaultFile(name: string): string | null {
  try {
    return fs.readFileSync(path.join(activeVaultDir(), name), "utf8");
  } catch {
    return null;
  }
}

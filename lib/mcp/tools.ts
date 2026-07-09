import {
  getBacklinks,
  getGraph,
  getNote,
  getTree,
  listNotes,
  readVaultFile,
  searchNotes,
} from "@/lib/vault/store";
import {
  appendNote,
  createFolder,
  deleteNote,
  moveNote,
  writeNote,
  writeNoteRaw,
} from "@/lib/vault/write";
import { captureNote } from "@/lib/harness";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Args = Record<string, any>;

export interface Tool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (args: Args) => Promise<unknown> | unknown;
}

const s = (description: string) => ({ type: "string", description });

/**
 * Resolve a note write from whichever convention the caller used, so brain_write and
 * brain_edit are interchangeable and forgiving:
 *   - `content`: full raw markdown (frontmatter included) → written as-is.
 *   - `body` that already starts with `---` (embedded frontmatter, no fm object) → raw.
 *   - `body` (+ optional `frontmatter` object) → structured write.
 * Throws on an empty write instead of silently creating an empty note.
 */
async function writeFromArgs(a: Args): Promise<string> {
  const p = String(a.path);
  const fm = a.frontmatter && typeof a.frontmatter === "object" ? a.frontmatter : undefined;
  const hasFm = !!fm && Object.keys(fm).length > 0;
  const bodyStr = typeof a.body === "string" ? a.body : "";
  const contentStr = typeof a.content === "string" ? a.content : "";
  const raw = contentStr.trim() !== "" ? contentStr : !hasFm && bodyStr.trim().startsWith("---") ? bodyStr : "";
  if (raw.trim() !== "") return writeNoteRaw(p, raw);
  if (bodyStr.trim() !== "" || hasFm) return writeNote(p, bodyStr, fm);
  throw new Error(
    "Nothing to write. Pass `body` (markdown, + optional `frontmatter` object) or `content` (full raw markdown incl. frontmatter). Refusing to create an empty note.",
  );
}

export const TOOLS: Tool[] = [
  {
    name: "brain_schema",
    description:
      "Return the vault's SCHEMA.md — folder taxonomy, frontmatter conventions, wikilink model, and the write protocol. READ THIS FIRST before writing notes.",
    inputSchema: { type: "object", properties: {} },
    handler: () => readVaultFile("SCHEMA.md") ?? "(no SCHEMA.md in this vault)",
  },
  {
    name: "brain_search",
    description: "Full-text + fuzzy search across all notes. Returns ranked results (path, title, folder).",
    inputSchema: {
      type: "object",
      properties: { query: s("search query"), limit: { type: "number", description: "max results (default 20)" } },
      required: ["query"],
    },
    handler: ({ query, limit }) => searchNotes(String(query ?? ""), typeof limit === "number" ? limit : 20),
  },
  {
    name: "brain_read",
    description: "Read a note's full markdown (frontmatter + body) plus its backlinks. Path is vault-relative, e.g. 'clients/mks/mks.md'.",
    inputSchema: { type: "object", properties: { path: s("vault-relative path") }, required: ["path"] },
    handler: ({ path }) => {
      const n = getNote(String(path));
      if (!n) return { error: "not found", path };
      return {
        path: n.path,
        title: n.title,
        frontmatter: n.frontmatter,
        content: n.raw,
        backlinks: getBacklinks(n.path).map((b) => b.path),
      };
    },
  },
  {
    name: "brain_list",
    description: "List all notes with metadata (path, title, folder, type, tags, status). Use to discover what exists.",
    inputSchema: { type: "object", properties: {} },
    handler: () =>
      listNotes().map((n) => ({ path: n.path, title: n.title, folder: n.folder, type: n.type, tags: n.tags, status: n.status })),
  },
  {
    name: "brain_tree",
    description: "Return the folder/file tree of the vault.",
    inputSchema: { type: "object", properties: {} },
    handler: () => getTree(),
  },
  {
    name: "brain_backlinks",
    description: "Notes that link to the given note.",
    inputSchema: { type: "object", properties: { path: s("vault-relative path") }, required: ["path"] },
    handler: ({ path }) => ({ backlinks: getBacklinks(String(path)).map((n) => n.path) }),
  },
  {
    name: "brain_graph",
    description: "The knowledge graph (nodes + edges from wikilinks and related:). Optional folder filter.",
    inputSchema: { type: "object", properties: { folder: s("optional folder filter") } },
    handler: ({ folder }) => getGraph(folder ? String(folder) : undefined),
  },
  {
    name: "brain_write",
    description:
      "Create or overwrite a note. Pass EITHER `body` (markdown) + optional `frontmatter` (object), OR `content` (full raw markdown incl. frontmatter, same as brain_edit) — either works. Follow SCHEMA.md: kebab-case path, dated names for daily/decisions, frontmatter with title/type/tags/status. Path vault-relative (e.g. decisions/foo-2026-07-09.md).",
    inputSchema: {
      type: "object",
      properties: {
        path: s("vault-relative path, e.g. decisions/foo-2026-07-09.md"),
        body: s("markdown body (pair with `frontmatter`)"),
        frontmatter: { type: "object", description: "YAML frontmatter object: title, type, tags, status, related, ..." },
        content: s("full raw markdown incl. frontmatter — alternative to body+frontmatter"),
      },
      required: ["path"],
    },
    handler: async (a) => ({ ok: true, path: await writeFromArgs(a) }),
  },
  {
    name: "brain_edit",
    description:
      "Overwrite a note. Pass `content` (full raw markdown incl. frontmatter) — read first with brain_read, then write the whole file back. Also accepts `body` (+ optional `frontmatter`) like brain_write.",
    inputSchema: {
      type: "object",
      properties: {
        path: s("vault-relative path"),
        content: s("full raw markdown incl. frontmatter"),
        body: s("markdown body (alternative to content; pair with `frontmatter`)"),
        frontmatter: { type: "object", description: "YAML frontmatter object (with `body`)" },
      },
      required: ["path"],
    },
    handler: async (a) => ({ ok: true, path: await writeFromArgs(a) }),
  },
  {
    name: "brain_append",
    description: "Append text to a note (creates it if missing).",
    inputSchema: {
      type: "object",
      properties: { path: s("vault-relative path"), text: s("text to append") },
      required: ["path", "text"],
    },
    handler: async ({ path, text }) => ({ ok: true, path: await appendNote(String(path), String(text ?? "")) }),
  },
  {
    name: "brain_move",
    description: "Move or rename a note.",
    inputSchema: { type: "object", properties: { from: s("current path"), to: s("new path") }, required: ["from", "to"] },
    handler: async ({ from, to }) => ({ ok: true, path: await moveNote(String(from), String(to)) }),
  },
  {
    name: "brain_create_folder",
    description: "Create a new folder in the vault (with a .gitkeep).",
    inputSchema: { type: "object", properties: { path: s("folder path") }, required: ["path"] },
    handler: async ({ path }) => ({ ok: true, path: await createFolder(String(path)) }),
  },
  {
    name: "brain_capture",
    description:
      "Capture a ROUGH note / brain-dump and let the vault file it automatically: it reads SCHEMA.md + the current folders, picks the right folder + filename, writes clean frontmatter, and structures the body. Use when you have unstructured input and don't want to decide the path yourself.",
    inputSchema: { type: "object", properties: { text: s("the rough note / brain dump to file") }, required: ["text"] },
    handler: async ({ text }) => await captureNote(String(text ?? "")),
  },
  {
    name: "brain_delete",
    description: "Delete a note from the working copy (recoverable via git history).",
    inputSchema: { type: "object", properties: { path: s("vault-relative path") }, required: ["path"] },
    handler: async ({ path }) => {
      await deleteNote(String(path));
      return { ok: true };
    },
  },
];

export const TOOL_MAP = new Map(TOOLS.map((t) => [t.name, t]));

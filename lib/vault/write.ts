import fsp from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import { activeVaultDir } from "@/lib/repos";
import { refreshPaths } from "./store";
import { checkFrontmatter, frontmatterErrorMessage } from "./validate";
import { requestSync } from "@/lib/git";
import { currentActor } from "@/lib/actor";

/** Resolve a vault-relative path to an absolute path in the active vault, refusing escapes. */
function safeAbs(relPath: string): string {
  const root = path.resolve(activeVaultDir());
  const abs = path.resolve(root, relPath);
  if (abs !== root && !abs.startsWith(root + path.sep)) throw new Error("path escapes the vault");
  return abs;
}

export function normalizeNotePath(relPath: string): string {
  const p = relPath.replace(/\\/g, "/").replace(/^\/+/, "").replace(/\.\.(\/|$)/g, "");
  return /\.md$/i.test(p) ? p : `${p}.md`;
}

/**
 * Re-index only what changed, then queue a git commit stamped with who caused it.
 * The actor prefix is what turns the Activity feed into an audit trail rather than a
 * list of anonymous edits. `touched` are vault-relative paths.
 */
function after(message: string, touched: string[]) {
  refreshPaths(touched);
  requestSync(`${currentActor()}: ${message}`);
}

export interface WriteOpts {
  /**
   * Reject the write when the frontmatter cannot be parsed back.
   * True for agents (MCP) — a machine has no excuse for emitting broken YAML, and a corrupt
   * note silently loses its authority. False for the dashboard editor, where a human may save
   * a half-typed document; they get a warning instead of losing their work.
   */
  strict?: boolean;
}

/** Write a note from a raw markdown string (frontmatter included). Used by the editor. */
export async function writeNoteRaw(relPath: string, content: string, opts: WriteOpts = {}): Promise<string> {
  const p = normalizeNotePath(relPath);
  if (opts.strict) {
    const check = checkFrontmatter(content);
    if (!check.ok) throw new Error(frontmatterErrorMessage(p, check.error!));
  }
  const abs = safeAbs(p);
  await fsp.mkdir(path.dirname(abs), { recursive: true });
  await fsp.writeFile(abs, content, "utf8");
  after(`edit ${p}`, [p]);
  return p;
}

/**
 * Write a note from a body + optional frontmatter object. Used by agents (MCP) and the harness.
 * `matter.stringify` serialises the object, so the YAML always parses — this path cannot
 * produce the corruption that hand-written frontmatter can.
 */
export async function writeNote(relPath: string, body: string, frontmatter?: Record<string, unknown>): Promise<string> {
  const content =
    frontmatter && Object.keys(frontmatter).length > 0 ? matter.stringify(body ?? "", frontmatter) : (body ?? "");
  return writeNoteRaw(relPath, content, { strict: true });
}

export async function appendNote(relPath: string, text: string): Promise<string> {
  const p = normalizeNotePath(relPath);
  const abs = safeAbs(p);
  let existing = "";
  try {
    existing = await fsp.readFile(abs, "utf8");
  } catch {
    /* new file */
  }
  await fsp.mkdir(path.dirname(abs), { recursive: true });
  const sep = existing && !existing.endsWith("\n") ? "\n" : "";
  await fsp.writeFile(abs, `${existing}${sep}${text}\n`, "utf8");
  after(`append ${p}`, [p]);
  return p;
}

export async function moveNote(from: string, to: string): Promise<string> {
  const a = safeAbs(normalizeNotePath(from));
  const b = safeAbs(normalizeNotePath(to));
  await fsp.mkdir(path.dirname(b), { recursive: true });
  await fsp.rename(a, b);
  after(`move ${from} -> ${to}`, [normalizeNotePath(from), normalizeNotePath(to)]);
  return normalizeNotePath(to);
}

export async function deleteNote(relPath: string): Promise<void> {
  await fsp.rm(safeAbs(normalizeNotePath(relPath)));
  after(`delete ${relPath}`, [normalizeNotePath(relPath)]);
}

export async function createFolder(relPath: string): Promise<string> {
  const p = relPath.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "").replace(/\.\.(\/|$)/g, "");
  const abs = safeAbs(p);
  await fsp.mkdir(abs, { recursive: true });
  await fsp.writeFile(path.join(abs, ".gitkeep"), "", "utf8");
  requestSync(`${currentActor()}: mkdir ${p}`);
  return p;
}

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
  /**
   * Permit a write that destroys most of an existing note. Default false for agents.
   * A human in the editor is looking at what they're deleting; an agent usually is not.
   */
  allowShrink?: boolean;
}

/** An existing note this size or larger is worth protecting from an accidental truncation. */
const SHRINK_FLOOR_BYTES = 400;
/** Replacing a note with less than this fraction of its content looks like an accident. */
const SHRINK_RATIO = 0.3;

/**
 * Refuse to replace a substantial note with a stub.
 *
 * A real incident: an agent was told "replace {{BOOKING_LINK}} in this file", and wrote that
 * *instruction* into the file as its entire contents — destroying a 5.6KB snippet library.
 * `writeNote` overwrites blind, so nothing stopped it. Overwriting is legitimate (an agent
 * reads a note and writes it back), but collapsing 5.6KB to 170 bytes is a mistake worth
 * refusing until someone says they meant it.
 */
async function guardTruncation(abs: string, relPath: string, next: string, allowShrink: boolean): Promise<void> {
  if (allowShrink) return;
  let existing: string;
  try {
    existing = await fsp.readFile(abs, "utf8");
  } catch {
    return; // new note — nothing to destroy
  }
  if (existing.length < SHRINK_FLOOR_BYTES) return;
  if (next.length >= existing.length * SHRINK_RATIO) return;
  throw new Error(
    `Refusing to write ${relPath}: it would shrink from ${existing.length} to ${next.length} bytes, ` +
      `discarding most of the note. Read it first (brain_read) and write back the full content you intend to keep. ` +
      `To append, use brain_append. If you really mean to replace it, pass overwrite: true.`,
  );
}

/** Write a note from a raw markdown string (frontmatter included). Used by the editor. */
export async function writeNoteRaw(relPath: string, content: string, opts: WriteOpts = {}): Promise<string> {
  const p = normalizeNotePath(relPath);
  if (opts.strict) {
    const check = checkFrontmatter(content);
    if (!check.ok) throw new Error(frontmatterErrorMessage(p, check.error!));
  }
  const abs = safeAbs(p);
  await guardTruncation(abs, p, content, opts.allowShrink === true);
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
export async function writeNote(
  relPath: string,
  body: string,
  frontmatter?: Record<string, unknown>,
  opts: WriteOpts = {},
): Promise<string> {
  const content =
    frontmatter && Object.keys(frontmatter).length > 0 ? matter.stringify(body ?? "", frontmatter) : (body ?? "");
  return writeNoteRaw(relPath, content, { ...opts, strict: true });
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

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DATA_ROOT } from "@/lib/config";

// App state (token hashes) lives in the fixed data dir, separate from any vault content.
const STATE_DIR = process.env.ENGRAM_STATE_DIR || DATA_ROOT;
const TOKENS_FILE = path.join(STATE_DIR, "tokens.json");

/**
 * What a token is allowed to do.
 *
 * `read`  — search, read, list, tree, backlinks, graph, recent, schema.
 * `write` — everything, including move and delete.
 *
 * This, not the Curator, is the lever that decides whether an agent can mutate the vault.
 * A read-only token is the guarantee that a connected agent cannot change your notes.
 */
export type TokenScope = "read" | "write";

interface StoredToken {
  id: string;
  name: string;
  hash: string;
  created: string;
  /** Absent on tokens created before scopes existed — those are grandfathered as `write`. */
  scope?: TokenScope;
}

export interface TokenMeta {
  id: string;
  name: string;
  created: string;
  scope: TokenScope;
}

const hash = (t: string) => crypto.createHash("sha256").update(t).digest("hex");

function ensureStateDir() {
  fs.mkdirSync(STATE_DIR, { recursive: true });
}

function load(): StoredToken[] {
  try {
    return JSON.parse(fs.readFileSync(TOKENS_FILE, "utf8"));
  } catch {
    return [];
  }
}

function save(tokens: StoredToken[]) {
  ensureStateDir();
  fs.writeFileSync(TOKENS_FILE, JSON.stringify(tokens, null, 2));
}

/** Tokens minted before scopes existed keep the behaviour they had: full access. */
const scopeOf = (t: StoredToken): TokenScope => t.scope ?? "write";

export function listTokens(): TokenMeta[] {
  return load().map((t) => ({ id: t.id, name: t.name, created: t.created, scope: scopeOf(t) }));
}

/** Create a token. Returns the plaintext value ONCE — only the hash is stored. */
export function createToken(name: string, scope: TokenScope = "write"): { id: string; name: string; scope: TokenScope; token: string } {
  const token = crypto.randomBytes(32).toString("hex");
  const rec: StoredToken = {
    id: crypto.randomUUID(),
    name: name?.trim() || "token",
    hash: hash(token),
    created: new Date().toISOString(),
    scope: scope === "read" ? "read" : "write",
  };
  const all = load();
  all.push(rec);
  save(all);
  return { id: rec.id, name: rec.name, scope: rec.scope!, token };
}

export function revokeToken(id: string): void {
  save(load().filter((t) => t.id !== id));
}

/** Resolve a bearer token to its identity + scope, or null when unknown. */
export function resolveToken(bearer: string): TokenMeta | null {
  if (!bearer) return null;
  const h = hash(bearer);
  const t = load().find((x) => x.hash === h);
  return t ? { id: t.id, name: t.name, created: t.created, scope: scopeOf(t) } : null;
}

export function hasAnyToken(): boolean {
  return load().length > 0;
}

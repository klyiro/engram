import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DATA_ROOT } from "@/lib/config";

// App state (token hashes) lives in the fixed data dir, separate from any vault content.
const STATE_DIR = process.env.CORTEX_STATE_DIR || DATA_ROOT;
const TOKENS_FILE = path.join(STATE_DIR, "tokens.json");

interface StoredToken {
  id: string;
  name: string;
  hash: string;
  created: string;
}

export interface TokenMeta {
  id: string;
  name: string;
  created: string;
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

export function listTokens(): TokenMeta[] {
  return load().map(({ id, name, created }) => ({ id, name, created }));
}

/** Create a token. Returns the plaintext value ONCE — only the hash is stored. */
export function createToken(name: string): { id: string; name: string; token: string } {
  const token = crypto.randomBytes(32).toString("hex");
  const rec: StoredToken = {
    id: crypto.randomUUID(),
    name: name?.trim() || "token",
    hash: hash(token),
    created: new Date().toISOString(),
  };
  const all = load();
  all.push(rec);
  save(all);
  return { id: rec.id, name: rec.name, token };
}

export function revokeToken(id: string): void {
  save(load().filter((t) => t.id !== id));
}

export function verifyToken(bearer: string): boolean {
  if (!bearer) return false;
  const h = hash(bearer);
  return load().some((t) => t.hash === h);
}

export function hasAnyToken(): boolean {
  return load().length > 0;
}

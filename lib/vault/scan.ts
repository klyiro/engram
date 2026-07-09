import fs from "node:fs";
import path from "node:path";
import { VAULT_IGNORE } from "@/lib/config";
import { activeVaultDir } from "@/lib/repos";

export interface ScannedFile {
  rel: string;
  abs: string;
  mtimeMs: number;
}

/** Recursively collect .md files under the vault, skipping ignored + dot dirs. */
export function scanVault(root = activeVaultDir()): ScannedFile[] {
  const out: ScannedFile[] = [];

  function walk(dir: string) {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.name.startsWith(".")) continue;
      if (VAULT_IGNORE.has(e.name)) continue;
      const abs = path.join(dir, e.name);
      if (e.isDirectory()) {
        walk(abs);
      } else if (e.isFile() && e.name.toLowerCase().endsWith(".md")) {
        const rel = path.relative(root, abs).split(path.sep).join("/");
        let mtimeMs = 0;
        try {
          mtimeMs = fs.statSync(abs).mtimeMs;
        } catch {
          /* ignore */
        }
        out.push({ rel, abs, mtimeMs });
      }
    }
  }

  walk(root);
  return out;
}

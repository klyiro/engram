import fs from "node:fs";
import path from "node:path";
import { simpleGit } from "simple-git";
import { activeVaultDir, getActive } from "@/lib/repos";
import { gitAuthor, gitSyncEnabled } from "@/lib/settings";
import { rebuildIndex } from "@/lib/vault/store";

let timer: ReturnType<typeof setTimeout> | null = null;
let pending: string[] = [];
let running = false;

/**
 * The vault dir ONLY when it's safe to run git there: it must be its OWN repo root (a `.git`
 * directly inside it). This covers connected workspaces (their clone is a repo root) and a
 * self-hosted VAULT_DIR that is a real repo, while excluding the bundled sample vault — which
 * has no `.git` of its own and would otherwise resolve to Engram's own repo. Returns null if
 * unsafe, so we never commit the app itself or surface its history.
 */
export function gitVaultDir(): string | null {
  const dir = activeVaultDir();
  return fs.existsSync(path.join(dir, ".git")) ? dir : null;
}

/**
 * Debounced commit + pull --rebase + push of the active vault. No-op unless git-sync is on
 * AND the vault is its own git repo (see gitVaultDir).
 */
export function requestSync(reason: string): void {
  if (!gitSyncEnabled() || !gitVaultDir()) return;
  pending.push(reason);
  if (timer) clearTimeout(timer);
  timer = setTimeout(runSync, 2500);
}

async function runSync(): Promise<void> {
  if (running) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(runSync, 2500);
    return;
  }
  running = true;
  const reasons = pending;
  pending = [];
  try {
    const dir = gitVaultDir(); // may have changed since the debounce fired
    if (!dir) return;
    const g = simpleGit(dir);
    await g.add(["-A"]);
    const status = await g.status();
    if (status.files.length === 0) {
      running = false;
      return;
    }
    const { name, email } = gitAuthor();
    await g
      .env({
        ...process.env,
        GIT_AUTHOR_NAME: name,
        GIT_AUTHOR_EMAIL: email,
        GIT_COMMITTER_NAME: name,
        GIT_COMMITTER_EMAIL: email,
      })
      .commit(`brain: ${reasons.length} change(s) — ${reasons.slice(0, 3).join("; ")}`);
    try {
      await g.pull(["--rebase", "--autostash"]);
    } catch (e) {
      console.error("[git] pull failed", e);
    }
    try {
      await g.push();
    } catch (e) {
      console.error("[git] push failed", e);
    }
  } catch (e) {
    console.error("[git] sync failed", e);
  } finally {
    running = false;
  }
}

export async function syncStatus() {
  const dir = gitVaultDir();
  if (!dir || !gitSyncEnabled()) return { enabled: false as const };
  try {
    const s = await simpleGit(dir).status();
    return { enabled: true as const, dirty: s.files.length, ahead: s.ahead, behind: s.behind, branch: s.current };
  } catch {
    return { enabled: true as const, error: true };
  }
}

/**
 * Pull remote commits into the ACTIVE vault clone (rebase, autostash). This is how changes
 * pushed to the repo from OUTSIDE Engram (an agent, a teammate, a direct git push) show up —
 * the chokidar watcher then rebuilds the index. Independent of the push side; a fresh
 * connected workspace should always reflect its remote. No-op for the sample/local vault.
 */
export async function pullActive(): Promise<{ ok: boolean; changed: boolean; error?: string }> {
  const active = getActive();
  if (!active) return { ok: true, changed: false };
  const dir = activeVaultDir();
  try {
    const g = simpleGit(dir);
    const before = await g.revparse(["HEAD"]).catch(() => "");
    await g.fetch();
    await g.pull(["--rebase", "--autostash"]);
    const after = await g.revparse(["HEAD"]).catch(() => "");
    const changed = before !== after;
    if (changed) rebuildIndex();
    return { ok: true, changed };
  } catch (e) {
    console.error("[git] pull failed", e);
    return { ok: false, changed: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export interface ActivityEntry {
  hash: string;
  message: string;
  author: string;
  date: string;
}

/**
 * Recent commits to the active vault — the "who did what to the brain" feed (agents + humans;
 * git-sync commits look like `brain: N change(s) — …`), most-recent first. Read-only. Empty
 * unless the vault is its own git repo (see gitVaultDir), so we never surface Engram's own
 * history via the sample vault.
 */
export async function vaultActivity(maxCount = 50): Promise<ActivityEntry[]> {
  const dir = gitVaultDir();
  if (!dir) return [];
  try {
    const log = await simpleGit(dir).log({ maxCount });
    return log.all.map((c) => ({
      hash: c.hash.slice(0, 7),
      message: c.message,
      author: c.author_name,
      date: c.date,
    }));
  } catch {
    return [];
  }
}

export interface CommitFile {
  /** Single-letter git status: A(dded) M(odified) D(eleted) R(enamed) C(opied) T(ypechange). */
  status: string;
  /** Vault-relative path of the file after the change (the new path for renames). */
  path: string;
  /** Previous path, for renames/copies. */
  oldPath?: string;
}

const MAX_DIFF = 60_000; // cap the patch we ship to the client

function parseNameStatus(raw: string): CommitFile[] {
  return raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split("\t");
      const status = parts[0][0];
      if ((status === "R" || status === "C") && parts.length >= 3) {
        return { status, oldPath: parts[1], path: parts[2] };
      }
      return { status, path: parts[parts.length - 1] };
    });
}

/**
 * What a single commit changed: the list of touched files (with status) plus the raw patch.
 * Guarded like the rest — only the active vault, only a valid hash. Null if unavailable.
 */
export async function commitChanges(hash: string): Promise<{ files: CommitFile[]; diff: string; truncated: boolean } | null> {
  const dir = gitVaultDir();
  if (!dir) return null;
  if (!/^[0-9a-f]{4,40}$/i.test(hash)) return null; // avoid passing arbitrary args to git
  try {
    const g = simpleGit(dir);
    const nameStatus = await g.raw(["show", "--no-color", "--format=", "--name-status", hash]);
    const files = parseNameStatus(nameStatus);
    const rawDiff = await g.raw(["show", "--no-color", "--format=", "--patch", hash]);
    const truncated = rawDiff.length > MAX_DIFF;
    return { files, diff: truncated ? rawDiff.slice(0, MAX_DIFF) : rawDiff, truncated };
  } catch {
    return null;
  }
}

let pullTimer: ReturnType<typeof setInterval> | null = null;
/** Poll the remote for the active vault so the brain stays fresh without a redeploy. */
export function startPullLoop(intervalMs = 30_000): void {
  if (pullTimer) return;
  pullTimer = setInterval(() => {
    pullActive().catch(() => {});
  }, intervalMs);
  pullTimer.unref?.();
}

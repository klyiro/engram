import { simpleGit } from "simple-git";
import { activeVaultDir, getActive } from "@/lib/repos";
import { gitAuthor, gitSyncEnabled } from "@/lib/settings";
import { rebuildIndex } from "@/lib/vault/store";

let timer: ReturnType<typeof setTimeout> | null = null;
let pending: string[] = [];
let running = false;

/** Debounced commit + pull --rebase + push of the ACTIVE vault. No-op unless GIT_SYNC_ENABLED. */
export function requestSync(reason: string): void {
  if (!gitSyncEnabled()) return;
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
    const g = simpleGit(activeVaultDir());
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
  if (!gitSyncEnabled()) return { enabled: false as const };
  try {
    const s = await simpleGit(activeVaultDir()).status();
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

let pullTimer: ReturnType<typeof setInterval> | null = null;
/** Poll the remote for the active vault so the brain stays fresh without a redeploy. */
export function startPullLoop(intervalMs = 30_000): void {
  if (pullTimer) return;
  pullTimer = setInterval(() => {
    pullActive().catch(() => {});
  }, intervalMs);
  pullTimer.unref?.();
}

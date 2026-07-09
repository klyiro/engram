import { simpleGit } from "simple-git";
import { activeVaultDir } from "@/lib/repos";
import { gitAuthor, gitSyncEnabled } from "@/lib/settings";

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

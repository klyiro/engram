// Runs once when the server starts. Re-clones the active workspace's vault if missing
// (e.g. a fresh volume), pulls the latest from its remote, then starts a periodic pull so
// externally-pushed changes keep flowing in without a redeploy.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { ensureActiveCloned } = await import("@/lib/repos");
  const { pullActive, startPullLoop } = await import("@/lib/git");
  await ensureActiveCloned();
  await pullActive().catch(() => {});
  startPullLoop();
}

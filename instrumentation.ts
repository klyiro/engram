// Runs once when the server starts. Re-clones the active workspace's vault into its
// dir if missing (e.g. a fresh volume). No-op when no workspace is configured.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { ensureActiveCloned } = await import("@/lib/repos");
  await ensureActiveCloned();
}

import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Who caused the write currently in flight.
 *
 * Agents already write to the vault autonomously, so an anonymous "edit foo.md" in the git
 * log is not an audit trail. Every write funnels through lib/vault/write.ts, which stamps
 * the current actor into the commit message — so the Activity page answers "who did this"
 * without threading an `actor` argument through every tool handler.
 *
 * Set it at the request boundary (the MCP route, the dashboard API), read it in write.ts.
 */
const storage = new AsyncLocalStorage<string>();

export function withActor<T>(actor: string, fn: () => T): T {
  return storage.run(actor, fn);
}

/** The actor for the in-flight request, or "unknown" outside any request (e.g. a git pull). */
export function currentActor(): string {
  return storage.getStore() ?? "unknown";
}

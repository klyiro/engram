import { removeRepo, renameRepo } from "@/lib/repos";
import { rebuildIndex } from "@/lib/vault/store";

export const dynamic = "force-dynamic";

/** Rename a workspace (display name). Body: { name }. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { name } = await req.json().catch(() => ({}));
  if (!name || !String(name).trim()) return Response.json({ error: "name required" }, { status: 400 });
  const repo = renameRepo(id, String(name));
  if (!repo) return Response.json({ error: "workspace not found" }, { status: 404 });
  return Response.json({ ok: true, repo });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  removeRepo(id);
  rebuildIndex();
  return Response.json({ ok: true });
}

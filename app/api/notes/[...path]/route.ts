import { getBacklinks, getNote, getOutlinks } from "@/lib/vault/store";
import { deleteNote, writeNoteRaw } from "@/lib/vault/write";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const rel = path.map(decodeURIComponent).join("/");
  const note = getNote(rel);
  if (!note) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json({ note, backlinks: getBacklinks(rel), outlinks: getOutlinks(rel) });
}

export async function PUT(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const rel = path.map(decodeURIComponent).join("/");
  const { content } = await req.json().catch(() => ({}));
  if (typeof content !== "string") return Response.json({ error: "content (string) required" }, { status: 400 });
  const saved = await writeNoteRaw(rel, content);
  return Response.json({ ok: true, path: saved });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const rel = path.map(decodeURIComponent).join("/");
  await deleteNote(rel);
  return Response.json({ ok: true });
}

import { SESSION_COOKIE } from "@/lib/config";
import { verifySessionToken } from "@/lib/auth";
import { withActor } from "@/lib/actor";
import { getBacklinks, getNote, getOutlinks } from "@/lib/vault/store";
import { checkFrontmatter } from "@/lib/vault/validate";
import { deleteNote, writeNoteRaw } from "@/lib/vault/write";

export const dynamic = "force-dynamic";

/** Attribute dashboard writes to the signed-in human, so the git log is not anonymous. */
async function actorFor(req: Request): Promise<string> {
  const cookie = req.headers.get("cookie") ?? "";
  const raw = cookie.split(";").map((c) => c.trim()).find((c) => c.startsWith(`${SESSION_COOKIE}=`));
  if (!raw) return "dashboard";
  const session = await verifySessionToken(raw.slice(SESSION_COOKIE.length + 1));
  return session?.email ? `dashboard (${session.email})` : "dashboard";
}

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
  // Non-strict: a human may autosave half-typed frontmatter. Save it, but tell them it is broken —
  // otherwise the note silently loses its status and tags. (Agents are refused; see lib/mcp/tools.ts.)
  // allowShrink: a human in the editor can see what they are deleting. Agents cannot.
  const actor = await actorFor(req);
  const saved = await withActor(actor, () => writeNoteRaw(rel, content, { allowShrink: true }));
  const check = checkFrontmatter(content);
  return Response.json({
    ok: true,
    path: saved,
    ...(check.ok
      ? {}
      : {
          warning: `Frontmatter is not valid YAML (${check.error}) — this note's status, tags and title are being ignored. Usual cause: an unquoted ":" in a value.`,
        }),
  });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const rel = path.map(decodeURIComponent).join("/");
  const actor = await actorFor(req);
  await withActor(actor, () => deleteNote(rel));
  return Response.json({ ok: true });
}

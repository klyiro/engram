import { listNotes } from "@/lib/vault/store";
import { writeNote } from "@/lib/vault/write";

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ notes: listNotes() });
}

export async function POST(req: Request) {
  const { path, body, frontmatter } = await req.json().catch(() => ({}));
  if (!path || typeof path !== "string") return Response.json({ error: "path required" }, { status: 400 });
  const saved = await writeNote(path, typeof body === "string" ? body : "", frontmatter);
  return Response.json({ ok: true, path: saved });
}

import { createFolder } from "@/lib/vault/write";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { path } = await req.json().catch(() => ({}));
  if (!path || typeof path !== "string") return Response.json({ error: "path required" }, { status: 400 });
  const created = await createFolder(path);
  return Response.json({ ok: true, path: created });
}

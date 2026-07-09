import { getBacklinks, getOutlinks } from "@/lib/vault/store";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const p = new URL(req.url).searchParams.get("path");
  if (!p) return Response.json({ error: "path required" }, { status: 400 });
  return Response.json({ backlinks: getBacklinks(p), outlinks: getOutlinks(p) });
}

import { commitChanges } from "@/lib/git";

export const dynamic = "force-dynamic";

/** What a single vault commit changed: touched files (with status) + the raw patch. */
export async function GET(_req: Request, { params }: { params: Promise<{ hash: string }> }) {
  const { hash } = await params;
  const detail = await commitChanges(hash);
  if (!detail) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json(detail);
}

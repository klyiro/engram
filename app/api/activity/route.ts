import { vaultActivity } from "@/lib/git";

export const dynamic = "force-dynamic";

/** Recent vault commits (agent + human activity). `?limit=` caps the count (default 50, max 200). */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 50, 1), 200);
  return Response.json({ activity: await vaultActivity(limit) });
}

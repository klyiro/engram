import { searchNotes } from "@/lib/vault/store";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q") ?? "";
  return Response.json({ results: searchNotes(q) });
}

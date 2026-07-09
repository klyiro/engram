import { getGraph } from "@/lib/vault/store";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const folder = new URL(req.url).searchParams.get("folder") || undefined;
  return Response.json(getGraph(folder));
}

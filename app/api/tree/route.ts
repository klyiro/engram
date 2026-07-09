import { getTree } from "@/lib/vault/store";

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ tree: getTree() });
}

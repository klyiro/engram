import { setActive } from "@/lib/repos";
import { rebuildIndex } from "@/lib/vault/store";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { id } = await req.json().catch(() => ({}));
  if (!id) return Response.json({ error: "id required" }, { status: 400 });
  setActive(id);
  rebuildIndex();
  return Response.json({ ok: true });
}

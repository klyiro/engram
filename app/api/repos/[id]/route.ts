import { removeRepo } from "@/lib/repos";
import { rebuildIndex } from "@/lib/vault/store";

export const dynamic = "force-dynamic";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  removeRepo(id);
  rebuildIndex();
  return Response.json({ ok: true });
}

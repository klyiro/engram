import { readVaultFile } from "@/lib/vault/store";

export const dynamic = "force-dynamic";

export function GET() {
  const content = readVaultFile("SCHEMA.md");
  if (content == null) return Response.json({ error: "no SCHEMA.md" }, { status: 404 });
  return new Response(content, { headers: { "content-type": "text/markdown; charset=utf-8" } });
}

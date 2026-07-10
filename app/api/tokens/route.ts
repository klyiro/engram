import { createToken, listTokens } from "@/lib/tokens";

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ tokens: listTokens() });
}

export async function POST(req: Request) {
  const { name, scope } = await req.json().catch(() => ({}));
  // Returns the plaintext token ONCE — only its hash is stored.
  // Scope decides whether the holder may mutate the vault; anything but "read" means full access.
  return Response.json(createToken(typeof name === "string" ? name : "token", scope === "read" ? "read" : "write"));
}

import { corsJson, CORS, oauthEnabled, registerClient } from "@/lib/oauth";

export const dynamic = "force-dynamic";

/** Dynamic Client Registration (RFC 7591). Public clients (PKCE, no secret). */
export async function POST(req: Request) {
  if (!oauthEnabled()) return corsJson({ error: "oauth_disabled" }, 404);
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return corsJson({ error: "invalid_client_metadata", error_description: "invalid JSON" }, 400);
  }
  const uris = Array.isArray(body.redirect_uris) ? body.redirect_uris.filter((u): u is string => typeof u === "string") : [];
  if (uris.length === 0) {
    return corsJson({ error: "invalid_redirect_uri", error_description: "redirect_uris is required" }, 400);
  }
  const c = registerClient(uris, typeof body.client_name === "string" ? body.client_name : undefined);
  return corsJson(
    {
      client_id: c.client_id,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      redirect_uris: c.redirect_uris,
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code"],
      response_types: ["code"],
      client_name: c.client_name,
    },
    201,
  );
}
export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

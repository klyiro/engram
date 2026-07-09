import { corsJson, CORS, issueAccessToken, oauthEnabled, redeemCode, verifyPkce } from "@/lib/oauth";

export const dynamic = "force-dynamic";

/** Read form-encoded (OAuth default) or JSON token-request bodies. */
async function parseBody(req: Request): Promise<Record<string, string>> {
  const ct = req.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    try {
      const j = await req.json();
      return Object.fromEntries(Object.entries(j).map(([k, v]) => [k, String(v)]));
    } catch {
      return {};
    }
  }
  const params = new URLSearchParams(await req.text());
  return Object.fromEntries(params.entries());
}

/** Token endpoint — exchange an authorization code (+ PKCE verifier) for an access token. */
export async function POST(req: Request) {
  if (!oauthEnabled()) return corsJson({ error: "invalid_request" }, 404);
  const b = await parseBody(req);
  if (b.grant_type !== "authorization_code") return corsJson({ error: "unsupported_grant_type" }, 400);
  if (!b.code || !b.code_verifier) return corsJson({ error: "invalid_request", error_description: "code and code_verifier required" }, 400);

  const payload = await redeemCode(b.code);
  if (!payload) return corsJson({ error: "invalid_grant", error_description: "code invalid, expired, or already used" }, 400);
  if (b.client_id && b.client_id !== payload.cid) return corsJson({ error: "invalid_grant", error_description: "client mismatch" }, 400);
  if (b.redirect_uri && b.redirect_uri !== payload.redirect_uri) return corsJson({ error: "invalid_grant", error_description: "redirect_uri mismatch" }, 400);
  if (!verifyPkce(b.code_verifier, payload.cc, payload.ccm)) return corsJson({ error: "invalid_grant", error_description: "PKCE verification failed" }, 400);

  const { token, expiresIn } = await issueAccessToken(payload.sub, payload.scope);
  return corsJson({ access_token: token, token_type: "Bearer", expires_in: expiresIn, scope: payload.scope }, 200);
}
export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

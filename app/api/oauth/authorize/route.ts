import { isAllowed, verifySessionToken } from "@/lib/auth";
import { SESSION_COOKIE } from "@/lib/config";
import { getClient, issueCode, oauthEnabled } from "@/lib/oauth";

export const dynamic = "force-dynamic";

function cookie(req: Request, name: string): string | undefined {
  for (const part of (req.headers.get("cookie") || "").split(";")) {
    const i = part.indexOf("=");
    if (i > -1 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return undefined;
}
const redirect = (location: string) => new Response(null, { status: 302, headers: { location } });

/**
 * Authorization endpoint. Validates the client + PKCE, gates on Engram's Google session
 * (redirecting through login when needed), then issues a single-use code back to the client.
 */
export async function GET(req: Request) {
  if (!oauthEnabled()) return new Response("OAuth is not enabled on this instance.", { status: 404 });
  const url = new URL(req.url);
  const p = url.searchParams;
  const clientId = p.get("client_id") || "";
  const redirectUri = p.get("redirect_uri") || "";
  const responseType = p.get("response_type") || "";
  const codeChallenge = p.get("code_challenge") || "";
  const codeChallengeMethod = p.get("code_challenge_method") || "";
  const state = p.get("state") || "";
  const scope = p.get("scope") || "mcp";

  // Can't safely bounce errors to an unregistered redirect_uri, so validate it first.
  const client = getClient(clientId);
  if (!client || !client.redirect_uris.includes(redirectUri)) {
    return new Response("Invalid client_id or redirect_uri.", { status: 400 });
  }
  const errorBack = (code: string, desc?: string) => {
    const u = new URL(redirectUri);
    u.searchParams.set("error", code);
    if (desc) u.searchParams.set("error_description", desc);
    if (state) u.searchParams.set("state", state);
    return redirect(u.toString());
  };
  if (responseType !== "code") return errorBack("unsupported_response_type");
  if (!codeChallenge || (codeChallengeMethod && codeChallengeMethod !== "S256")) {
    return errorBack("invalid_request", "PKCE with S256 is required");
  }

  // Gate on the Engram session (same Google login + allowlist as the dashboard).
  const sess = cookie(req, SESSION_COOKIE);
  const user = sess ? await verifySessionToken(sess) : null;
  if (!user || !isAllowed(user.email)) {
    const next = url.pathname + url.search; // resume here after login
    return redirect(`/api/auth/login?next=${encodeURIComponent(next)}`);
  }

  const code = await issueCode({
    cid: clientId,
    redirect_uri: redirectUri,
    cc: codeChallenge,
    ccm: codeChallengeMethod || "S256",
    sub: user.email,
    scope,
  });
  const back = new URL(redirectUri);
  back.searchParams.set("code", code);
  if (state) back.searchParams.set("state", state);
  return redirect(back.toString());
}

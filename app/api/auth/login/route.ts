import { googleAuthUrl } from "@/lib/auth";
import { APP_URL, GOOGLE_CLIENT_ID } from "@/lib/config";

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  if (!GOOGLE_CLIENT_ID) return Response.json({ error: "Google auth not configured" }, { status: 500 });
  const state = crypto.randomUUID();
  const secure = APP_URL.startsWith("https");
  const flag = secure ? "; Secure" : "";
  const headers = new Headers({ location: googleAuthUrl(state) });
  headers.append("set-cookie", `oauth_state=${state}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600${flag}`);
  // Where to land after login (e.g. resume an OAuth /authorize flow). Same-origin paths only.
  const next = new URL(req.url).searchParams.get("next");
  if (next && next.startsWith("/") && !next.startsWith("//")) {
    headers.append("set-cookie", `auth_next=${encodeURIComponent(next)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600${flag}`);
  }
  return new Response(null, { status: 302, headers });
}

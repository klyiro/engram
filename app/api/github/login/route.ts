import { APP_URL } from "@/lib/config";
import { githubAuthUrl, githubConfigured } from "@/lib/github";

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  if (!githubConfigured()) {
    return Response.json({ error: "GitHub OAuth not configured (set GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET)" }, { status: 500 });
  }
  const next = new URL(req.url).searchParams.get("next") || "/";
  const state = crypto.randomUUID();
  const flag = APP_URL.startsWith("https") ? "; Secure" : "";
  const headers = new Headers({ location: githubAuthUrl(state) });
  headers.append("set-cookie", `gh_state=${state}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600${flag}`);
  headers.append("set-cookie", `gh_next=${encodeURIComponent(next)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600${flag}`);
  return new Response(null, { status: 302, headers });
}

import { connectGithub, exchangeGithubCode } from "@/lib/github";

export const dynamic = "force-dynamic";

function parseCookies(header: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i > -1) out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return out;
}
const redirect = (p: string) => new Response(null, { status: 302, headers: { location: p } });

// GitHub is used ONLY to connect vault repos (an admin task). Dashboard login is Google.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookies = parseCookies(req.headers.get("cookie") || "");
  if (!code || !state || cookies.gh_state !== state) return redirect("/workspaces?error=state");

  const token = await exchangeGithubCode(code);
  if (!token) return redirect("/workspaces?error=github");
  await connectGithub(token);

  const next = cookies.gh_next ? decodeURIComponent(cookies.gh_next) : "/workspaces";
  return redirect(next.startsWith("/") ? next : "/workspaces");
}

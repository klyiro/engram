import { addRepo, getActive, listRepos } from "@/lib/repos";
import { githubToken } from "@/lib/github";
import { rebuildIndex } from "@/lib/vault/store";

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ repos: listRepos(), active: getActive() });
}

export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  const url = b.cloneUrl || b.url || (b.fullName ? `https://github.com/${b.fullName}.git` : "");
  if (!url) return Response.json({ error: "repo url or fullName required" }, { status: 400 });
  // "owner/repo" derived from the URL, for a nice default name.
  const derived = String(url)
    .replace(/^https?:\/\/[^/]+\//, "")
    .replace(/^git@[^:]+:/, "")
    .replace(/\.git$/, "");
  try {
    const repo = await addRepo({
      name: b.name || b.fullName || derived || url,
      fullName: b.fullName || (derived.includes("/") ? derived : undefined),
      url,
      // Explicit pasted token (PAT path) wins; else the OAuth-connected token.
      token: b.token || githubToken() || undefined,
      branch: b.branch,
      setActive: b.setActive,
    });
    rebuildIndex();
    return Response.json({ ok: true, repo });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}

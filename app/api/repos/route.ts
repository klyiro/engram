import { addRepo, getActive, listRepos } from "@/lib/repos";
import { githubToken } from "@/lib/github";
import { rebuildIndex } from "@/lib/vault/store";

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ repos: listRepos(), active: getActive() });
}

export async function POST(req: Request) {
  const { fullName, cloneUrl, branch, setActive } = await req.json().catch(() => ({}));
  const url = cloneUrl || (fullName ? `https://github.com/${fullName}.git` : "");
  if (!url) return Response.json({ error: "cloneUrl or fullName required" }, { status: 400 });
  try {
    const repo = await addRepo({
      name: fullName || url,
      fullName,
      url,
      token: githubToken() ?? undefined,
      branch,
      setActive,
    });
    rebuildIndex();
    return Response.json({ ok: true, repo });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}

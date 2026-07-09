import { listGithubRepos } from "@/lib/github";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ repos: await listGithubRepos() });
}

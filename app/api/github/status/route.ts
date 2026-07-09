import { githubStatus } from "@/lib/github";

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(githubStatus());
}

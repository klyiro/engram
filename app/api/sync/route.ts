import { pullActive, syncStatus } from "@/lib/git";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(await syncStatus());
}

/** Manual refresh — pull the active vault's remote now (index rebuilds on change). */
export async function POST() {
  return Response.json(await pullActive());
}

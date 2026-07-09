import { syncStatus } from "@/lib/git";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(await syncStatus());
}

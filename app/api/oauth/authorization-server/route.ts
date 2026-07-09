import { authServerMetadata, CORS } from "@/lib/oauth";

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(authServerMetadata(), { headers: CORS });
}
export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

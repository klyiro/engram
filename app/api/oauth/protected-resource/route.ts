import { CORS, protectedResourceMetadata } from "@/lib/oauth";

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(protectedResourceMetadata(), { headers: CORS });
}
export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

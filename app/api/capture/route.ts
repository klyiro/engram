import { captureNote } from "@/lib/harness";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { text } = await req.json().catch(() => ({}));
  if (!text || typeof text !== "string") return Response.json({ error: "text required" }, { status: 400 });
  try {
    return Response.json(await captureNote(text));
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}

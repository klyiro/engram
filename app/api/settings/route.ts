import { publicSettings, updateSettings, type SettingsPatch } from "@/lib/settings";

export const dynamic = "force-dynamic";

/** Current settings (secrets redacted to *Set booleans). Behind dashboard auth. */
export function GET() {
  return Response.json(publicSettings());
}

/** Apply a partial update; returns the fresh redacted view. */
export async function PUT(req: Request) {
  let body: SettingsPatch;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }
  try {
    return Response.json(updateSettings(body));
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "update failed" }, { status: 500 });
  }
}

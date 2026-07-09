import { getGraph, listNotes } from "@/lib/vault/store";

export const dynamic = "force-dynamic";

/** Light vault stats for the home: note / folder / link counts. */
export function GET() {
  const notes = listNotes();
  const folders = new Set(notes.map((n) => n.folder).filter((f) => f && f !== "root"));
  return Response.json({ notes: notes.length, folders: folders.size, links: getGraph().edges.length });
}

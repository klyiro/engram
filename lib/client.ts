export type { Note, NoteMeta, TreeNode, Graph, GraphNode, GraphEdge } from "@/lib/vault/types";

export const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`${r.status}`);
    return r.json();
  });

/** Muted, distinguishable folder colors for the graph + tree accents. */
export const FOLDER_COLORS: Record<string, string> = {
  clients: "#3b82f6",
  decisions: "#a855f7",
  projects: "#22c55e",
  people: "#f59e0b",
  meetings: "#ec4899",
  research: "#06b6d4",
  docs: "#64748b",
  milestones: "#ef4444",
  inbox: "#eab308",
  "bm-remember": "#14b8a6",
  ops: "#10b981",
  daily: "#8b5cf6",
  archive: "#71717a",
  root: "#a1a1aa",
};

export function folderColor(folder: string): string {
  return FOLDER_COLORS[folder] ?? "#a1a1aa";
}

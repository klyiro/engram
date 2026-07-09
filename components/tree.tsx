"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, FileText } from "lucide-react";
import type { TreeNode } from "@/lib/client";
import { folderColor } from "@/lib/client";
import { cn } from "@/lib/utils";

function Dir({ node, activePath, depth }: { node: TreeNode; activePath?: string; depth: number }) {
  const [open, setOpen] = useState(depth === 0);
  return (
    <li>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-1 rounded-md py-1 pr-2 text-left text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        style={{ paddingLeft: depth * 12 + 8 }}
      >
        <ChevronRight size={14} className={cn("shrink-0 transition-transform", open && "rotate-90")} />
        <span className="size-1.5 shrink-0 rounded-full" style={{ background: folderColor(node.name) }} />
        <span className="truncate">{node.name}</span>
      </button>
      {open && (
        <ul>
          {node.children?.map((c) =>
            c.type === "dir" ? (
              <Dir key={c.path} node={c} activePath={activePath} depth={depth + 1} />
            ) : (
              <File key={c.path} node={c} activePath={activePath} depth={depth + 1} />
            ),
          )}
        </ul>
      )}
    </li>
  );
}

function File({ node, activePath, depth }: { node: TreeNode; activePath?: string; depth: number }) {
  const router = useRouter();
  const active = node.path === activePath;
  return (
    <li>
      <button
        onClick={() => router.push(`/n/${node.path}`)}
        className={cn(
          "flex w-full items-center gap-1.5 truncate rounded-md py-1 pr-2 text-left transition-colors",
          active ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
        )}
        style={{ paddingLeft: depth * 12 + 8 }}
      >
        <FileText size={13} className="shrink-0 opacity-50" />
        <span className="truncate">{node.title || node.name}</span>
      </button>
    </li>
  );
}

export function Tree({ tree, activePath }: { tree: TreeNode; activePath?: string }) {
  return (
    <ul className="pb-4">
      {tree.children?.map((c) =>
        c.type === "dir" ? (
          <Dir key={c.path} node={c} activePath={activePath} depth={0} />
        ) : (
          <File key={c.path} node={c} activePath={activePath} depth={0} />
        ),
      )}
    </ul>
  );
}

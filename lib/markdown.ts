import { visit } from "unist-util-visit";

/** Rewrite `[[target|alias]]` into a markdown link `[alias](wikilink:target)`. */
export function preprocessWikilinks(md: string): string {
  return md.replace(/\[\[([^\]\n]+)\]\]/g, (_m, inner: string) => {
    const [t, a] = inner.split("|");
    const target = (t ?? "").trim();
    const alias = (a ?? t ?? "").trim();
    return `[${alias}](wikilink:${encodeURIComponent(target)})`;
  });
}

/** Reduce a wikilink target to a bare filename stem (path + alias stripped). */
export function wikilinkStem(target: string): string {
  const noAlias = target.split("|")[0].trim();
  const base = noAlias.split("/").pop() || noAlias;
  return base.replace(/\.md$/i, "").trim();
}

/**
 * remark plugin: turn Obsidian callouts `> [!type] Title` into
 * `<div class="callout callout-type"><p class="callout-title">Title</p>…</div>`.
 */
export function remarkCallouts() {
  return (tree: unknown) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    visit(tree as any, "blockquote", (node: any) => {
      const first = node.children?.[0];
      if (!first || first.type !== "paragraph") return;
      const t0 = first.children?.[0];
      if (!t0 || t0.type !== "text") return;
      // Only the first line (up to a newline) is the title; the rest stays as body.
      const m = /^\[!(\w+)\]([+-]?)[ \t]*([^\n]*)(?:\n([\s\S]*))?$/.exec(t0.value);
      if (!m) return;
      const type = m[1].toLowerCase();
      const titleText = (m[3] || "").trim() || type.charAt(0).toUpperCase() + type.slice(1);
      t0.value = m[4] ?? ""; // remaining body text (siblings after t0 are preserved)

      node.children.unshift({
        type: "paragraph",
        data: { hName: "div", hProperties: { className: "callout-title" } },
        children: [{ type: "text", value: titleText }],
      });
      node.data = {
        ...(node.data || {}),
        hName: "div",
        hProperties: { className: `callout callout-${type}`, "data-callout": type },
      };
    });
  };
}

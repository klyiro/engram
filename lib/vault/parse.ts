import matter from "gray-matter";
import type { RawLink, NoteMeta } from "./types";

const WIKILINK = /\[\[([^\]]+)\]\]/g;

export function humanize(slug: string): string {
  return slug
    .replace(/[-_]+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function normalizeTags(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x));
  if (typeof v === "string") return v.split(",").map((s) => s.trim()).filter(Boolean);
  return [];
}

/** First path segment = category; "root" for a top-level file. */
export function folderOf(relPath: string): string {
  const seg = relPath.split("/");
  return seg.length > 1 ? seg[0] : "root";
}

/** Resolve a wikilink target to a bare filename stem (path portion is a hint only). */
export function stemOf(target: string): string {
  const noAlias = target.split("|")[0].trim();
  const base = noAlias.split("/").pop() || noAlias;
  return base.replace(/\.md$/i, "").trim();
}

function parseRawLink(raw: string, source: RawLink["source"]): RawLink {
  const [targetPart, alias] = raw.split("|");
  return { target: targetPart.trim(), alias: alias?.trim(), source };
}

export function extractRawLinks(body: string, frontmatter: Record<string, unknown>): RawLink[] {
  const links: RawLink[] = [];
  WIKILINK.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = WIKILINK.exec(body))) links.push(parseRawLink(m[1], "body"));

  const related = frontmatter.related;
  const relArr = Array.isArray(related) ? related : related != null ? [related] : [];
  for (const r of relArr) {
    if (typeof r !== "string") continue;
    const inner = r.replace(/^\s*\[\[/, "").replace(/\]\]\s*$/, "");
    links.push(parseRawLink(inner, "related"));
  }
  return links;
}

export interface ParsedNote {
  meta: Omit<NoteMeta, "mtimeMs">;
  body: string;
  rawLinks: RawLink[];
}

export function parseNote(relPath: string, raw: string): ParsedNote {
  let data: Record<string, unknown> = {};
  let body = raw;
  try {
    const g = matter(raw);
    data = (g.data ?? {}) as Record<string, unknown>;
    body = g.content;
  } catch {
    // Tolerate malformed frontmatter — treat whole file as body.
  }

  const slug = (relPath.split("/").pop() || relPath).replace(/\.md$/i, "");
  const tags = normalizeTags(data.tags);
  const titleFm = typeof data.title === "string" ? data.title.trim() : "";

  const meta: Omit<NoteMeta, "mtimeMs"> = {
    path: relPath,
    slug,
    title: titleFm || humanize(slug),
    folder: folderOf(relPath),
    type: typeof data.type === "string" ? data.type : tags[0],
    tags,
    status: data.status != null ? String(data.status) : undefined,
    created: data.created != null ? String(data.created) : undefined,
    updated:
      data.updated != null ? String(data.updated) : data.date != null ? String(data.date) : undefined,
    frontmatter: data,
  };

  return { meta, body, rawLinks: extractRawLinks(body, data) };
}

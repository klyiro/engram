import matter from "gray-matter";

/**
 * Guard the one chokepoint every writer passes through.
 *
 * Instructions in a system prompt are persuasion; a check here is a guarantee. An agent that
 * hand-writes YAML into `content` can produce frontmatter that gray-matter refuses to parse
 * (the classic: an unquoted second colon in a title). On read that frontmatter is discarded
 * silently, so the note loses its status, tags and title — and a note claiming `status: locked`
 * quietly ranks as an ordinary one. Cheaper to refuse the write than to hunt the ghost later.
 */
export interface FrontmatterCheck {
  ok: boolean;
  error?: string;
}

/** Notes without frontmatter are fine. Notes that open with `---` must parse. */
export function checkFrontmatter(content: string): FrontmatterCheck {
  if (!content.trimStart().startsWith("---")) return { ok: true };
  try {
    matter(content);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message.split("\n")[0] };
  }
}

export function frontmatterErrorMessage(relPath: string, error: string): string {
  return (
    `Refusing to write ${relPath}: its frontmatter is not valid YAML (${error}). ` +
    `If it were written, the status, tags and title would be silently ignored on every read. ` +
    `Usual cause: an unquoted ":" in a value — write title: "Decision: X" instead of title: Decision: X. ` +
    `Safest fix: pass a \`frontmatter\` object and a plain \`body\` instead of hand-writing YAML into \`content\`; ` +
    `it is serialised for you and always parses.`
  );
}

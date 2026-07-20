import { describe, expect, test } from "bun:test";
import { TOOLS, TOOL_MAP, visibleTools } from "./tools";

/**
 * The access-control claim, pinned.
 *
 * "A read-only token never even sees the write tools" is asserted in the README, DEPLOY.md and
 * docs/curator.md. It is the reason a teammate's agent can be handed a token safely. Until now
 * nothing verified it, so adding a tool and forgetting `write: true` would quietly hand every
 * read-only caller a mutation primitive.
 */

const MUTATORS = [
  "brain_write",
  "brain_edit",
  "brain_append",
  "brain_move",
  "brain_create_folder",
  "brain_supersede",
  "brain_capture",
  "brain_delete",
];

describe("write flags", () => {
  test("every known mutating tool is marked write: true", () => {
    for (const name of MUTATORS) {
      expect(TOOL_MAP.get(name)?.write).toBe(true);
    }
  });

  test("no tool named like a mutation is missing its write flag", () => {
    // Catches a new tool added without `write: true` — the failure mode that would silently
    // expose a mutation to read-only callers.
    const suspicious = TOOLS.filter(
      (t) => /write|edit|append|move|delete|create|supersede|capture|rename/i.test(t.name) && !t.write,
    );
    expect(suspicious.map((t) => t.name)).toEqual([]);
  });
});

describe("visibleTools", () => {
  test("a read-only caller sees no write tool at all", () => {
    const names = visibleTools(false, true).map((t) => t.name);
    for (const m of MUTATORS) expect(names).not.toContain(m);
  });

  test("a read-only caller still gets the full read surface", () => {
    const names = visibleTools(false, true).map((t) => t.name);
    for (const r of ["brain_schema", "brain_search", "brain_read", "brain_list", "brain_backlinks", "brain_graph"]) {
      expect(names).toContain(r);
    }
  });

  test("a write caller sees the write tools", () => {
    const names = visibleTools(true, true).map((t) => t.name);
    expect(names).toContain("brain_write");
    expect(names).toContain("brain_supersede");
  });

  test("brain_capture is hidden unless the harness is on, for either scope", () => {
    expect(visibleTools(true, false).map((t) => t.name)).not.toContain("brain_capture");
    expect(visibleTools(false, false).map((t) => t.name)).not.toContain("brain_capture");
    expect(visibleTools(true, true).map((t) => t.name)).toContain("brain_capture");
  });

  test("read-only visibility is a strict subset of write visibility", () => {
    const write = new Set(visibleTools(true, true).map((t) => t.name));
    const read = visibleTools(false, true).map((t) => t.name);
    expect(read.length).toBeLessThan(write.size);
    for (const n of read) expect(write.has(n)).toBe(true);
  });
});

describe("tool surface", () => {
  test("every tool has a name, a description and an input schema", () => {
    for (const t of TOOLS) {
      expect(t.name).toMatch(/^brain_/);
      expect(t.description.length).toBeGreaterThan(0);
      expect(t.inputSchema).toBeTruthy();
    }
  });

  test("tool names are unique", () => {
    expect(TOOL_MAP.size).toBe(TOOLS.length);
  });

  test("brain_write advertises the supersede path — the guard's error is only half the lesson", () => {
    expect(TOOL_MAP.get("brain_write")?.description).toContain("brain_supersede");
  });
});

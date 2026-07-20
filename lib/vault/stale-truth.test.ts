import { beforeAll, describe, expect, test } from "bun:test";
import fs from "node:fs";
import path from "node:path";

/**
 * The stale-truth eval: does the vault stop an agent quoting a fact that is no longer true?
 *
 * Every fixture pair here is written with *near-identical wording* on purpose. That is the whole
 * difficulty — a retired price and a live one are textually the same, so relevance alone cannot
 * separate them and often ranks the retired one higher (it is usually the longer, more detailed
 * document). If these tests pass, the product's central claim holds; if they regress, search
 * silently starts handing agents dead facts again, which is the failure Engram exists to prevent.
 */

// The vault path is fixed by test/setup.ts, preloaded before any module reads config.
const vault = process.env.VAULT_DIR!;

function write(rel: string, content: string) {
  const abs = path.join(vault, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, "utf8");
}

const PAST = "2026-01-15";
const FUTURE = "2099-01-01";

// The retired note is deliberately WORDIER than its replacement: it should still lose.
write(
  "pricing/acme-pricing.md",
  `---
title: Acme Pricing
status: superseded
superseded_by: "[[acme-pricing-live]]"
superseded_at: 2026-06-01
---
Acme pricing. The Acme retainer price is EUR 2000 per month. This price covers the
full Acme engagement. Pricing questions about the Acme price should reference this
pricing note. Price reviewed quarterly.
`,
);

write(
  "pricing/acme-pricing-live.md",
  `---
title: Acme Pricing (current)
status: locked
---
The Acme retainer price is EUR 2500 per month.
`,
);

write(
  "pricing/beta-terms.md",
  `---
title: Beta Terms
valid_until: ${PAST}
---
Beta terms: the beta discount is 20 percent off the beta price.
`,
);

write(
  "pricing/gamma-terms.md",
  `---
title: Gamma Terms
valid_until: ${FUTURE}
---
Gamma terms: the gamma discount is 20 percent off the gamma price.
`,
);

write(
  "archive/legacy-pricing.md",
  `---
title: Legacy Pricing
---
Legacy pricing: the legacy price was EUR 900 per month.
`,
);

write(
  "pricing/widget-pricing.md",
  `---
title: Widget Pricing
---
The widget price is EUR 100.
`,
);

type Store = typeof import("./store");
type Write = typeof import("./write");
type Conflict = typeof import("./conflict");

let store: Store;
let writeMod: Write;
let conflict: Conflict;

beforeAll(async () => {
  store = await import("./store");
  writeMod = await import("./write");
  conflict = await import("./conflict");
  store.rebuildIndex();
});

describe("search withholds facts that are no longer true", () => {
  test("a superseded note is withheld even though it matches the query better", () => {
    const r = store.searchNotes("acme price pricing");
    const hitPaths = r.hits.map((h) => h.path);

    expect(hitPaths).toContain("pricing/acme-pricing-live.md");
    expect(hitPaths).not.toContain("pricing/acme-pricing.md");

    const ex = r.excluded.find((e) => e.path === "pricing/acme-pricing.md");
    expect(ex).toBeDefined();
    expect(ex!.reason).toContain("superseded by acme-pricing-live");
  });

  test("the exclusion is explainable — every withheld note carries a reason", () => {
    const r = store.searchNotes("acme price pricing");
    for (const e of r.excluded) expect(e.reason.length).toBeGreaterThan(0);
  });

  test("an expired note is withheld and the reason names the date", () => {
    const r = store.searchNotes("beta discount terms");
    expect(r.hits.map((h) => h.path)).not.toContain("pricing/beta-terms.md");
    const ex = r.excluded.find((e) => e.path === "pricing/beta-terms.md");
    expect(ex).toBeDefined();
    expect(ex!.reason).toContain("expired");
    expect(ex!.reason).toContain(PAST);
  });

  test("an unexpired note with the same shape is NOT withheld", () => {
    const r = store.searchNotes("gamma discount terms");
    expect(r.hits.map((h) => h.path)).toContain("pricing/gamma-terms.md");
  });

  test("an archived note is withheld and reported as archived", () => {
    const r = store.searchNotes("legacy price");
    expect(r.hits.map((h) => h.path)).not.toContain("archive/legacy-pricing.md");
    const ex = r.excluded.find((e) => e.path === "archive/legacy-pricing.md");
    expect(ex?.authority).toBe("archived");
  });

  test("withheld notes are recoverable on request, not hidden", () => {
    const r = store.searchNotes("acme price pricing", { includeInvalid: true });
    expect(r.hits.map((h) => h.path)).toContain("pricing/acme-pricing.md");
  });

  test("a retired note never outranks its live replacement when both are requested", () => {
    const r = store.searchNotes("acme price pricing", { includeInvalid: true });
    const live = r.hits.findIndex((h) => h.path === "pricing/acme-pricing-live.md");
    const dead = r.hits.findIndex((h) => h.path === "pricing/acme-pricing.md");
    expect(live).toBeGreaterThanOrEqual(0);
    expect(dead).toBeGreaterThan(live);
  });
});

describe("guardConflict refuses a second live note on one subject", () => {
  test("a dated sibling of a live note is refused, and the error names brain_supersede", () => {
    expect(() => conflict.guardConflict("pricing/widget-pricing-2026-07.md", true, false)).toThrow(
      /brain_supersede/,
    );
  });

  test("the refusal names the note it collides with", () => {
    expect(() => conflict.guardConflict("pricing/widget-pricing-new.md", true, false)).toThrow(
      /widget-pricing\.md/,
    );
  });

  test("allow_conflict is a real escape hatch", () => {
    expect(() => conflict.guardConflict("pricing/widget-pricing-2026-07.md", true, true)).not.toThrow();
  });

  test("overwriting an existing note is not a conflict — that is guardTruncation's job", () => {
    expect(() => conflict.guardConflict("pricing/widget-pricing-2026-07.md", false, false)).not.toThrow();
  });

  test("a genuinely distinct note is allowed — the guard must not cry wolf", () => {
    // A region-specific note is a real distinction, not the duplicate-price bug.
    expect(() => conflict.guardConflict("pricing/widget-pricing-uk.md", true, false)).not.toThrow();
    expect(() => conflict.guardConflict("pricing/gadget-pricing.md", true, false)).not.toThrow();
    expect(() => conflict.guardConflict("pricing/widget-warranty.md", true, false)).not.toThrow();
  });

  test("a retired note is not a conflict — a replacement is supposed to sit next to it", () => {
    // acme-pricing.md is superseded, so writing a fresh acme-pricing-2026 must not be blocked by it.
    expect(() => conflict.guardConflict("pricing/acme-pricing-2026.md", true, false)).not.toThrow();
  });

  test("findConflicts only reports live notes", () => {
    expect(conflict.findConflicts("pricing/acme-pricing-2026.md")).toHaveLength(0);
    const live = conflict.findConflicts("pricing/widget-pricing-2026.md");
    expect(live.map((c) => c.path)).toEqual(["pricing/widget-pricing.md"]);
  });
});

describe("subjectTokens", () => {
  test("strips dates and recency words, keeps the subject", () => {
    expect([...conflict.subjectTokens("acme-pricing-2026-07")].sort()).toEqual(["acme", "pricing"]);
    expect([...conflict.subjectTokens("acme-pricing-new")].sort()).toEqual(["acme", "pricing"]);
    expect([...conflict.subjectTokens("acme-pricing-v2")].sort()).toEqual(["acme", "pricing"]);
    expect([...conflict.subjectTokens("acme-pricing-q3")].sort()).toEqual(["acme", "pricing"]);
  });

  test("keeps meaningful qualifiers, so distinct notes stay distinct", () => {
    expect([...conflict.subjectTokens("acme-pricing-uk")].sort()).toEqual(["acme", "pricing", "uk"]);
  });
});

describe("supersedeNote is atomic", () => {
  test("retires the old note in place and creates the replacement in one operation", async () => {
    await writeMod.supersedeNote(
      "pricing/widget-pricing.md",
      "pricing/widget-pricing-2027.md",
      "repriced for 2027",
      "The widget price is EUR 150.",
    );

    const oldRaw = fs.readFileSync(path.join(vault, "pricing/widget-pricing.md"), "utf8");
    expect(oldRaw).toContain("status: superseded");
    expect(oldRaw).toContain("superseded_by:");
    expect(oldRaw).toContain("repriced for 2027");
    // Body preserved — backlinks and chronology survive, and the truncation guard cannot trip.
    expect(oldRaw).toContain("The widget price is EUR 100.");

    expect(fs.existsSync(path.join(vault, "pricing/widget-pricing-2027.md"))).toBe(true);
  });

  test("after superseding, search withholds the old note and returns the new one", () => {
    store.rebuildIndex();
    const r = store.searchNotes("widget price");
    expect(r.hits.map((h) => h.path)).toContain("pricing/widget-pricing-2027.md");
    expect(r.hits.map((h) => h.path)).not.toContain("pricing/widget-pricing.md");
    const ex = r.excluded.find((e) => e.path === "pricing/widget-pricing.md");
    expect(ex?.reason).toContain("superseded by widget-pricing-2027");
  });

  test("refuses to supersede a note into itself", () => {
    expect(writeMod.supersedeNote("pricing/a.md", "pricing/a.md")).rejects.toThrow();
  });

  test("refuses to supersede a note that does not exist", () => {
    expect(writeMod.supersedeNote("pricing/nope.md", "pricing/other.md")).rejects.toThrow(/does not exist/);
  });
});

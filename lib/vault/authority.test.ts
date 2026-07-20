import { describe, expect, test } from "bun:test";
import {
  authorityOf,
  effectiveAuthority,
  isUnrecognizedStatus,
  overlayValidity,
  weightOf,
  type Authority,
} from "./authority";

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 6, 20); // 2026-07-20

describe("authorityOf", () => {
  test("a note with no status is current — a vault using no conventions ranks purely by relevance", () => {
    expect(authorityOf({ path: "clients/acme.md" })).toBe("current");
  });

  test("classifies each status vocabulary", () => {
    expect(authorityOf({ path: "a.md", status: "locked" })).toBe("authoritative");
    expect(authorityOf({ path: "a.md", status: "canonical" })).toBe("authoritative");
    expect(authorityOf({ path: "a.md", status: "superseded" })).toBe("superseded");
    expect(authorityOf({ path: "a.md", status: "retired" })).toBe("superseded");
    expect(authorityOf({ path: "a.md", status: "draft" })).toBe("provisional");
    expect(authorityOf({ path: "a.md", status: "proposed" })).toBe("provisional");
  });

  test("status words are matched in tags too", () => {
    expect(authorityOf({ path: "a.md", tags: ["pricing", "locked"] })).toBe("authoritative");
  });

  test("matches whole tokens inside compound values, not substrings", () => {
    expect(authorityOf({ path: "a.md", status: "draft-for-approval" })).toBe("provisional");
    // "wip" must not match inside "wiped"
    expect(authorityOf({ path: "a.md", status: "wiped" })).toBe("current");
  });

  test("folder beats frontmatter — a locked note in archive/ is still archived", () => {
    expect(authorityOf({ path: "archive/old-pricing.md", status: "locked" })).toBe("archived");
  });

  test("superseded beats authoritative — dead however loudly it calls itself canonical", () => {
    expect(authorityOf({ path: "a.md", status: "canonical", tags: ["superseded"] })).toBe("superseded");
  });
});

describe("weightOf", () => {
  test("orders the classes so authority can outrank relevance", () => {
    const order: Authority[] = ["authoritative", "current", "provisional", "superseded", "archived"];
    const weights = order.map(weightOf);
    for (let i = 1; i < weights.length; i++) expect(weights[i]).toBeLessThan(weights[i - 1]);
  });

  test("authoritative outweighs current by enough to flip a close match", () => {
    expect(weightOf("authoritative")).toBeGreaterThan(weightOf("current") * 2);
  });
});

describe("overlayValidity", () => {
  test("a live note passes through untouched", () => {
    expect(overlayValidity("current", null, null, NOW)).toEqual({ authority: "current", retired: false });
  });

  test("an explicit superseded_by retires the note and names its replacement", () => {
    const r = overlayValidity("current", null, "price-live", NOW);
    expect(r.retired).toBe(true);
    expect(r.authority).toBe("superseded");
    expect(r.reason).toBe("superseded by price-live");
  });

  test("an expired valid_until retires the note and dates it", () => {
    const r = overlayValidity("current", NOW - DAY, null, NOW);
    expect(r.retired).toBe(true);
    expect(r.authority).toBe("superseded");
    expect(r.reason).toContain("expired");
  });

  test("a valid_until in the future does not retire", () => {
    expect(overlayValidity("current", NOW + DAY, null, NOW).retired).toBe(false);
  });

  test("a blessing does not outlive its expiry — locked-but-stale is still retired", () => {
    // The hole this closes: `authoritative` is a static 3.5x forever, so without the overlay a
    // stale canonical doc outranks a fresh working note indefinitely.
    const r = overlayValidity("authoritative", NOW - DAY, null, NOW);
    expect(r.authority).toBe("superseded");
    expect(r.retired).toBe(true);
  });

  test("archived wins over everything and is reported as archived, not superseded", () => {
    const r = overlayValidity("archived", NOW - DAY, "something", NOW);
    expect(r.authority).toBe("archived");
    expect(r.reason).toBe("archived");
  });

  test("explicit supersession is reported ahead of expiry when both apply", () => {
    const r = overlayValidity("current", NOW - DAY, "price-live", NOW);
    expect(r.reason).toBe("superseded by price-live");
  });
});

describe("effectiveAuthority", () => {
  test("combines text classification with temporal validity in one call", () => {
    const r = effectiveAuthority(
      { path: "pricing/acme.md", status: "locked", validUntil: NOW - DAY },
      NOW,
    );
    expect(r.authority).toBe("superseded");
    expect(r.retired).toBe(true);
  });
});

describe("isUnrecognizedStatus", () => {
  test("no status is not a mistake", () => {
    expect(isUnrecognizedStatus(undefined)).toBe(false);
    expect(isUnrecognizedStatus("")).toBe(false);
    expect(isUnrecognizedStatus("   ")).toBe(false);
  });

  test("accepts every word the ranking model acts on", () => {
    for (const s of ["locked", "canonical", "superseded", "retired", "draft", "proposed"]) {
      expect(isUnrecognizedStatus(s)).toBe(false);
    }
  });

  test("accepts common neutral statuses a vault is entitled to use", () => {
    for (const s of ["active", "current", "done", "in-progress", "published"]) {
      expect(isUnrecognizedStatus(s)).toBe(false);
    }
  });

  test("flags the silent-failure case: a typo that falls through to `current`", () => {
    expect(isUnrecognizedStatus("lokced")).toBe(true);
    expect(isUnrecognizedStatus("supersded")).toBe(true);
  });

  test("is case-insensitive and tolerates compound values", () => {
    expect(isUnrecognizedStatus("LOCKED")).toBe(false);
    expect(isUnrecognizedStatus("draft-for-approval")).toBe(false);
  });
});

# Vault schema & conventions

The contract every agent reads before writing (served via the `brain_schema` MCP tool).
The app is taxonomy-agnostic — it renders whatever folders exist; this documents the defaults.

## Folders
`clients/` · `decisions/` · `projects/` · `people/` · `meetings/` · `docs/` · `research/` ·
`inbox/` (unsorted captures). Slugs are kebab-case. New folders are allowed.

## Frontmatter (YAML, optional)
```yaml
---
title: Human title       # graph node label (falls back to filename)
type: decision           # decision | client | project | person | meeting | doc | research
tags: [alpha, beta]
status: active           # free text
created: 2026-01-15
related:
  - "[[projects/cortex]]"
---
```

## Links
- `[[note]]` / `[[../path/note|Alias]]` — resolve by filename stem.
- `related:` frontmatter arrays are edges too.
- Graph: nodes = notes (colored by folder, sized by degree), edges = the links above.

## Callouts
`> [!note]`, `> [!tip]`, `> [!warning]`, `> [!abstract]`, `> [!danger]`, `> [!question]`.

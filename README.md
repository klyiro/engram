# Cortex

Agent-first, markdown-native second brain. A **dashboard** for humans and an **MCP server**
for agents, over a git-backed folder of markdown notes. No database — the files are the
source of truth, an in-memory index powers search + graph, and git is the durable store.

Runs on **any** folder of markdown (`VAULT_DIR`). Ships with a `sample-vault/` so it works
out of the box.

## Quick start

```bash
bun install
bun dev            # http://localhost:3000 — runs against ./sample-vault
```

Point it at your own vault:

```bash
VAULT_DIR=/path/to/your/vault bun dev
```

## What it does

- **Dashboard** — file tree, note viewer (Obsidian callouts + wikilinks + backlinks),
  Preview / Edit / Split editor with autosave, ⌘K search, force-directed graph.
- **MCP** — `POST /api/mcp` (streamable HTTP, bearer-token). Tools: `brain_search`,
  `brain_read`, `brain_list`, `brain_tree`, `brain_backlinks`, `brain_graph`, `brain_schema`
  (read) · `brain_write`, `brain_edit`, `brain_append`, `brain_move`, `brain_create_folder`,
  `brain_delete` (write). Any MCP client (Claude Code, Hermes, Cursor) connects to one URL.
- **Git-backed** — set `GIT_SYNC_ENABLED=true` and the app commits + pushes vault changes.

## Deploy

Railway (or any Docker host). Mount a volume at `/data`, set `VAULT_DIR=/data`, and point
`GIT_REMOTE` at your **vault repo** — the app clones + syncs it into the volume, so the
vault lives remotely and no machine keeps a local copy. See `.env.example`.

Connect an agent:

```bash
claude mcp add --transport http cortex https://<host>/api/mcp \
  --header "Authorization: Bearer $MCP_TOKEN"
```

## Stack

Next 16 (App Router) · React 19 · TypeScript · Tailwind v4 · shadcn/base-ui · bun ·
MiniSearch · d3-force · MCP SDK. MIT licensed.

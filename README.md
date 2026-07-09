# Cortex

Agent-first, markdown-native second brain. A **dashboard** for humans and an **MCP server**
for agents, over a git-backed folder of markdown notes. No database — the files are the
source of truth, an in-memory index powers search + graph, and git is the durable store.

Runs on **any** folder of markdown (`VAULT_DIR`). Ships with a `sample-vault/` so it works
out of the box.

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/new)
[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/klyiro/cortex)

> **Not Vercel.** Cortex needs a persistent volume + a long-running process (git-backed vault
> clones, a file watcher, an in-memory index), so serverless hosts won't run it. Use Railway,
> Render, Fly, or any Docker host with a volume.

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

Railway / Render / Fly / any Docker host (see the buttons above — **not** serverless). Mount a
volume at `/data`, set `CORTEX_DATA_DIR=/data`, then connect your vault repo(s) **in the
dashboard** (Workspaces) — by URL + token, or GitHub OAuth. Dashboard login is Google.

- **Railway:** New Project → *Deploy from GitHub repo* → add a Volume at `/data`. For a true
  one-click, publish a Railway Template from your deploy and swap its URL into the button.
- **Render:** one-click via the bundled `render.yaml` (Docker + a `/data` disk).

Full env + Google/GitHub OAuth setup: **[DEPLOY.md](./DEPLOY.md)**.

Connect an agent (dashboard → **Connect** shows the exact command):

```bash
claude mcp add --transport http cortex https://<host>/api/mcp \
  --header "Authorization: Bearer <token>"
```

## Stack

Next 16 (App Router) · React 19 · TypeScript · Tailwind v4 · shadcn/base-ui · bun ·
MiniSearch · d3-force · MCP SDK. MIT licensed.

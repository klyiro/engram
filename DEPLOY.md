# Deploying Cortex

Cortex deploys as one container (this repo). Vault repos are **connected in the dashboard**
(Workspaces) — no repo lives in this repo, and no laptop keeps a vault copy. The active
workspace is what the dashboard shows and what agents read/write.

## 1. Push this repo to GitHub
Already a git repo — create a remote and push `main`.

## 2. Dashboard login — Google OAuth
1. Google Cloud Console → Credentials → Create OAuth client ID → Web application.
2. Redirect URI: `https://<your-app>.up.railway.app/api/auth/callback`
3. Copy the Client ID + Secret.

## 3. Railway
1. **New Project → Deploy from GitHub repo** → this repo (builds via root `Dockerfile`).
2. **Add a Volume**, mount path `/data`.
3. **Variables:**

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_APP_NAME` | e.g. `Klyiro Brain` |
| `CORTEX_DATA_DIR` | `/data` (app state + vault clones live here) |
| `GIT_SYNC_ENABLED` | `true` (auto commit+push the active vault) |
| `GIT_AUTHOR_NAME` / `GIT_AUTHOR_EMAIL` | commit identity |
| `AUTH_SECRET` | `openssl rand -base64 32`, or Railway "Generate" |
| `APP_URL` | `https://<your-app>.up.railway.app` |
| `ALLOWED_EMAILS` | comma-separated team emails (Google login) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | from step 2 |
| `ANTHROPIC_API_KEY` + `HARNESS_ENABLED=true` | optional, for `brain_capture` |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | optional — see step 5 (OAuth path) |

Deploy, then sign in with Google.

## 4. Connect a vault repo (in the dashboard → Workspaces)
Two ways — pick one:

- **URL + token (zero setup):** paste the repo URL + a GitHub token with access. Works with
  no GitHub OAuth app — the simplest path, especially for self-hosting.
- **Connect GitHub (nicer):** if you set the GitHub OAuth app in step 5, click *Connect GitHub*
  and pick a repo from a list.

Add repos, switch the active one, remove — all in the UI. MCP tokens (per teammate/agent) are
created on the **Connect** page.

## 5. (Optional) GitHub OAuth app — for the "Connect GitHub" flow
Each deployment uses **its own** GitHub OAuth app (secrets can't be shared, and the callback is
host-specific — so there's no shared central app for self-hosters):
1. GitHub → Settings → Developer settings → **OAuth Apps → New OAuth App**.
2. **Authorization callback URL:** `https://<your-app>.up.railway.app/api/github/callback`
3. Set `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` in Railway.

Skip this entirely if you use the URL + token path in step 4.

## 6. Connect agents to the MCP
Dashboard → **Connect** → copy the command. Agents always hit the same endpoint and only ever
see the **active** vault:
```bash
claude mcp add --transport http cortex https://<your-app>.up.railway.app/api/mcp \
  --header "Authorization: Bearer <token from the Connect page>"
```

## Notes
- **No auth locally:** leave `AUTH_SECRET` empty (or `AUTH_DISABLED=true`) and the dashboard is open; the MCP is open until a token exists.
- Git tokens are stored **encrypted** at rest (keyed off `AUTH_SECRET`); token hashes and vault clones live under `CORTEX_DATA_DIR`, never in a vault repo.

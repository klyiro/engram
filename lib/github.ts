import fs from "node:fs";
import path from "node:path";
import { APP_URL, DATA_ROOT, GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET } from "@/lib/config";
import { decryptSecret, encryptSecret } from "@/lib/crypto";

const GH_FILE = path.join(DATA_ROOT, "github.json");
const REDIRECT_URI = () => `${APP_URL}/api/github/callback`;

export function githubConfigured(): boolean {
  return GITHUB_CLIENT_ID !== "" && GITHUB_CLIENT_SECRET !== "";
}

export function githubAuthUrl(state: string): string {
  const p = new URLSearchParams({
    client_id: GITHUB_CLIENT_ID,
    redirect_uri: REDIRECT_URI(),
    scope: "repo",
    state,
  });
  return `https://github.com/login/oauth/authorize?${p.toString()}`;
}

export async function exchangeGithubCode(code: string): Promise<string | null> {
  const res = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      client_id: GITHUB_CLIENT_ID,
      client_secret: GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: REDIRECT_URI(),
    }),
  });
  if (!res.ok) return null;
  const d = await res.json();
  return d.access_token ?? null;
}

interface GhState {
  tokenEnc: string;
  login?: string;
  connectedAt: string;
}
function loadGh(): GhState | null {
  try {
    return JSON.parse(fs.readFileSync(GH_FILE, "utf8"));
  } catch {
    return null;
  }
}

export async function connectGithub(token: string): Promise<void> {
  let login: string | undefined;
  try {
    const u = await fetch("https://api.github.com/user", { headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json" } });
    if (u.ok) login = (await u.json()).login;
  } catch {
    /* ignore */
  }
  fs.mkdirSync(DATA_ROOT, { recursive: true });
  fs.writeFileSync(GH_FILE, JSON.stringify({ tokenEnc: encryptSecret(token), login, connectedAt: new Date().toISOString() }, null, 2));
}

export async function getGithubUser(token: string): Promise<{ login: string; email?: string } | null> {
  try {
    const u = await fetch("https://api.github.com/user", {
      headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json" },
    });
    if (!u.ok) return null;
    const d = await u.json();
    return { login: d.login as string, email: (d.email as string) ?? undefined };
  } catch {
    return null;
  }
}

export function githubToken(): string | null {
  const s = loadGh();
  if (!s) return null;
  try {
    return decryptSecret(s.tokenEnc);
  } catch {
    return null;
  }
}

export function githubStatus(): { connected: boolean; login?: string; configured: boolean } {
  const s = loadGh();
  return { connected: !!s, login: s?.login, configured: githubConfigured() };
}

export function disconnectGithub(): void {
  try {
    fs.rmSync(GH_FILE);
  } catch {
    /* ignore */
  }
}

export interface GithubRepo {
  fullName: string;
  name: string;
  cloneUrl: string;
  private: boolean;
  defaultBranch: string;
}

export async function listGithubRepos(): Promise<GithubRepo[]> {
  const token = githubToken();
  if (!token) return [];
  const res = await fetch(
    "https://api.github.com/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member",
    { headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json" } },
  );
  if (!res.ok) return [];
  const arr = (await res.json()) as Array<Record<string, unknown>>;
  return arr.map((r) => ({
    fullName: r.full_name as string,
    name: r.name as string,
    cloneUrl: r.clone_url as string,
    private: r.private as boolean,
    defaultBranch: (r.default_branch as string) || "main",
  }));
}

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { SignJWT, jwtVerify } from "jose";
import { APP_URL, AUTH_SECRET, DATA_ROOT } from "@/lib/config";

/**
 * Minimal OAuth 2.0 Authorization Server for the MCP endpoint, so OAuth-only clients
 * (Claude.ai custom connectors) can connect without a pasted bearer token. Implements the
 * MCP authorization flow: Dynamic Client Registration (RFC 7591) + Authorization Code with
 * PKCE (S256). The authorize step is gated by Engram's existing Google login + email
 * allowlist. Tokens are signed JWTs (jose/HS256, keyed off AUTH_SECRET) — no token store.
 * Enabled whenever AUTH_SECRET is set (i.e. a real deploy); off in open local dev.
 */

const STATE_DIR = process.env.ENGRAM_STATE_DIR || DATA_ROOT;
const CLIENTS_FILE = path.join(STATE_DIR, "oauth-clients.json");
const AUD = "engram-mcp";

const key = () => new TextEncoder().encode(AUTH_SECRET);
export function oauthEnabled(): boolean {
  return AUTH_SECRET !== "";
}
const ISSUER = () => APP_URL;
export const RESOURCE = () => `${APP_URL}/api/mcp`;

export const CORS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "Content-Type, Authorization, mcp-protocol-version",
};
export function corsJson(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store", ...CORS },
  });
}

// ── Dynamic Client Registration ──────────────────────────────────────────────
export interface OAuthClient {
  client_id: string;
  redirect_uris: string[];
  client_name?: string;
  created: string;
}
function loadClients(): OAuthClient[] {
  try {
    return JSON.parse(fs.readFileSync(CLIENTS_FILE, "utf8"));
  } catch {
    return [];
  }
}
function saveClients(c: OAuthClient[]) {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  fs.writeFileSync(CLIENTS_FILE, JSON.stringify(c, null, 2));
}
export function registerClient(redirect_uris: string[], client_name?: string): OAuthClient {
  const rec: OAuthClient = { client_id: crypto.randomUUID(), redirect_uris, client_name, created: new Date().toISOString() };
  const all = loadClients();
  all.push(rec);
  saveClients(all);
  return rec;
}
export function getClient(id: string): OAuthClient | null {
  return loadClients().find((c) => c.client_id === id) ?? null;
}

// ── PKCE (S256 only) ─────────────────────────────────────────────────────────
export function verifyPkce(verifier: string, challenge: string, method?: string): boolean {
  if (method && method !== "S256") return false;
  if (!verifier || !challenge) return false;
  const h = crypto.createHash("sha256").update(verifier).digest("base64url");
  return crypto.timingSafeEqual(Buffer.from(h), Buffer.from(challenge));
}

// ── Authorization code (short-lived JWT, single-use) ─────────────────────────
export interface CodePayload {
  cid: string;
  redirect_uri: string;
  cc: string;
  ccm: string;
  sub: string;
  scope: string;
}
export async function issueCode(p: CodePayload): Promise<string> {
  return new SignJWT({ ...p, typ: "code" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setJti(crypto.randomUUID())
    .setExpirationTime("5m")
    .sign(key());
}
const usedCodes = new Set<string>();
export async function redeemCode(code: string): Promise<CodePayload | null> {
  try {
    const { payload } = await jwtVerify(code, key());
    if (payload.typ !== "code") return null;
    const jti = payload.jti as string;
    if (!jti || usedCodes.has(jti)) return null;
    usedCodes.add(jti);
    return {
      cid: payload.cid as string,
      redirect_uri: payload.redirect_uri as string,
      cc: payload.cc as string,
      ccm: (payload.ccm as string) || "S256",
      sub: payload.sub as string,
      scope: (payload.scope as string) ?? "",
    };
  } catch {
    return null;
  }
}

// ── Access token (JWT) ───────────────────────────────────────────────────────
export async function issueAccessToken(sub: string, scope: string): Promise<{ token: string; expiresIn: number }> {
  const expiresIn = 60 * 60 * 24 * 30; // 30 days
  const token = await new SignJWT({ scope, typ: "at" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(sub)
    .setIssuer(ISSUER())
    .setAudience(AUD)
    .setIssuedAt()
    .setJti(crypto.randomUUID())
    .setExpirationTime("30d")
    .sign(key());
  return { token, expiresIn };
}
export async function verifyAccessToken(token: string): Promise<{ sub: string; scope: string } | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { audience: AUD, issuer: ISSUER() });
    if (payload.typ !== "at") return null;
    return { sub: payload.sub as string, scope: (payload.scope as string) ?? "" };
  } catch {
    return null;
  }
}

// ── Discovery metadata ───────────────────────────────────────────────────────
export function protectedResourceMetadata() {
  return {
    resource: RESOURCE(),
    authorization_servers: [ISSUER()],
    bearer_methods_supported: ["header"],
    scopes_supported: ["mcp"],
  };
}
export function authServerMetadata() {
  const b = APP_URL;
  return {
    issuer: ISSUER(),
    authorization_endpoint: `${b}/api/oauth/authorize`,
    token_endpoint: `${b}/api/oauth/token`,
    registration_endpoint: `${b}/api/oauth/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: ["mcp"],
  };
}

export function wwwAuthenticate(): string {
  return `Bearer resource_metadata="${APP_URL}/.well-known/oauth-protected-resource"`;
}

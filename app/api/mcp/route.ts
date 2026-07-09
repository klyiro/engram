import { MCP_TOKEN } from "@/lib/config";
import { harnessEnabled } from "@/lib/settings";
import { hasAnyToken, verifyToken } from "@/lib/tokens";
import { oauthEnabled, verifyAccessToken, wwwAuthenticate } from "@/lib/oauth";
import { TOOLS, TOOL_MAP } from "@/lib/mcp/tools";

export const dynamic = "force-dynamic";

const PROTOCOL = "2025-06-18";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;

function rpc(id: Json, result?: Json, error?: Json) {
  const msg: Json = { jsonrpc: "2.0", id: id ?? null };
  if (error) msg.error = error;
  else msg.result = result;
  return msg;
}

async function handleMessage(msg: Json): Promise<Json | null> {
  const method: string | undefined = msg?.method;
  const id = msg?.id;
  const params = msg?.params;
  if (!method) return null;
  if (method.startsWith("notifications/")) return null; // notifications get no response

  switch (method) {
    case "initialize":
      return rpc(id, {
        protocolVersion: params?.protocolVersion || PROTOCOL,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "engram", version: "0.1.0" },
      });
    case "ping":
      return rpc(id, {});
    case "tools/list": {
      // Hide the auto-filing harness unless it's turned on (agents file notes themselves).
      const tools = TOOLS.filter((t) => t.name !== "brain_capture" || harnessEnabled());
      return rpc(id, {
        tools: tools.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema })),
      });
    }
    case "tools/call": {
      const tool = TOOL_MAP.get(params?.name);
      if (!tool) return rpc(id, undefined, { code: -32602, message: `unknown tool: ${params?.name}` });
      try {
        const out = await tool.handler(params?.arguments ?? {});
        const text = typeof out === "string" ? out : JSON.stringify(out, null, 2);
        return rpc(id, { content: [{ type: "text", text }] });
      } catch (e) {
        return rpc(id, { content: [{ type: "text", text: `Error: ${(e as Error)?.message ?? e}` }], isError: true });
      }
    }
    default:
      return rpc(id, undefined, { code: -32601, message: `method not found: ${method}` });
  }
}

function jsonResponse(body: Json, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

/** A credential is valid if it matches the shared token, a per-teammate token, or a live OAuth access token. */
async function authOk(token: string): Promise<boolean> {
  if (!token) return false;
  if (MCP_TOKEN !== "" && token === MCP_TOKEN) return true;
  if (verifyToken(token)) return true;
  if (oauthEnabled() && (await verifyAccessToken(token))) return true;
  return false;
}

/** 401 that also advertises the OAuth flow (WWW-Authenticate) so connectors can discover it. */
function unauthorized(): Response {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (oauthEnabled()) headers["WWW-Authenticate"] = wwwAuthenticate();
  return new Response(JSON.stringify(rpc(null, undefined, { code: -32001, message: "unauthorized" })), { status: 401, headers });
}

export async function POST(req: Request) {
  // Enforce auth when any is configured (env MCP_TOKEN, a team token, or OAuth). Open
  // locally when nothing is set. On failure, advertise OAuth so Claude.ai can connect.
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  const authRequired = MCP_TOKEN !== "" || hasAnyToken() || oauthEnabled();
  if (authRequired && !(await authOk(token))) return unauthorized();

  let body: Json;
  try {
    body = await req.json();
  } catch {
    return jsonResponse(rpc(null, undefined, { code: -32700, message: "parse error" }), 400);
  }

  if (Array.isArray(body)) {
    const out = (await Promise.all(body.map(handleMessage))).filter(Boolean);
    return out.length === 0 ? new Response(null, { status: 202 }) : jsonResponse(out);
  }
  const res = await handleMessage(body);
  return res ? jsonResponse(res) : new Response(null, { status: 202 });
}

// This server is request/response only (no server-initiated SSE stream). When OAuth is on,
// answer probes with a 401 that advertises the flow so connectors can discover it.
export function GET() {
  if (oauthEnabled()) {
    return new Response("Unauthorized", { status: 401, headers: { "WWW-Authenticate": wwwAuthenticate() } });
  }
  return new Response("Method Not Allowed", { status: 405 });
}

import { AUTH_DISABLED, AUTH_SECRET, MCP_TOKEN } from "@/lib/config";
import { appName, curatorMode, harnessEnabled } from "@/lib/settings";
import { hasAnyToken } from "@/lib/tokens";

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({
    appName: appName(),
    /** "off" | "chat" | "full" — whether Engram itself runs a model, and whether it may write. */
    curator: curatorMode(),
    /** Kept for the Connect page: brain_capture is exposed only in "full". */
    harness: harnessEnabled(),
    mcpAuthRequired: MCP_TOKEN !== "" || hasAnyToken(),
    dashboardAuthRequired: !AUTH_DISABLED && AUTH_SECRET !== "",
  });
}

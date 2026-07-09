import { AUTH_DISABLED, AUTH_SECRET, MCP_TOKEN } from "@/lib/config";
import { appName, harnessEnabled } from "@/lib/settings";
import { hasAnyToken } from "@/lib/tokens";

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({
    appName: appName(),
    harness: harnessEnabled(),
    mcpAuthRequired: MCP_TOKEN !== "" || hasAnyToken(),
    dashboardAuthRequired: !AUTH_DISABLED && AUTH_SECRET !== "",
  });
}

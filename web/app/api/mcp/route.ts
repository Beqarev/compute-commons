import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { MCP_INSTRUCTIONS } from "@/lib/mcp/instructions";
import { registerTools } from "@/lib/mcp/tools";
import { verifyToken } from "@/lib/tokens";

const handler = createMcpHandler(registerTools, {
  serverInfo: { name: "commons", version: "0.1.0" },
  instructions: MCP_INSTRUCTIONS,
});

// Bearer token required (Authorization: Bearer cc_…). No token, or a revoked one, gets 401.
const authed = withMcpAuth(
  handler,
  async (_req, token) => {
    const caller = await verifyToken(token);
    if (!caller) return undefined;
    return { token: token!, clientId: caller.kind === "team" ? "team" : caller.memberId, scopes: [], extra: { caller } };
  },
  { required: true },
);

export { authed as GET, authed as POST, authed as DELETE };

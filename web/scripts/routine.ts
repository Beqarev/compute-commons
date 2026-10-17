// Runs a "Claude schedule" on this laptop: headless Claude Code, connected only to commons with the
// team token, given only the one-line setup prompt. Everything else comes from the MCP server.
// Like a cloud routine it can read the web (WebFetch/WebSearch) but has no shell or file access.
//   npm run routine            uses MCP_TOKEN_TEAM from .env.seed.local (npm run token -- team)
//   COMMONS_URL=https://…/api/mcp COMMONS_TEAM_TOKEN=cc_… npm run routine
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SETUP_PROMPT } from "../lib/mcp/instructions";

function teamToken(): string {
  if (process.env.COMMONS_TEAM_TOKEN) return process.env.COMMONS_TEAM_TOKEN;
  const file = ".env.seed.local";
  const line = existsSync(file) ? readFileSync(file, "utf8").split("\n").find((l) => l.startsWith("MCP_TOKEN_TEAM=")) : undefined;
  if (!line) throw new Error("No team token. Run: npm run token -- team");
  return line.slice("MCP_TOKEN_TEAM=".length).trim();
}

const url = process.env.COMMONS_URL ?? "http://localhost:3000/api/mcp";
const dir = mkdtempSync(join(tmpdir(), "commons-routine-"));
const config = join(dir, "mcp.json");
writeFileSync(config, JSON.stringify({ mcpServers: { commons: { type: "http", url, headers: { Authorization: `Bearer ${teamToken()}` } } } }), {
  mode: 0o600,
});

console.log(`▶ Schedule run against ${url}\n▶ Prompt: ${SETUP_PROMPT}\n`);
const claude = spawn(
  "claude",
  ["-p", SETUP_PROMPT, "--mcp-config", config, "--strict-mcp-config", "--allowedTools", "mcp__commons", "WebFetch", "WebSearch",
    "--disallowedTools", "Bash", "Write", "Edit", "NotebookEdit", "Read", "Glob", "Grep", "--output-format", "stream-json", "--verbose"],
  // An empty folder, like a fresh cloud workspace: no repo files or project instructions.
  { cwd: dir, stdio: ["ignore", "pipe", "inherit"] },
);

let buffer = "";
claude.stdout.on("data", (chunk: Buffer) => {
  buffer += chunk.toString();
  const lines = buffer.split("\n");
  buffer = lines.pop() ?? "";
  for (const line of lines) {
    let e: { type?: string; message?: { content?: { type: string; name?: string; input?: Record<string, unknown>; text?: string }[] }; subtype?: string; num_turns?: number; duration_ms?: number };
    try {
      e = JSON.parse(line);
    } catch {
      continue;
    }
    if (e.type === "assistant") {
      for (const c of e.message?.content ?? []) {
        if (c.type === "tool_use") {
          const args = { ...c.input };
          for (const k of ["summary", "details", "reason"]) if (typeof args[k] === "string") args[k] = (args[k] as string).slice(0, 80) + "…";
          console.log(`  → ${c.name?.replace("mcp__commons__", "")} ${JSON.stringify(args)}`);
        } else if (c.type === "text" && c.text?.trim()) {
          console.log(`\n${c.text.trim()}\n`);
        }
      }
    } else if (e.type === "result") {
      console.log(`▶ Finished (${e.subtype}) in ${Math.round((e.duration_ms ?? 0) / 1000)}s, ${e.num_turns} turns`);
    }
  }
});

claude.on("close", (code) => {
  rmSync(dir, { recursive: true, force: true });
  process.exit(code ?? 0);
});

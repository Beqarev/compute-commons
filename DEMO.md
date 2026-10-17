# Demo script (about 3 minutes)

## Before the demo (10 minutes ahead)

1. **Clean data:** `cd web && npm run seed -- --reset`. This removes test tasks and keeps users, settings and MCP tokens.
2. **Warm up the server:** open https://compute-commons-beqa.vercel.app/board once, because the first request after a quiet period is slow. Log in as **Beqa** (lead) from `web/.env.seed.local`.
3. **Session 1, Beqa's Claude Code, against the live URL:**
   ```bash
   cd ~/Desktop/hackathon/compute-commons-beqa
   claude mcp remove commons -s local
   claude mcp add -s local --transport http commons https://compute-commons-beqa.vercel.app/api/mcp --header "Authorization: Bearer <Beqa's token>"
   ```
   Create Beqa's token on the live **Connect Claude** page ("Acts as: Me"), or reuse `MCP_TOKEN_LEAD` from `.env.seed.local`.
4. **Session 2, Sam's Claude Code,** in a second folder so it gets its own connection:
   ```bash
   mkdir -p ~/Desktop/hackathon/sam-session && cd ~/Desktop/hackathon/sam-session
   claude mcp add -s local --transport http commons https://compute-commons-beqa.vercel.app/api/mcp --header "Authorization: Bearer <Sam's token>"
   ```
   Use `MCP_TOKEN_MEMBER`. Run `/mcp` in both sessions: each should show `commons · connected`.
5. **Routine:** the claude.ai `commons` connector uses the team token with tools set to *Always allow*, and the scheduled task "Test" has the one-line prompt.
6. **Pick 3 real sites** for the SEO audit (real pages give a full report; `example.*` domains give a partial one).

## The demo

| # | Do | Say |
|---|---|---|
| 1 | **Tasks → New task:** "SEO audit", prompt `Audit {{item}} for technical SEO… top 5 fixes`, 3 sites as items. Save, **Approve v1**, open **Board**. | "One prompt, three items. Each item is claimed on its own, and schedules only run approved versions." |
| 2 | Session 1: `take the next task from commons`. | The board shows **Beqa · until HH:MM**. "Claude asked the server for work and claimed site 1 with a lease." |
| 3 | Session 2, at the same time: `take the next task from commons`. | It gets **site 2**. "Collisions prevented" goes up if both went for site 1. "One item, one winner: we tested this against the real server with 10 claims at once." |
| 4 | Wait for session 1 to `complete`. | The board shows **Done** with a summary. Open **Logs** and expand the row for the full report. |
| 5 | In Claude, open the scheduled task and click **Run now**. | **Team schedule** takes site 3, completes it, finds the queue empty and stops. "The routine holds one line. The workflow, the task and the budget come from our server." |

## If something goes wrong

- **`commons` shows "failed" in Claude Code:** the URL or token is wrong. Run `/mcp`, then reconnect.
- **The routine says the queue is empty:** the task isn't approved, or every item is done. Click **Reset** on an item on the board.
- **The routine can't reach the cloud** (connector problem): run it from the laptop against the live server:
  `cd web && COMMONS_URL=https://compute-commons-beqa.vercel.app/api/mcp npm run routine`
- **Show an expired lease:** Settings → Lease = 1 minute, claim an item, wait a minute, and a second session takes it over.

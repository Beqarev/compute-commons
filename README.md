# Compute Commons

A team task queue for spare Claude capacity. A lead writes **tasks** (a prompt plus an optional list of items). Any Claude, whether a teammate's Claude Code or a scheduled Claude routine after hours, connects over MCP, **claims** one item so nobody doubles up, does the work, and reports **done / failed / skipped**. A live board shows what is free, who is on what, and what got done.

**Live:** https://compute-commons-beqa.vercel.app · **MCP endpoint:** `https://compute-commons-beqa.vercel.app/api/mcp`

## Run it locally

Needs Node 22+, and an Appwrite 1.8 project with an API key (Databases + Users scopes).

```bash
cd web
cp .env.example .env.local      # fill in APPWRITE_API_KEY (and project id if different)
npm install
npm run setup:appwrite          # creates database, tables, indexes (safe to re-run)
npm run seed                    # demo data + test logins in web/.env.seed.local
npm run dev                     # http://localhost:3000
```

Log in with `SEED_LEAD_EMAIL` / `SEED_LEAD_PASSWORD` from `web/.env.seed.local`.

| Command | What it does |
|---|---|
| `npm run seed -- --reset` | Wipes this build's rows and re-seeds. Users, settings and MCP tokens are kept. |
| `npm run token -- lead\|member\|team` | Creates an MCP token and saves it in `.env.seed.local` (never printed). |
| `npm run routine` | Runs a Claude schedule on this laptop: headless Claude Code, team token, the one-line prompt. Set `COMMONS_URL` to target the deployed app. |
| `npm test` | Unit tests, plus live race tests against Appwrite when `APPWRITE_API_KEY` is set. |

## Connect Claude

Open **Connect Claude** in the app. It creates a token and shows the exact command:

```bash
claude mcp add --transport http commons https://<app>/api/mcp --header "Authorization: Bearer <token>"
```

Then ask Claude Code: `take the next task from commons`.

**Claude routine (cloud):** in claude.ai → Settings → Connectors, add a custom connector with the URL above. Choose **Authentication: No sign-in** and add the request header `Authorization: Bearer <team token>`. Set its tools to *Always allow*. The routine's prompt is one line:

```
Use the "commons" MCP connector and work through our team's task queue.
```

The workflow (MCP `instructions`), the task itself (`get_task`) and the budget (`list_work`) all come from the server, so changing a task never needs a re-paste.

## How it works

```
Browser ──► Next.js on Vercel (pages, server actions) ──► Appwrite TablesDB (commons_beqa)
Claude Code / Claude routine ──► /api/mcp (8 tools, bearer token) ──┘
```

- **One concept: tasks.** A task is a prompt, one-off or routine (redo every N days), with an optional item list. Each line becomes a `task_items` row with its own claim. Prompt edits create immutable versions, and schedules only run the **approved** version.
- **Claiming without collisions** (`web/lib/claims.ts`). A claim is a `claims` row whose id is the item id, so Appwrite's 409 on a duplicate id means "taken". Expired leases are taken over through a **takeover ticket**: one row id per stale claim, so exactly one claimer may replace it. We tested Appwrite 1.8.1 transactions first: they let 2 of 5 parallel takeovers win, so they are only used for all-or-nothing writes in `finish` (see `spec/DECISIONS.md` D18).
- **The AI chooses, the server enforces.** `list_work` only offers eligible items. Schedules see approved tasks only and are held to the run budget in `claim`. Failed and skipped items wait for a lead to reset them (D19), so unattended runs never loop.
- **Everything is audited.** Task, settings and token changes, releases, resets, and every refused claim (the board's "collisions prevented").

### MCP tools

| Tool | Does |
|---|---|
| `list_work` | Eligible items, best first, plus this run's budget |
| `claim` | Atomic lock with a lease; "taken" if someone has it |
| `get_task` | Team policy + task prompt with `{{item}}` filled in |
| `heartbeat` | Extends the lease (holder only) |
| `complete` / `fail` | Writes the log, updates the item, frees the claim |
| `skip` | Logs why Claude chose not to take it |
| `board` | Counts, who is on what, recent results |

Every result is one plain-language line ("Claimed until 00:27. Now call get_task.") plus JSON.

## Tests

`web/lib/__tests__/`: claim eligibility, takeover ids, prompt building, item parsing, version diff, work ordering, token hashing, and **`claims.live.test.ts`**, which runs against the real server:

- 10 simultaneous claims → exactly 1 winner
- 5 simultaneous takeovers of an expired lease → exactly 1 winner
- a late claimer cannot steal a fresh claim
- only the holder can heartbeat or finish

## Deploy (Vercel)

Import the repo with **Root Directory `web`**. Set the env vars from `web/.env.example` (`APPWRITE_*`, `TEAM_ID`, `SESSION_COOKIE_NAME`, `APP_TIMEZONE`, and `APP_URL` = the deployment URL). No other services and no background jobs: lease expiry is checked when a claim is read, and Claude routines are the scheduler.

## Docs

`BRIEF.md` (goal, demo, roadmap) · `DEMO.md` (rehearsal script) · `spec/TECH.md` · `spec/DECISIONS.md`

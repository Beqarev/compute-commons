# Compute Commons — Beqa's build

> One of three separate builds of the same idea. Each teammate builds their own version in one day; then we compare and keep the best.
> Spec lives in `spec/` (copied from the shared repo on 2026-10-17). When the spec disagrees with itself, the newest wins: `spec/TECH.md` and `spec/DECISIONS.md` D16–D17 beat older wording in `spec/IDEA.md` (skills, targets, templates).

## The problem

Teams pay for AI subscriptions and leave part of them unused. Heavy, repeatable jobs (audits, reviews, reports, translations) compete with daytime work for the same limits, and everyone re-types the same prompts.

## The idea in one paragraph

A small web app plus a remote MCP server for a team. The lead writes **tasks**: a title, a prompt, and optionally a **list of items** (one line per site, repo, file, client…). A teammate's Claude Code, or a scheduled Claude routine after hours, connects to the MCP server and asks "what work is free?". It **claims** one item (with a lease, so nobody doubles up), gets the prompt, does the work, and reports **done / failed / skipped** with a summary. A **board** shows what is free, who is on what, and what got done. Spare capacity gets used, nobody repeats work, and good prompts live in one place.

## Words we use

| Word | Meaning |
|---|---|
| **Task** | A repeatable job: title, description, prompt (may contain `{{item}}`). One-off, or routine (redo every N days). Versioned; schedules only run an approved version. |
| **Item** | One line of a task's list, e.g. `https://site-a.ge`. Each item is claimed separately. A task with no list has one empty item. |
| **Claim** | A lock on an item with a lease (default 2 h). Heartbeat extends it; an expired lease frees the item. |
| **Log** | One row per attempt: who, when, outcome, summary, details (where the result is). |
| **Policy** | Team rules placed before every task prompt (how to deliver results, branching strategy for code teams, no secrets). |

## What the finished build has (the one-day MVP)

1. **Login** (Appwrite email + password, httpOnly session cookie) with roles **lead** and **member**.
2. **Tasks page**: create/edit a task, prompt textarea, item list, one-off or routine, version history, approve.
3. **Board**: every item as free / claimed by X until HH:MM / done / failed / skipped. Refreshes on its own.
4. **Logs page**: who did what, when, outcome, summary.
5. **MCP endpoint** at `/api/mcp` with 8 tools: `list_work`, `get_task`, `claim`, `heartbeat`, `complete`, `fail`, `skip`, `board`. Bearer-token auth; tokens created on a **Setup** page that also shows the `claude mcp add` command and the one-line routine prompt.
6. **Settings**: team policy text and run budget (max items, max minutes).
7. **Seed data** so the demo starts from a realistic state.

Out of scope today (roadmap slide only): GitHub sign-in, OAuth for connectors, clan mode, shared template library across teams, CodeMirror editor, Playwright tests.

## The demo (about 3 minutes)

1. **UI.** Log in as lead. Create the task "SEO audit" with 3 sites as items and approve it. Board shows 3 free items.
2. **MCP.** In Claude Code: "take the next task from commons". Claude claims site 1 → board shows *claimed by Beqa*.
3. **No collision.** A second Claude session asks for work at the same time and gets site 2, never site 1.
4. **Result.** Claude finishes and calls `complete` with a summary → board shows *done*, Logs shows the entry.
5. **Schedule.** Trigger the Claude routine by hand ("Use the commons MCP connector and work through our team's task queue"). It takes the remaining site within budget and stops.

## How we compare the three builds

Score each 1–5. Bring the running app and the demo, not slides.

| Criterion | What we look at |
|---|---|
| Demo works end to end | All 5 demo steps on the live app, no hand-waving. |
| No double work | Two simultaneous claims → exactly one wins. Expired lease frees the item. |
| MCP quality | Tools are clear to Claude; Claude picks, claims and reports without help. |
| UI clarity | A new person understands the board in 10 seconds. |
| Code quality | Small, readable, tests for claim logic and prompt building. |
| Deployability | Runs on Vercel (or one command locally) with only env vars. |

## Setup facts for this build

- Folder: `~/Desktop/hackathon/compute-commons-beqa` (own git repo).
- Appwrite: endpoint `https://api.rando.ge/v1`, project `hakatoni` (`6ad3926b000731cc9576`), server 1.8.1.
- **My database ID is `commons_beqa`** so my data never collides with my teammates' builds in the same Appwrite project.
- Secrets are in `.env.local` at the repo root (git-ignored). The app moves it into `web/` once scaffolded.

## Roadmap (not built today, on purpose)

Built and live: everything in "What the finished build has" above, deployed at https://compute-commons-beqa.vercel.app, with a real Claude routine running through the `commons` connector.

Next, in rough order of value:

1. **OAuth for the MCP endpoint.** Today the routine authenticates with a static `Authorization` header (a connector beta). OAuth (Better Auth MCP plugin or a hosted provider) would let each person sign in, and works for organizations without request headers.
2. **Members page.** Invite by email, change roles, remove. Today members come from the seed script.
3. **Realtime board.** Appwrite Realtime instead of 5-second polling.
4. **Board filters and quick add.** Filter by task or status, and a one-line "add task" bar for leads.
5. **Schedule targeting.** Tags, so two routines can work different parts of the queue.
6. **"Suggest a change" for members.** A note on a task that the lead can turn into a new version.
7. **More blanks than `{{item}}`.** Per-item fields, for example `{{url}}` and `{{owner}}`.
8. **Editor and tests.** A CodeMirror prompt editor, and Playwright end-to-end tests for the demo flow.
9. **Multiple teams.** Every row already carries `teamId`. Add team switching and per-team settings, including the timezone.
10. **Shared task library across teams, and clan mode** (see `spec/POSITIONING.md`).

Found while building (details in `spec/DECISIONS.md` D18–D19):
- Appwrite 1.8.1 transactions do not stop two claimers replacing the same expired claim. Takeover tickets do, and a live test proves it.
- Unattended runs must never ask questions: the MCP instructions now say to call `fail` instead. Failed and skipped items wait for a lead, so a schedule never loops on them.
- A routine's sandbox limits network access. Write task prompts so Claude can do them with web fetches, or say in the prompt what access the task needs.

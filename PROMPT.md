# Kickoff prompt

Open Claude Code in `~/Desktop/hackathon/compute-commons-beqa` and paste everything below the line.

---

We're at a hackathon. Three teammates each build their own version of the same product in one day, and then we compare them and keep the best one. This folder is my build.

Read `BRIEF.md`, then `CLAUDE.md`, then `spec/TECH.md` and `spec/DECISIONS.md` (D15–D17 matter most), then skim `spec/FEATURE-PLAN.md`. `spec/IDEA.md` is background only; its skills/targets/templates wording is outdated and replaced by "tasks with optional item lists".

**Don't write code yet.** First, plan the day with me:

1. In a few sentences, tell me back what we're building and what the 5-step demo in `BRIEF.md` shows, so I know we understand it the same way.
2. List anything in the spec that contradicts itself or is unclear for a one-day build, with your recommended answer for each.
3. Propose a build order as hour-sized steps for about 8 hours of work. Each step should end in something I can see or test (a page, a passing test, a working MCP call). Put the riskiest parts early: the Appwrite tables setup script, the claim logic with its race test against the real server, and the MCP endpoint connected to Claude Code.
4. Point out what we could cut if we fall behind, and what would make my build stand out against the other two (see "How we compare" in `BRIEF.md`).

Wait for my OK on the plan. Then build one step at a time: commit after each, and tell me what to look at before you move on.

Fixed facts:
- Stack: Next.js (App Router, TypeScript) in `web/`, Tailwind + shadcn/ui, Appwrite TablesDB on `https://api.rando.ge/v1` (server 1.8.1, `node-appwrite` pinned to 22.1.3), `mcp-handler` for the MCP route, zod, vitest.
- Credentials are already in `.env.local` at the repo root. Move it to `web/.env.local` after scaffolding. Never print the API key or commit it.
- My database is `commons_beqa`. Don't touch any other database in the Appwrite project, because my teammates use them.

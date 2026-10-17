# CLAUDE.md

Hackathon build of Compute Commons (team mode), one of three competing builds. Read `BRIEF.md` first.

## Sources of truth

- `BRIEF.md`: what we are building today, the demo, how builds are compared.
- `spec/TECH.md`: stack, pinned versions, data model, claim logic, MCP tools, pages, env vars.
- `spec/DECISIONS.md`: D16 (one concept: tasks with optional item lists) and D17 (no code-specific fields) override older wording.
- `spec/FEATURE-PLAN.md`: feature-by-feature plan with shared contracts.
- `spec/IDEA.md` is background; its "skills / targets / templates" wording is outdated.

## Rules

- Next.js app lives in `web/`. Secrets are in `/.env.local`; move it to `web/.env.local` after scaffolding. Never commit env files or print the API key.
- Use `APPWRITE_DATABASE_ID=commons_beqa`. Never create, change or delete anything in other databases of the Appwrite project: teammates use them.
- Pin `node-appwrite` to 22.1.3 (server is Appwrite 1.8.1). Use TablesDB.
- All Appwrite access is server-side with the API key, after a role check. The browser never talks to Appwrite.
- The claim rule is non-negotiable: claim = create a `claims` row whose id is the item id; 409 means taken. Cover it with a vitest test.
- One-day timebox: build the MVP in `BRIEF.md` only. Anything else goes on a "roadmap" list in `BRIEF.md`, not into code.
- Commit after each working feature with a short message. Run `npm run lint` and the tests before committing.
- Plan with the user before building a feature that the spec leaves open; otherwise act.

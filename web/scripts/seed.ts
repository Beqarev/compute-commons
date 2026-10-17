// Seeds a realistic starting state for the demo. Safe to run again: existing users and tasks are kept.
//   npm run seed            add what is missing
//   npm run seed -- --reset wipe every row in this build's database first (users are kept)
// Test logins are written to web/.env.seed.local (git-ignored), never printed.
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { ID, Query } from "node-appwrite";
import { DB_ID, T, TEAM_ID, adminTables, adminUsers, assertOwnDatabase } from "../lib/appwrite";
import { DEFAULT_POLICY } from "../lib/schema";
import { ensureItems, itemRowId } from "../lib/tasks";
import type { Outcome, Role } from "../lib/types";

const CREDS_FILE = ".env.seed.local";
const db = adminTables();
const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();

// ---- users ----------------------------------------------------------------------------------
// Appwrite users are shared by the whole project, so seed emails use this build's own domain.
const PEOPLE: { key: string; name: string; email: string; role: Role }[] = [
  { key: "LEAD", name: "Beqa", email: "lead@beqa.commons.test", role: "lead" },
  { key: "MEMBER", name: "Sam", email: "member@beqa.commons.test", role: "member" },
];

function loadPasswords(): Record<string, string> {
  const saved: Record<string, string> = {};
  if (existsSync(CREDS_FILE)) {
    for (const line of readFileSync(CREDS_FILE, "utf8").split("\n")) {
      const m = line.match(/^SEED_(\w+)_PASSWORD=(.+)$/);
      if (m) saved[m[1]] = m[2];
    }
  }
  let changed = false;
  for (const p of PEOPLE) {
    if (!saved[p.key]) {
      saved[p.key] = randomBytes(12).toString("base64url");
      changed = true;
    }
  }
  if (changed) {
    const lines = PEOPLE.flatMap((p) => [`SEED_${p.key}_EMAIL=${p.email}`, `SEED_${p.key}_PASSWORD=${saved[p.key]}`]);
    writeFileSync(CREDS_FILE, `# Test logins created by npm run seed. Git-ignored.\n${lines.join("\n")}\n`);
    console.log(`test logins written to web/${CREDS_FILE}`);
  }
  return saved;
}

async function ensurePeople(): Promise<Record<string, string>> {
  const passwords = loadPasswords();
  const users = adminUsers();
  const memberIds: Record<string, string> = {};
  for (const p of PEOPLE) {
    const found = await users.list({ queries: [Query.equal("email", [p.email])] });
    let userId = found.users[0]?.$id;
    if (userId) {
      await users.updatePassword({ userId, password: passwords[p.key] });
    } else {
      userId = (await users.create({ userId: ID.unique(), email: p.email, password: passwords[p.key], name: p.name })).$id;
      console.log(`user ${p.email}: created`);
    }
    // Member row id = Appwrite user id, so a session resolves to its member with one read.
    await db.upsertRow({
      databaseId: DB_ID,
      tableId: T.members,
      rowId: userId,
      data: { teamId: TEAM_ID, userId, name: p.name, email: p.email, role: p.role },
    });
    memberIds[p.key] = userId;
  }
  return memberIds;
}

// ---- tasks ----------------------------------------------------------------------------------
interface SeedTask {
  title: string;
  description: string;
  mode: "once" | "routine";
  redoDays: number;
  priority: number;
  items: string[];
  prompts: string[]; // one per version
  approved: number | null;
  history: { item: string; outcome: Outcome; by: "LEAD" | "MEMBER" | "team"; hoursAgo: number; summary: string; details?: string }[];
}

// Approved seed tasks have no free items left, and the draft has low priority, so the demo's
// new task is what Claude picks first.
const TASKS: SeedTask[] = [
  {
    title: "Weekly dependency check",
    description: "Look for outdated or vulnerable packages in each repo and open a report.",
    mode: "routine",
    redoDays: 7,
    priority: 1,
    items: ["rando-web", "rando-api"],
    prompts: [
      "Check the repository {{item}} for outdated or vulnerable dependencies.\n\nWrite a short report: what is outdated, what is risky, what you recommend upgrading first. Do not change any files.",
    ],
    approved: 1,
    history: [
      {
        item: "rando-web",
        outcome: "done",
        by: "team",
        hoursAgo: 40,
        summary: "3 outdated packages, no known vulnerabilities.",
        details: "next 16.3 → 16.4, zod 4.5 → 4.6, lucide-react minor. Report in #eng-reports.",
      },
      {
        item: "rando-api",
        outcome: "done",
        by: "LEAD",
        hoursAgo: 20,
        summary: "1 high-severity advisory in an image library; upgrade recommended.",
        details: "sharp has a patched release. Report in #eng-reports; ticket ENG-142 opened.",
      },
    ],
  },
  {
    title: "Translate release notes to Georgian",
    description: "Translate the latest release notes for the Georgian help center.",
    mode: "once",
    redoDays: 0,
    priority: 0,
    items: [],
    prompts: [
      "Translate the latest release notes into Georgian.",
      "Translate the latest release notes into Georgian. Keep product names in English. Put the translation in the help-center drafts folder.",
    ],
    approved: 2,
    history: [
      {
        item: "",
        outcome: "failed",
        by: "team",
        hoursAgo: 6,
        summary: "Could not find the latest release notes.",
        details: "The drafts folder has no notes for this month. A human needs to say which document to translate.",
      },
    ],
  },
  {
    title: "Summarize client feedback",
    description: "Turn raw feedback into three themes and one recommendation per client.",
    mode: "once",
    redoDays: 0,
    priority: -1,
    items: ["Client A: October survey", "Client B: support tickets"],
    prompts: ["Read the feedback for {{item}} and summarize it as three themes and one recommendation."],
    approved: null,
    history: [],
  },
];

async function seedTask(t: SeedTask, memberIds: Record<string, string>) {
  const existing = await db.listRows({
    databaseId: DB_ID,
    tableId: T.tasks,
    queries: [Query.equal("title", [t.title]), Query.limit(1)],
  });
  if (existing.total > 0) {
    console.log(`task "${t.title}": exists`);
    return;
  }

  const taskId = ID.unique();
  const lead = memberIds.LEAD;
  await db.createRow({
    databaseId: DB_ID,
    tableId: T.tasks,
    rowId: taskId,
    data: {
      teamId: TEAM_ID,
      title: t.title,
      description: t.description,
      mode: t.mode,
      redoDays: t.redoDays,
      items: t.items,
      priority: t.priority,
      currentVersion: t.prompts.length,
      approvedVersion: t.approved,
    },
  });
  for (const [i, prompt] of t.prompts.entries()) {
    await db.createRow({
      databaseId: DB_ID,
      tableId: T.taskVersions,
      rowId: ID.unique(),
      data: { taskId, version: i + 1, prompt, authorId: lead, createdAt: hoursAgo(72 - i * 24) },
    });
  }
  await ensureItems(taskId, t.items);

  const names: Record<string, string> = { LEAD: "Beqa", MEMBER: "Sam", team: "Team schedule" };
  for (const h of t.history) {
    const logId = ID.unique();
    const taskItemId = itemRowId(taskId, h.item);
    const finishedAt = hoursAgo(h.hoursAgo);
    await db.createRow({
      databaseId: DB_ID,
      tableId: T.logs,
      rowId: logId,
      data: {
        teamId: TEAM_ID,
        taskItemId,
        taskId,
        by: h.by === "team" ? "team" : memberIds[h.by],
        byName: names[h.by],
        outcome: h.outcome,
        summary: h.summary,
        details: h.details ?? null,
        version: t.approved ?? t.prompts.length,
        startedAt: hoursAgo(h.hoursAgo + 0.4),
        finishedAt,
      },
    });
    await db.updateRow({
      databaseId: DB_ID,
      tableId: T.taskItems,
      rowId: taskItemId,
      data: { status: h.outcome, lastLogId: logId, ...(h.outcome === "done" ? { lastDoneAt: finishedAt } : {}) },
    });
  }
  console.log(`task "${t.title}": created`);
}

// ---- reset ----------------------------------------------------------------------------------
async function wipe() {
  for (const tableId of Object.values(T)) {
    if (tableId === T.settings) continue;
    for (;;) {
      const { rows } = await db.listRows({ databaseId: DB_ID, tableId, queries: [Query.limit(100)] });
      if (!rows.length) break;
      await Promise.all(rows.map((r) => db.deleteRow({ databaseId: DB_ID, tableId, rowId: r.$id })));
    }
  }
  await db.updateRow({
    databaseId: DB_ID,
    tableId: T.settings,
    rowId: TEAM_ID,
    data: { policy: DEFAULT_POLICY, maxItemsPerRun: 5, maxMinutesPerRun: 90, leaseMinutes: 120 },
  });
  console.log(`wiped all rows in ${DB_ID}`);
}

async function main() {
  assertOwnDatabase();
  if (process.argv.includes("--reset")) await wipe();
  const memberIds = await ensurePeople();
  for (const t of TASKS) await seedTask(t, memberIds);
  console.log("seed done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

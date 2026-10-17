// The 8 MCP tools. Each result is one plain-language line (what happened, what to do next) plus JSON.
import { z } from "zod";
import { Query, type Models } from "node-appwrite";
import type { McpServer } from "@modelcontextprotocol/server";
import { DB_ID, T, adminTables } from "../appwrite";
import { ClaimError, claim, finish, getClaim, heartbeat, isActive, recordSkip } from "../claims";
import { audit } from "../audit";
import { formatLeft, formatTime } from "../format";
import { buildPrompt } from "../prompt";
import { getSettings } from "../settings";
import { callerId } from "../tokens";
import { listEligible, loadWork } from "../work";
import type { Caller, Log, Task, TaskItem, TaskVersion } from "../types";

type Row<X> = X & Models.Row;
type Ctx = { http?: { authInfo?: { extra?: Record<string, unknown> } } };

function reply(line: string, data?: unknown) {
  const text = data === undefined ? line : `${line}\n\n${JSON.stringify(data, null, 2)}`;
  return { content: [{ type: "text" as const, text }] };
}
function problem(line: string, data?: unknown) {
  return { ...reply(line, data), isError: true };
}

function callerOf(ctx: Ctx): Caller {
  const caller = ctx.http?.authInfo?.extra?.caller as Caller | undefined;
  if (!caller) throw new Error("Not authenticated");
  return caller;
}

const hhmm = (iso: string) => `${formatTime(iso)} (${formatLeft(iso)} from now)`;
const itemLabel = (item: string) => item || "(whole task)";

async function loadItem(itemId: string) {
  const db = adminTables();
  const item = await db.getRow<Row<TaskItem>>({ databaseId: DB_ID, tableId: T.taskItems, rowId: itemId }).catch(() => null);
  if (!item) return null;
  const task = await db.getRow<Row<Task>>({ databaseId: DB_ID, tableId: T.tasks, rowId: item.taskId });
  return { item, task };
}

/** Schedules run the approved version; people run the latest one. */
function versionFor(caller: Caller, task: Task): number | null {
  return caller.kind === "team" ? task.approvedVersion : task.currentVersion;
}

/** Hard budget for schedules: items started within the last maxMinutes. */
async function teamBudgetLeft(): Promise<{ left: number; maxItems: number; maxMinutes: number }> {
  const s = await getSettings();
  const since = new Date(Date.now() - s.maxMinutesPerRun * 60_000).toISOString();
  const db = adminTables();
  const [logs, claims] = await Promise.all([
    db.listRows({ databaseId: DB_ID, tableId: T.logs, queries: [Query.equal("by", ["team"]), Query.greaterThan("startedAt", since), Query.notEqual("outcome", ["skipped"]), Query.limit(100)] }),
    db.listRows({ databaseId: DB_ID, tableId: T.claims, queries: [Query.equal("by", ["team"]), Query.limit(100)] }),
  ]);
  const activeClaims = claims.rows.filter((c) => isActive(c as never, new Date())).length;
  return { left: Math.max(0, s.maxItemsPerRun - logs.total - activeClaims), maxItems: s.maxItemsPerRun, maxMinutes: s.maxMinutesPerRun };
}

const itemIdSchema = z.string().min(1).describe("The itemId from list_work.");

export function registerTools(server: McpServer) {
  server.registerTool(
    "list_work",
    {
      title: "List available work",
      description:
        "List the task items you may take right now, best first, with this run's budget. Start here, and call it again after finishing each item.",
      inputSchema: z.object({ limit: z.number().int().min(1).max(50).optional().describe("Max items to return (default 10).") }),
      annotations: { readOnlyHint: true },
    },
    async ({ limit }, ctx) => {
      const caller = callerOf(ctx as Ctx);
      const settings = await getSettings();
      const rows = await listEligible({ approvedOnly: caller.kind === "team", limit });
      const budget =
        caller.kind === "team"
          ? await teamBudgetLeft()
          : { left: null, maxItems: settings.maxItemsPerRun, maxMinutes: settings.maxMinutesPerRun };
      const items = rows.map((r, i) => ({
        order: i + 1,
        itemId: r.item.$id,
        task: r.task.title,
        item: itemLabel(r.item.item),
        description: r.task.description,
        mode: r.task.mode === "routine" ? `routine, every ${r.task.redoDays} days` : "one-off",
        lastRun: r.lastLog ? { outcome: r.lastLog.outcome, summary: r.lastLog.summary, at: r.lastLog.finishedAt } : null,
      }));
      if (caller.kind === "team" && budget.left === 0) {
        return reply("The budget for this run is used up. Stop now.", { budget, items: [] });
      }
      if (!items.length) return reply("No work is available right now. Stop.", { budget, items });
      return reply(`${items.length} item(s) available. Claim the first one with claim(itemId); if it is taken, try the next.`, {
        budget,
        items,
      });
    },
  );

  server.registerTool(
    "claim",
    {
      title: "Claim an item",
      description:
        "Lock one item for yourself before working on it. Exactly one caller can hold an item. Returns the lease end time, or 'taken' if someone else has it.",
      inputSchema: z.object({ itemId: itemIdSchema }),
    },
    async ({ itemId }, ctx) => {
      const caller = callerOf(ctx as Ctx);
      const found = await loadItem(itemId);
      if (!found) return problem("No item with this itemId. Call list_work for current ids.");
      if (caller.kind === "team") {
        if (found.task.approvedVersion == null) return problem("This task is not approved for schedules. Pick another item from list_work.");
        if ((await teamBudgetLeft()).left === 0) return problem("The budget for this run is used up. Stop now.");
      }
      const { by, byName } = callerId(caller);
      const r = await claim(itemId, by, byName);
      if (r.ok) {
        return reply(`Claimed "${found.task.title}: ${itemLabel(found.item.item)}" until ${hhmm(r.leaseUntil)}. Now call get_task(itemId).`, {
          itemId,
          leaseUntil: r.leaseUntil,
        });
      }
      if (r.reason === "taken") {
        // Counted on the board as "collisions prevented".
        await audit(by, "claim.taken", `item:${itemId}`, undefined, { heldBy: r.heldBy });
        return reply(`Taken: ${r.heldBy} is working on it. Do not work on this item; claim the next one from list_work.`, {
          itemId,
          taken: true,
          heldBy: r.heldBy,
          leaseUntil: r.leaseUntil,
        });
      }
      return reply("This item is no longer available (already done or waiting for a lead). Call list_work again.", { itemId, available: false });
    },
  );

  server.registerTool(
    "get_task",
    {
      title: "Get the instructions for an item",
      description:
        "Get the full instructions for a claimed item: the team policy plus the task prompt, with the item filled in. Follow them exactly.",
      inputSchema: z.object({ itemId: itemIdSchema }),
      annotations: { readOnlyHint: true },
    },
    async ({ itemId }, ctx) => {
      const caller = callerOf(ctx as Ctx);
      const found = await loadItem(itemId);
      if (!found) return problem("No item with this itemId. Call list_work for current ids.");
      const version = versionFor(caller, found.task);
      if (version == null) return problem("This task has no approved version, so schedules may not run it.");
      const db = adminTables();
      const [settings, versions, current] = await Promise.all([
        getSettings(),
        db.listRows<Row<TaskVersion>>({
          databaseId: DB_ID,
          tableId: T.taskVersions,
          queries: [Query.equal("taskId", [found.task.$id]), Query.equal("version", [version]), Query.limit(1)],
        }),
        getClaim(itemId),
      ]);
      const prompt = versions.rows[0]?.prompt;
      if (prompt == null) return problem("This task's prompt version is missing. Call fail with that reason.");
      const built = buildPrompt({ teamPolicy: settings.policy, taskPrompt: prompt, values: { item: found.item.item } });
      const holding = !!current && current.by === callerId(caller).by && isActive(current, new Date());
      const line = holding
        ? `Instructions for "${found.task.title}: ${itemLabel(found.item.item)}" (version ${version}). Do the work, then call complete, fail or skip.`
        : "You do not hold this item. Call claim(itemId) first and only work on it if the claim succeeds.";
      return reply(line, { itemId, task: found.task.title, item: found.item.item, version, holding, missingBlanks: built.missing, instructions: built.text });
    },
  );

  server.registerTool(
    "heartbeat",
    {
      title: "Extend your lease",
      description: "Keep your claim alive during long work. Call at least every 30 minutes.",
      inputSchema: z.object({ itemId: itemIdSchema }),
    },
    async ({ itemId }, ctx) => {
      const r = await heartbeat(itemId, callerId(callerOf(ctx as Ctx)).by);
      if (r.ok) return reply(`Lease extended until ${hhmm(r.leaseUntil)}. Keep working.`, { itemId, leaseUntil: r.leaseUntil });
      return problem(
        r.reason === "expired"
          ? "Your lease already ran out. Call claim(itemId) again; if it is taken, stop work on this item."
          : "You do not hold this item. Stop work on it and call list_work.",
      );
    },
  );

  const finishTool = (outcome: "done" | "failed") => async (itemId: string, summary: string, details: string | undefined, ctx: Ctx) => {
    const caller = callerOf(ctx);
    const found = await loadItem(itemId);
    if (!found) return problem("No item with this itemId.");
    try {
      const log = await finish(itemId, callerId(caller).by, outcome, {
        summary,
        details: details ?? null,
        version: versionFor(caller, found.task) ?? found.task.currentVersion,
      });
      return reply(
        `${outcome === "done" ? "Marked done" : "Marked failed"} and logged. Call list_work for the next item, or stop if the budget is used.`,
        { itemId, logId: log.$id, outcome },
      );
    } catch (e) {
      if (e instanceof ClaimError) return problem("You do not hold this item (never claimed, or the lease expired and someone took it over). Nothing was logged.");
      throw e;
    }
  };

  server.registerTool(
    "complete",
    {
      title: "Complete an item",
      description: "Report a claimed item as done. Frees the claim and writes the log the team reads.",
      inputSchema: z.object({
        itemId: itemIdSchema,
        summary: z.string().min(1).max(4000).describe("One or two sentences: the result."),
        details: z.string().max(20000).optional().describe("What you did, where the result is (link, file, branch…), anything a human should know."),
      }),
    },
    async ({ itemId, summary, details }, ctx) => finishTool("done")(itemId, summary, details, ctx as Ctx),
  );

  server.registerTool(
    "fail",
    {
      title: "Fail an item",
      description: "Report that a claimed item could not be done. It waits for a lead before anyone retries it.",
      inputSchema: z.object({
        itemId: itemIdSchema,
        reason: z.string().min(1).max(4000).describe("Why it failed, so a human can fix it."),
        details: z.string().max(20000).optional(),
      }),
    },
    async ({ itemId, reason, details }, ctx) => finishTool("failed")(itemId, reason, details, ctx as Ctx),
  );

  server.registerTool(
    "skip",
    {
      title: "Skip an item",
      description: "Decide not to take an item (unclear, unsafe, needs a human). Logged so the lead sees why. No claim needed.",
      inputSchema: z.object({ itemId: itemIdSchema, reason: z.string().min(1).max(4000) }),
    },
    async ({ itemId, reason }, ctx) => {
      const caller = callerOf(ctx as Ctx);
      const found = await loadItem(itemId);
      if (!found) return problem("No item with this itemId.");
      const { by, byName } = callerId(caller);
      try {
        const log: Log = await recordSkip(itemId, by, byName, reason, versionFor(caller, found.task) ?? found.task.currentVersion);
        return reply("Skipped and logged. Call list_work for the next item.", { itemId, logId: log.$id });
      } catch (e) {
        if (e instanceof ClaimError && e.reason === "taken") return problem("Someone else is working on this item; no need to skip it.");
        throw e;
      }
    },
  );

  server.registerTool(
    "board",
    {
      title: "Team board",
      description: "See who is working on what, what is free, and what finished recently.",
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true },
    },
    async () => {
      const now = new Date();
      const rows = await loadWork(now);
      const counts = { free: 0, inProgress: 0, done: 0, failed: 0, skipped: 0 };
      for (const r of rows) {
        if (r.claim) counts.inProgress++;
        else if (r.item.status === "available") counts.free++;
        else counts[r.item.status]++;
      }
      const inProgress = rows
        .filter((r) => r.claim)
        .map((r) => ({ task: r.task.title, item: itemLabel(r.item.item), by: r.claim!.byName, leaseUntil: r.claim!.leaseUntil }));
      const recent = rows
        .filter((r) => r.lastLog)
        .sort((a, b) => b.lastLog!.finishedAt.localeCompare(a.lastLog!.finishedAt))
        .slice(0, 5)
        .map((r) => ({ task: r.task.title, item: itemLabel(r.item.item), outcome: r.lastLog!.outcome, by: r.lastLog!.byName, summary: r.lastLog!.summary, at: r.lastLog!.finishedAt }));
      return reply(
        `${counts.free} free, ${counts.inProgress} in progress, ${counts.done} done, ${counts.failed} failed, ${counts.skipped} skipped.`,
        { counts, inProgress, recent },
      );
    },
  );
}

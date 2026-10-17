// Claiming without collisions (spec/TECH.md §4, revised after testing Appwrite 1.8.1).
//
// A claim is a `claims` row whose id is the task item id: Appwrite rejects a second create with
// 409, so exactly one claimer wins. Transactions on 1.8.1 do NOT stop two claimers replacing the
// same expired claim (tested), so takeovers use the same trick: each stale claim has one
// takeover ticket id, and only the claimer that creates the ticket may replace it.
import { createHash } from "node:crypto";
import { ID, type Models } from "node-appwrite";
import { DB_ID, T, TEAM_ID, adminTables } from "./appwrite";
import { getSettings } from "./settings";
import type { Claim, ItemStatus, Log, Task, TaskItem } from "./types";

type Row<X> = X & Models.Row;

const code = (e: unknown) => (e as { code?: number }).code;
const DAY_MS = 86_400_000;

export function isActive(claim: Pick<Claim, "leaseUntil"> | null, now: Date): boolean {
  return !!claim && new Date(claim.leaseUntil).getTime() > now.getTime();
}

/**
 * Can this item be offered and claimed right now? Failed and skipped items wait for a lead to
 * reset them, so an unattended run never loops on the same broken item.
 */
export function isEligible(item: TaskItem, claim: Claim | null, now: Date, redoDays: number): boolean {
  if (isActive(claim, now)) return false;
  switch (item.status) {
    case "available":
      return true;
    case "done":
      if (redoDays <= 0 || !item.lastDoneAt) return false;
      return now.getTime() - new Date(item.lastDoneAt).getTime() >= redoDays * DAY_MS;
    case "failed":
    case "skipped":
      return false;
  }
}

/** One ticket id per stale claim: a fresh claim on the same item hashes differently. */
export function takeoverId(stale: Pick<Claim, "$id" | "by" | "claimedAt">): string {
  return "x" + createHash("sha256").update(`${stale.$id}\u0000${stale.by}\u0000${stale.claimedAt}`).digest("hex").slice(0, 32);
}

async function getOrNull<X>(tableId: string, rowId: string): Promise<Row<X> | null> {
  try {
    return await adminTables().getRow<Row<X>>({ databaseId: DB_ID, tableId, rowId });
  } catch (e) {
    if (code(e) === 404) return null;
    throw e;
  }
}

/** Creates a row; false when the id is already taken (409). */
async function createUnique(tableId: string, rowId: string, data: Record<string, unknown>): Promise<boolean> {
  try {
    await adminTables().createRow({ databaseId: DB_ID, tableId, rowId, data });
    return true;
  } catch (e) {
    if (code(e) === 409) return false;
    throw e;
  }
}

export const getClaim = (itemId: string) => getOrNull<Claim>(T.claims, itemId);

export type ClaimResult =
  | { ok: true; leaseUntil: string; claimedAt: string }
  | { ok: false; reason: "taken"; heldBy: string; leaseUntil: string }
  | { ok: false; reason: "not-found" | "not-available" };

export async function claim(itemId: string, by: string, byName: string, leaseMinutes?: number): Promise<ClaimResult> {
  const item = await getOrNull<TaskItem>(T.taskItems, itemId);
  if (!item) return { ok: false, reason: "not-found" };
  const task = await getOrNull<Task>(T.tasks, item.taskId);
  if (!task) return { ok: false, reason: "not-found" };
  if (!isEligible(item, null, new Date(), task.redoDays)) return { ok: false, reason: "not-available" };

  const minutes = leaseMinutes ?? (await getSettings()).leaseMinutes;
  const now = new Date();
  const mine = {
    by,
    byName,
    claimedAt: now.toISOString(),
    leaseUntil: new Date(now.getTime() + minutes * 60_000).toISOString(),
  };
  const won = { ok: true as const, leaseUntil: mine.leaseUntil, claimedAt: mine.claimedAt };

  if (await createUnique(T.claims, itemId, mine)) return won;

  const current = await getClaim(itemId);
  if (!current) {
    // Released between our create and our read: one more try, same atomic rule.
    return (await createUnique(T.claims, itemId, mine)) ? won : taken(await getClaim(itemId));
  }
  if (isActive(current, now)) return taken(current);

  // Expired: race for this stale claim's single ticket.
  if (!(await createUnique(T.takeovers, takeoverId(current), { itemId, by, at: now.toISOString() }))) {
    return taken(await getClaim(itemId));
  }
  await adminTables()
    .deleteRow({ databaseId: DB_ID, tableId: T.claims, rowId: itemId })
    .catch((e) => {
      if (code(e) !== 404) throw e;
    });
  // Someone may have claimed in the gap with a plain create; then they hold it, not us.
  return (await createUnique(T.claims, itemId, mine)) ? won : taken(await getClaim(itemId));
}

function taken(c: Claim | null): ClaimResult {
  return { ok: false, reason: "taken", heldBy: c?.byName ?? "someone", leaseUntil: c?.leaseUntil ?? "" };
}

/** Extends the lease. Only the holder, and only while the lease is still running. */
export async function heartbeat(
  itemId: string,
  by: string,
  leaseMinutes?: number,
): Promise<{ ok: true; leaseUntil: string } | { ok: false; reason: "not-holder" | "expired" }> {
  const current = await getClaim(itemId);
  if (!current || current.by !== by) return { ok: false, reason: "not-holder" };
  if (!isActive(current, new Date())) return { ok: false, reason: "expired" };
  const minutes = leaseMinutes ?? (await getSettings()).leaseMinutes;
  const leaseUntil = new Date(Date.now() + minutes * 60_000).toISOString();
  await adminTables().updateRow({ databaseId: DB_ID, tableId: T.claims, rowId: itemId, data: { leaseUntil } });
  return { ok: true, leaseUntil };
}

export class ClaimError extends Error {
  constructor(public reason: "not-holder" | "taken" | "not-found") {
    super(reason);
  }
}

interface LogInput {
  itemId: string;
  taskId: string;
  by: string;
  byName: string;
  outcome: Log["outcome"];
  summary: string;
  details?: string | null;
  version: number;
  startedAt: string;
}

/** Log row + item status + claim removal, in one transaction (no contention here, just all-or-nothing). */
async function writeOutcome(l: LogInput, releaseClaim: boolean): Promise<Log> {
  const db = adminTables();
  const finishedAt = new Date().toISOString();
  const logId = ID.unique();
  const log = {
    teamId: TEAM_ID,
    taskItemId: l.itemId,
    taskId: l.taskId,
    by: l.by,
    byName: l.byName,
    outcome: l.outcome,
    summary: l.summary,
    details: l.details ?? null,
    version: l.version,
    startedAt: l.startedAt,
    finishedAt,
  };
  const status: ItemStatus = l.outcome;
  const { $id: transactionId } = await db.createTransaction({ ttl: 60 });
  try {
    await db.createRow({ databaseId: DB_ID, tableId: T.logs, rowId: logId, data: log, transactionId });
    await db.updateRow({
      databaseId: DB_ID,
      tableId: T.taskItems,
      rowId: l.itemId,
      data: { status, lastLogId: logId, ...(status === "done" ? { lastDoneAt: finishedAt } : {}) },
      transactionId,
    });
    if (releaseClaim) await db.deleteRow({ databaseId: DB_ID, tableId: T.claims, rowId: l.itemId, transactionId });
    await db.updateTransaction({ transactionId, commit: true });
  } catch (e) {
    await db.updateTransaction({ transactionId, rollback: true }).catch(() => {});
    throw e;
  }
  return { $id: logId, ...log };
}

/** Done or failed. Only the claim's holder can finish; startedAt is when they claimed. */
export async function finish(
  itemId: string,
  by: string,
  outcome: "done" | "failed",
  data: { summary: string; details?: string | null; version: number },
): Promise<Log> {
  const current = await getClaim(itemId);
  if (!current || current.by !== by) throw new ClaimError("not-holder");
  const item = await getOrNull<TaskItem>(T.taskItems, itemId);
  if (!item) throw new ClaimError("not-found");
  return writeOutcome(
    { itemId, taskId: item.taskId, by, byName: current.byName, outcome, ...data, startedAt: current.claimedAt },
    true,
  );
}

/** Claude decided not to take it. No claim needed, but someone else's active claim wins. */
export async function recordSkip(itemId: string, by: string, byName: string, reason: string, version: number): Promise<Log> {
  const item = await getOrNull<TaskItem>(T.taskItems, itemId);
  if (!item) throw new ClaimError("not-found");
  const current = await getClaim(itemId);
  if (current && current.by !== by && isActive(current, new Date())) throw new ClaimError("taken");
  return writeOutcome(
    {
      itemId,
      taskId: item.taskId,
      by,
      byName,
      outcome: "skipped",
      summary: reason,
      version,
      startedAt: current?.by === by ? current.claimedAt : new Date().toISOString(),
    },
    !!current,
  );
}

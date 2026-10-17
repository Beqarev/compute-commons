// The work queue: which task items exist, which are free, in what order. Shared by MCP and the board.
import { Query, type Models } from "node-appwrite";
import { DB_ID, T, TEAM_ID, adminTables } from "./appwrite";
import { isActive, isEligible } from "./claims";
import type { Claim, Log, Task, TaskItem } from "./types";

type Row<X> = X & Models.Row;

export interface WorkRow {
  item: TaskItem;
  task: Task;
  claim: Claim | null; // only active claims
  lastLog: Log | null;
}

/**
 * Task priority first (high to low), then the item done longest ago (never-done first),
 * then the item's position in the task's list.
 */
export function sortWork<
  R extends { task: Pick<Task, "priority"> & Partial<Pick<Task, "items">>; item: Pick<TaskItem, "lastDoneAt"> & Partial<Pick<TaskItem, "item">> },
>(rows: R[]): R[] {
  const time = (d: string | null) => (d ? new Date(d).getTime() : -Infinity);
  const pos = (r: R) => r.task.items?.indexOf(r.item.item ?? "") ?? 0;
  return [...rows].sort(
    (a, b) => b.task.priority - a.task.priority || time(a.item.lastDoneAt) - time(b.item.lastDoneAt) || pos(a) - pos(b),
  );
}

/** An item stays in the queue only while its line is still in the task's list. */
export function isListed(task: Pick<Task, "items">, item: Pick<TaskItem, "item">): boolean {
  return task.items.length ? task.items.includes(item.item) : item.item === "";
}

async function all<X>(tableId: string, queries: string[] = []): Promise<Row<X>[]> {
  const { rows } = await adminTables().listRows<Row<X>>({ databaseId: DB_ID, tableId, queries: [...queries, Query.limit(1000)] });
  return rows;
}

/** Every listed item with its task, active claim and last log. */
export async function loadWork(now = new Date()): Promise<WorkRow[]> {
  const [tasks, items, claims] = await Promise.all([
    all<Task>(T.tasks, [Query.equal("teamId", [TEAM_ID])]),
    all<TaskItem>(T.taskItems, [Query.equal("teamId", [TEAM_ID])]),
    all<Claim>(T.claims),
  ]);
  const taskById = new Map(tasks.map((t) => [t.$id, t]));
  const claimById = new Map(claims.filter((c) => isActive(c, now)).map((c) => [c.$id, c]));
  const logIds = items.map((i) => i.lastLogId).filter((x): x is string => !!x);
  const logs = logIds.length ? await all<Log>(T.logs, [Query.equal("$id", logIds)]) : [];
  const logById = new Map(logs.map((l) => [l.$id, l]));

  const rows: WorkRow[] = [];
  for (const item of items) {
    const task = taskById.get(item.taskId);
    if (!task || !isListed(task, item)) continue;
    rows.push({
      item,
      task,
      claim: claimById.get(item.$id) ?? null,
      lastLog: item.lastLogId ? (logById.get(item.lastLogId) ?? null) : null,
    });
  }
  return rows;
}

/** What a caller may take now. Schedules (approvedOnly) only see tasks with an approved version. */
export async function listEligible(opts: { approvedOnly: boolean; limit?: number }): Promise<WorkRow[]> {
  const now = new Date();
  const rows = (await loadWork(now)).filter(
    (r) => (!opts.approvedOnly || r.task.approvedVersion != null) && isEligible(r.item, r.claim, now, r.task.redoDays),
  );
  return sortWork(rows).slice(0, opts.limit ?? 10);
}

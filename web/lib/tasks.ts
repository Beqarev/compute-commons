import { createHash } from "node:crypto";
import { ID, Query, type Models } from "node-appwrite";
import { DB_ID, T, TEAM_ID, adminTables } from "./appwrite";
import type { Task, TaskMode, TaskVersion } from "./types";

type Row<X> = X & Models.Row;

export function nextVersion(current: number): number {
  return current + 1;
}

/** One item per line: trimmed, blanks and duplicates dropped, order kept. */
export function parseItems(text: string): string[] {
  const seen = new Set<string>();
  for (const line of text.split("\n")) {
    const item = line.trim();
    if (item) seen.add(item);
  }
  return [...seen];
}

/**
 * Task item row id, derived from task + item text. Creating the same item twice hits a 409
 * instead of making a duplicate, so saving a list again is safe. 33 chars (Appwrite max is 36).
 */
export function itemRowId(taskId: string, item: string): string {
  return "i" + createHash("sha256").update(`${taskId}\u0000${item}`).digest("hex").slice(0, 32);
}

/** Creates the missing task_items rows for a list ([] = one whole-task item). Returns rows created. */
export async function ensureItems(taskId: string, items: string[]): Promise<number> {
  const db = adminTables();
  const lines = items.length ? items : [""];
  const results = await Promise.all(
    lines.map((item) =>
      db
        .createRow({
          databaseId: DB_ID,
          tableId: T.taskItems,
          rowId: itemRowId(taskId, item),
          data: { teamId: TEAM_ID, taskId, item, status: "available", lastDoneAt: null, lastLogId: null },
        })
        .then(() => 1)
        .catch((e) => {
          if ((e as { code?: number }).code === 409) return 0;
          throw e;
        }),
    ),
  );
  return results.reduce<number>((a, b) => a + b, 0);
}

export async function getTask(id: string): Promise<Row<Task> | null> {
  return adminTables()
    .getRow<Row<Task>>({ databaseId: DB_ID, tableId: T.tasks, rowId: id })
    .then((t) => (t.teamId === TEAM_ID ? t : null))
    .catch(() => null);
}

export async function listTasks(): Promise<Row<Task>[]> {
  const { rows } = await adminTables().listRows<Row<Task>>({
    databaseId: DB_ID,
    tableId: T.tasks,
    queries: [Query.equal("teamId", [TEAM_ID]), Query.orderDesc("priority"), Query.orderDesc("$createdAt"), Query.limit(200)],
  });
  return rows;
}

/** Newest first. */
export async function listVersions(taskId: string): Promise<Row<TaskVersion>[]> {
  const { rows } = await adminTables().listRows<Row<TaskVersion>>({
    databaseId: DB_ID,
    tableId: T.taskVersions,
    queries: [Query.equal("taskId", [taskId]), Query.orderDesc("version"), Query.limit(100)],
  });
  return rows;
}

export interface TaskInput {
  title: string;
  description: string;
  prompt: string;
  mode: TaskMode;
  redoDays: number;
  items: string[];
  priority: number;
}

/**
 * Creates or updates a task. A changed prompt becomes a new immutable version; other fields
 * are edited in place. New list lines get task items; removed lines keep theirs (with logs)
 * but stop being offered.
 */
export async function saveTask(
  id: string | null,
  input: TaskInput,
  authorId: string,
): Promise<{ id: string; version: number; newVersion: boolean; before: Task | null }> {
  const db = adminTables();
  const fields = {
    title: input.title,
    description: input.description,
    mode: input.mode,
    redoDays: input.mode === "routine" ? input.redoDays : 0,
    items: input.items,
    priority: input.priority,
  };
  const [before, versions] = id ? await Promise.all([getTask(id), listVersions(id)]) : [null, []];
  if (id && !before) throw new Error("Task not found");

  const taskId = before?.$id ?? ID.unique();
  const latest = versions[0];
  const newVersion = !latest || latest.prompt !== input.prompt;
  const version = newVersion ? nextVersion(before?.currentVersion ?? 0) : before!.currentVersion;

  // The version row and items go first, so currentVersion never points at a missing version.
  await Promise.all([
    newVersion &&
      db.createRow({
        databaseId: DB_ID,
        tableId: T.taskVersions,
        rowId: ID.unique(),
        data: { taskId, version, prompt: input.prompt, authorId, createdAt: new Date().toISOString() },
      }),
    ensureItems(taskId, input.items),
  ]);
  if (before) {
    await db.updateRow({ databaseId: DB_ID, tableId: T.tasks, rowId: taskId, data: { ...fields, currentVersion: version } });
  } else {
    await db.createRow({
      databaseId: DB_ID,
      tableId: T.tasks,
      rowId: taskId,
      data: { ...fields, teamId: TEAM_ID, currentVersion: version, approvedVersion: null },
    });
  }
  return { id: taskId, version, newVersion, before };
}

/** Schedules only run approved versions. */
export async function approveVersion(taskId: string, version: number): Promise<void> {
  const task = await getTask(taskId);
  if (!task) throw new Error("Task not found");
  if (version < 1 || version > task.currentVersion) throw new Error("No such version");
  await adminTables().updateRow({ databaseId: DB_ID, tableId: T.tasks, rowId: taskId, data: { approvedVersion: version } });
}

import { createHash } from "node:crypto";
import { DB_ID, T, TEAM_ID, adminTables } from "./appwrite";

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

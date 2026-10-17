import { ID } from "node-appwrite";
import { DB_ID, T, TEAM_ID, adminTables } from "./appwrite";

const json = (v: unknown) => (v === undefined ? null : JSON.stringify(v).slice(0, 20000));

/** One audit row per change to tasks, settings, members and tokens. */
export async function audit(actor: string, action: string, entity: string, before?: unknown, after?: unknown) {
  await adminTables().createRow({
    databaseId: DB_ID,
    tableId: T.audit,
    rowId: ID.unique(),
    data: { teamId: TEAM_ID, actor, action, entity, before: json(before), after: json(after), at: new Date().toISOString() },
  });
}

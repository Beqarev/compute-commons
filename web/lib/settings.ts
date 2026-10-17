import type { Models } from "node-appwrite";
import { DB_ID, T, TEAM_ID, adminTables } from "./appwrite";
import type { Settings } from "./types";

export async function getSettings(): Promise<Settings> {
  return adminTables().getRow<Settings & Models.Row>({ databaseId: DB_ID, tableId: T.settings, rowId: TEAM_ID });
}

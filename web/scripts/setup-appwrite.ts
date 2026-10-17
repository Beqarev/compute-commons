// Creates the database, tables, columns, indexes and the settings row. Safe to run again:
// it only adds what is missing. Run: npm run setup:appwrite
import { IndexType, OrderBy, type TablesDB } from "node-appwrite";
import { DB_ID, TEAM_ID, adminTables, assertOwnDatabase } from "../lib/appwrite";
import { DEFAULT_POLICY, SCHEMA, type Column, type TableDef } from "../lib/schema";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const isNotFound = (e: unknown) => (e as { code?: number }).code === 404;

async function ensureDatabase(db: TablesDB) {
  try {
    await db.get({ databaseId: DB_ID });
    console.log(`database ${DB_ID}: exists`);
  } catch (e) {
    if (!isNotFound(e)) throw e;
    await db.create({ databaseId: DB_ID, name: DB_ID });
    console.log(`database ${DB_ID}: created`);
  }
}

async function createColumn(db: TablesDB, tableId: string, c: Column) {
  const base = { databaseId: DB_ID, tableId, key: c.key, required: c.required ?? false };
  switch (c.type) {
    case "string":
      return db.createStringColumn({ ...base, size: c.size, array: c.array ?? false });
    case "integer":
      return db.createIntegerColumn({ ...base, min: c.min, max: c.max });
    case "boolean":
      return db.createBooleanColumn(base);
    case "datetime":
      return db.createDatetimeColumn(base);
    case "enum":
      return db.createEnumColumn({ ...base, elements: c.elements });
  }
}

/** Columns are created asynchronously; indexes need them to be "available". */
async function waitForColumns(db: TablesDB, tableId: string) {
  for (let i = 0; i < 60; i++) {
    const { columns } = await db.listColumns({ databaseId: DB_ID, tableId });
    const states = (columns as { key: string; status: string; error?: string }[]).map((c) => c);
    const failed = states.find((c) => c.status === "failed");
    if (failed) throw new Error(`${tableId}.${failed.key} failed: ${failed.error}`);
    if (states.every((c) => c.status === "available")) return;
    await sleep(500);
  }
  throw new Error(`${tableId}: columns not ready after 30s`);
}

async function ensureTable(db: TablesDB, def: TableDef) {
  try {
    await db.getTable({ databaseId: DB_ID, tableId: def.id });
  } catch (e) {
    if (!isNotFound(e)) throw e;
    // No client permissions: only the server (API key) reads and writes.
    await db.createTable({ databaseId: DB_ID, tableId: def.id, name: def.name, permissions: [], rowSecurity: false });
    console.log(`table ${def.id}: created`);
  }

  const { columns } = await db.listColumns({ databaseId: DB_ID, tableId: def.id });
  const have = new Set((columns as { key: string }[]).map((c) => c.key));
  for (const c of def.columns.filter((c) => !have.has(c.key))) {
    await createColumn(db, def.id, c);
    console.log(`  column ${def.id}.${c.key}: created`);
  }
  await waitForColumns(db, def.id);

  const { indexes } = await db.listIndexes({ databaseId: DB_ID, tableId: def.id });
  const haveIdx = new Set(indexes.map((i) => i.key));
  for (const idx of def.indexes.filter((i) => !haveIdx.has(i.key))) {
    await db.createIndex({
      databaseId: DB_ID,
      tableId: def.id,
      key: idx.key,
      type: idx.type === "unique" ? IndexType.Unique : IndexType.Key,
      columns: idx.columns,
      orders: idx.orders?.map((o) => (o === "ASC" ? OrderBy.Asc : OrderBy.Desc)),
    });
    console.log(`  index ${def.id}.${idx.key}: created`);
  }
}

async function ensureSettings(db: TablesDB) {
  try {
    await db.getRow({ databaseId: DB_ID, tableId: "settings", rowId: TEAM_ID });
    console.log(`settings ${TEAM_ID}: exists`);
  } catch (e) {
    if (!isNotFound(e)) throw e;
    await db.createRow({
      databaseId: DB_ID,
      tableId: "settings",
      rowId: TEAM_ID,
      data: { teamId: TEAM_ID, policy: DEFAULT_POLICY, maxItemsPerRun: 5, maxMinutesPerRun: 90, leaseMinutes: 120 },
    });
    console.log(`settings ${TEAM_ID}: created`);
  }
}

async function main() {
  assertOwnDatabase();
  const db = adminTables();
  await ensureDatabase(db);
  for (const def of SCHEMA) await ensureTable(db, def);
  await ensureSettings(db);
  console.log("setup done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

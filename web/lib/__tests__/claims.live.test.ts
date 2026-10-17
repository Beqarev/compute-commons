// Race tests against the real Appwrite server (commons_beqa). Skipped without APPWRITE_API_KEY.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Query } from "node-appwrite";
import { DB_ID, T, TEAM_ID, adminTables, assertOwnDatabase } from "../appwrite";
import { ClaimError, claim, finish, getClaim, heartbeat, recordSkip } from "../claims";
import { itemRowId } from "../tasks";

const live = !!process.env.APPWRITE_API_KEY;
const TASK_ID = `zz_race_${Date.now()}`;
const ITEM = itemRowId(TASK_ID, "https://race.test");
const ITEM2 = itemRowId(TASK_ID, "https://skip.test");

const db = () => adminTables();
const ids = (n: number, p: string) => Array.from({ length: n }, (_, i) => `${p}${i + 1}`);

async function expireClaim(itemId: string) {
  const past = new Date(Date.now() - 60_000).toISOString();
  await db().updateRow({ databaseId: DB_ID, tableId: T.claims, rowId: itemId, data: { leaseUntil: past } });
}

describe.skipIf(!live)("claims against the live server", () => {
  beforeAll(async () => {
    assertOwnDatabase();
    await db().createRow({
      databaseId: DB_ID,
      tableId: T.tasks,
      rowId: TASK_ID,
      data: { teamId: TEAM_ID, title: "race test", description: "", mode: "once", redoDays: 0, items: [], priority: 0, currentVersion: 1, approvedVersion: 1 },
    });
    for (const [rowId, item] of [[ITEM, "https://race.test"], [ITEM2, "https://skip.test"]]) {
      await db().createRow({
        databaseId: DB_ID,
        tableId: T.taskItems,
        rowId,
        data: { teamId: TEAM_ID, taskId: TASK_ID, item, status: "available", lastDoneAt: null, lastLogId: null },
      });
    }
  });

  afterAll(async () => {
    const del = (tableId: string, rowId: string) => db().deleteRow({ databaseId: DB_ID, tableId, rowId }).catch(() => {});
    for (const itemId of [ITEM, ITEM2]) {
      await del(T.claims, itemId);
      const tickets = await db().listRows({ databaseId: DB_ID, tableId: T.takeovers, queries: [Query.equal("itemId", [itemId])] });
      await Promise.all(tickets.rows.map((r) => del(T.takeovers, r.$id)));
      await del(T.taskItems, itemId);
    }
    const logs = await db().listRows({ databaseId: DB_ID, tableId: T.logs, queries: [Query.equal("taskId", [TASK_ID])] });
    await Promise.all(logs.rows.map((r) => del(T.logs, r.$id)));
    await del(T.tasks, TASK_ID);
  });

  it("10 simultaneous claims: exactly one wins", async () => {
    const results = await Promise.all(ids(10, "a").map((by) => claim(ITEM, by, by, 60)));
    const winners = results.filter((r) => r.ok);
    expect(winners).toHaveLength(1);
    expect(results.filter((r) => !r.ok && r.reason === "taken")).toHaveLength(9);
  });

  it("5 simultaneous takeovers of an expired lease: exactly one wins and holds it", async () => {
    await expireClaim(ITEM);
    const callers = ids(5, "b");
    const results = await Promise.all(callers.map((by) => claim(ITEM, by, by, 60)));
    const winnerIdx = results.findIndex((r) => r.ok);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect((await getClaim(ITEM))?.by).toBe(callers[winnerIdx]);
  });

  it("a late claimer cannot steal a fresh claim", async () => {
    const holder = (await getClaim(ITEM))!.by;
    const late = await claim(ITEM, "late", "late", 60);
    expect(late).toMatchObject({ ok: false, reason: "taken", heldBy: holder });
    expect((await getClaim(ITEM))?.by).toBe(holder);
  });

  it("only the holder can heartbeat and finish; then the one-off item is no longer claimable", async () => {
    const holder = (await getClaim(ITEM))!.by;
    expect(await heartbeat(ITEM, "intruder")).toEqual({ ok: false, reason: "not-holder" });
    expect((await heartbeat(ITEM, holder, 90)).ok).toBe(true);
    await expect(finish(ITEM, "intruder", "done", { summary: "x", version: 1 })).rejects.toBeInstanceOf(ClaimError);

    const log = await finish(ITEM, holder, "done", { summary: "Audit written", details: "doc link", version: 1 });
    expect(log.outcome).toBe("done");
    expect(await getClaim(ITEM)).toBeNull();
    const row = await db().getRow({ databaseId: DB_ID, tableId: T.taskItems, rowId: ITEM });
    expect(row.status).toBe("done");
    expect(row.lastLogId).toBe(log.$id);
    expect(await claim(ITEM, "again", "again", 60)).toEqual({ ok: false, reason: "not-available" });
  });

  it("skip is refused while someone else holds the item, and logged otherwise", async () => {
    expect((await claim(ITEM2, "holder", "holder", 60)).ok).toBe(true);
    await expect(recordSkip(ITEM2, "other", "other", "not for me", 1)).rejects.toMatchObject({ reason: "taken" });
    const log = await recordSkip(ITEM2, "holder", "holder", "needs a human", 1);
    expect(log.outcome).toBe("skipped");
    expect(await getClaim(ITEM2)).toBeNull();
  });
});

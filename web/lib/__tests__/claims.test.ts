import { describe, it, expect } from "vitest";
import { isEligible, takeoverId } from "../claims";
import type { TaskItem, Claim } from "../types";

const item = (o: Partial<TaskItem> = {}): TaskItem => ({
  $id: "i1",
  teamId: "t",
  taskId: "k1",
  item: "https://a.ge",
  status: "available",
  lastDoneAt: null,
  lastLogId: null,
  ...o,
});
const claim = (o: Partial<Claim> = {}): Claim => ({
  $id: "i1",
  by: "m1",
  byName: "Beqa",
  claimedAt: "2026-10-20T11:00:00Z",
  leaseUntil: "2026-10-20T13:00:00Z",
  ...o,
});
const now = new Date("2026-10-20T12:00:00Z");

describe("isEligible", () => {
  it("free item is eligible", () => expect(isEligible(item(), null, now, 0)).toBe(true));
  it("active claim blocks", () => expect(isEligible(item(), claim(), now, 0)).toBe(false));
  it("expired claim does not block", () => {
    expect(isEligible(item(), claim({ claimedAt: "2026-10-20T08:00:00Z", leaseUntil: "2026-10-20T10:00:00Z" }), now, 0)).toBe(true);
  });
  it("one-off is done once", () => {
    expect(isEligible(item({ status: "done", lastDoneAt: "2026-01-01T00:00:00Z" }), null, now, 0)).toBe(false);
  });
  it("failed and skipped items wait for a lead to reset them", () => {
    expect(isEligible(item({ status: "failed" }), null, now, 0)).toBe(false);
    expect(isEligible(item({ status: "skipped" }), null, now, 7)).toBe(false);
  });
  it("routine comes back after redoDays", () => {
    expect(isEligible(item({ status: "done", lastDoneAt: "2026-10-18T12:00:00Z" }), null, now, 7)).toBe(false);
    expect(isEligible(item({ status: "done", lastDoneAt: "2026-10-01T12:00:00Z" }), null, now, 7)).toBe(true);
  });
});

describe("takeoverId", () => {
  it("is one id per stale claim, and differs for the next claim on the same item", () => {
    const stale = claim();
    expect(takeoverId(stale)).toBe(takeoverId({ ...stale }));
    expect(takeoverId(stale)).not.toBe(takeoverId(claim({ by: "m2", claimedAt: "2026-10-20T11:30:00Z" })));
    expect(takeoverId(stale)).toMatch(/^x[0-9a-f]{32}$/);
  });
});

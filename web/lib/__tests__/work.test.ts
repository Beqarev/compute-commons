import { describe, it, expect } from "vitest";
import { isListed, sortWork } from "../work";
import { hashToken, newTokenString } from "../tokens";

describe("work queue", () => {
  it("sorts by task priority then oldest done, never-done first", () => {
    const rows = [
      { task: { priority: 0 }, item: { $id: "a", lastDoneAt: "2026-10-10T00:00:00Z" } },
      { task: { priority: 0 }, item: { $id: "b", lastDoneAt: null } },
      { task: { priority: 5 }, item: { $id: "c", lastDoneAt: "2026-10-15T00:00:00Z" } },
    ];
    expect(sortWork(rows).map((r) => r.item.$id)).toEqual(["c", "b", "a"]);
  });
  it("keeps list order when everything else ties", () => {
    const task = { priority: 0, items: ["site-1", "site-2", "site-3"] };
    const rows = ["site-3", "site-1", "site-2"].map((item) => ({ task, item: { item, lastDoneAt: null } }));
    expect(sortWork(rows).map((r) => r.item.item)).toEqual(["site-1", "site-2", "site-3"]);
  });
  it("offers only lines still in the task's list", () => {
    expect(isListed({ items: ["a", "b"] }, { item: "a" })).toBe(true);
    expect(isListed({ items: ["b"] }, { item: "a" })).toBe(false);
    expect(isListed({ items: [] }, { item: "" })).toBe(true);
  });
});

describe("tokens", () => {
  it("creates prefixed tokens and stable hashes", () => {
    const t = newTokenString();
    expect(t.startsWith("cc_")).toBe(true);
    expect(hashToken(t)).toBe(hashToken(t));
    expect(hashToken(t)).not.toBe(t);
    expect(newTokenString()).not.toBe(t);
  });
});

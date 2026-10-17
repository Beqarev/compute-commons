import { describe, it, expect } from "vitest";
import { itemRowId, nextVersion, parseItems } from "../tasks";

describe("tasks", () => {
  it("increments versions from 0", () => {
    expect(nextVersion(0)).toBe(1);
    expect(nextVersion(4)).toBe(5);
  });
  it("parses an item list: trims, skips blanks and duplicates", () => {
    expect(parseItems(" https://a.ge \n\nhttps://b.ge\nhttps://a.ge")).toEqual(["https://a.ge", "https://b.ge"]);
  });
  it("derives a stable, valid row id per task item", () => {
    const id = itemRowId("task1", "https://a.ge");
    expect(id).toBe(itemRowId("task1", "https://a.ge"));
    expect(id).not.toBe(itemRowId("task2", "https://a.ge"));
    expect(id).toMatch(/^[a-z0-9]{1,36}$/);
  });
});

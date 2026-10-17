import { it, expect } from "vitest";
import { T } from "../appwrite";

it("names every table", () => {
  expect(Object.keys(T)).toHaveLength(9);
  expect(T.claims).toBe("claims");
});

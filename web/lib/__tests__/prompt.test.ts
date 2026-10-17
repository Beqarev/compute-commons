import { describe, it, expect } from "vitest";
import { fillBlanks, buildPrompt } from "../prompt";

describe("prompt", () => {
  it("fills known blanks and reports missing ones", () => {
    expect(fillBlanks("Audit {{ item }} for {{goal}}", { item: "https://a.ge" })).toEqual({
      text: "Audit https://a.ge for {{goal}}",
      missing: ["goal"],
    });
  });
  it("fills every occurrence and does not re-expand values", () => {
    expect(fillBlanks("{{item}} and {{item}}", { item: "{{x}}" }).text).toBe("{{x}} and {{x}}");
  });
  it("puts the policy first and skips an empty policy", () => {
    expect(buildPrompt({ teamPolicy: "P", taskPrompt: "S {{item}}", values: { item: "1" } }).text).toBe("P\n\n---\n\nS 1");
    expect(buildPrompt({ teamPolicy: "", taskPrompt: "S", values: {} }).text).toBe("S");
  });
});

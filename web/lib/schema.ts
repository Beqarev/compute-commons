// Table definitions applied by scripts/setup-appwrite.ts. Keep in step with lib/types.ts.

export type Column =
  | { key: string; type: "string"; size: number; required?: boolean; array?: boolean }
  | { key: string; type: "integer"; required?: boolean; min?: number; max?: number }
  | { key: string; type: "boolean"; required?: boolean }
  | { key: string; type: "datetime"; required?: boolean }
  | { key: string; type: "enum"; elements: string[]; required?: boolean };

export interface Index {
  key: string;
  type: "key" | "unique";
  columns: string[];
  orders?: ("ASC" | "DESC")[];
}

export interface TableDef {
  id: string;
  name: string;
  columns: Column[];
  indexes: Index[];
}

const id = (key: string, required = true): Column => ({ key, type: "string", size: 64, required });
const text = (key: string, size: number, required = false): Column => ({ key, type: "string", size, required });
const int = (key: string, required = true): Column => ({ key, type: "integer", required });
const date = (key: string, required = true): Column => ({ key, type: "datetime", required });

export const SCHEMA: TableDef[] = [
  {
    id: "members",
    name: "Members",
    columns: [
      id("teamId"),
      id("userId"),
      text("name", 128, true),
      text("email", 320, true),
      { key: "role", type: "enum", elements: ["lead", "member"], required: true },
    ],
    indexes: [{ key: "team_user", type: "unique", columns: ["teamId", "userId"] }],
  },
  {
    id: "tasks",
    name: "Tasks",
    columns: [
      id("teamId"),
      text("title", 256, true),
      text("description", 4000),
      { key: "mode", type: "enum", elements: ["once", "routine"], required: true },
      int("redoDays"),
      { key: "items", type: "string", size: 1024, array: true },
      int("priority"),
      int("currentVersion"),
      int("approvedVersion", false),
    ],
    indexes: [{ key: "team", type: "key", columns: ["teamId"] }],
  },
  {
    id: "task_versions",
    name: "Task versions",
    columns: [id("taskId"), int("version"), text("prompt", 100000, true), id("authorId"), date("createdAt")],
    indexes: [{ key: "task_version", type: "unique", columns: ["taskId", "version"] }],
  },
  {
    id: "task_items",
    name: "Task items",
    columns: [
      id("teamId"),
      id("taskId"),
      text("item", 1024),
      { key: "status", type: "enum", elements: ["available", "done", "failed", "skipped"], required: true },
      date("lastDoneAt", false),
      id("lastLogId", false),
    ],
    indexes: [
      { key: "task", type: "key", columns: ["taskId"] },
      { key: "status", type: "key", columns: ["status"] },
    ],
  },
  {
    id: "claims",
    name: "Claims",
    columns: [id("by"), text("byName", 128, true), date("claimedAt"), date("leaseUntil")],
    indexes: [],
  },
  {
    // Takeover tickets: row id = hash of one stale claim, so only one claimer can replace it.
    // Never deleted, or a late racer could reuse an old ticket. See lib/claims.ts.
    id: "claim_takeovers",
    name: "Claim takeovers",
    columns: [id("itemId"), id("by"), date("at")],
    indexes: [],
  },
  {
    id: "logs",
    name: "Logs",
    columns: [
      id("teamId"),
      id("taskItemId"),
      id("taskId"),
      id("by"),
      text("byName", 128, true),
      { key: "outcome", type: "enum", elements: ["done", "failed", "skipped"], required: true },
      text("summary", 4000, true),
      text("details", 20000),
      int("version"),
      date("startedAt"),
      date("finishedAt"),
    ],
    indexes: [
      { key: "item", type: "key", columns: ["taskItemId"] },
      { key: "task", type: "key", columns: ["taskId"] },
      { key: "finished", type: "key", columns: ["finishedAt"], orders: ["DESC"] },
    ],
  },
  {
    id: "settings",
    name: "Settings",
    columns: [
      id("teamId"),
      text("policy", 20000),
      int("maxItemsPerRun"),
      int("maxMinutesPerRun"),
      int("leaseMinutes"),
    ],
    indexes: [],
  },
  {
    id: "api_tokens",
    name: "API tokens",
    columns: [
      id("owner"),
      text("name", 128, true),
      id("tokenHash"),
      date("lastUsedAt", false),
      { key: "revoked", type: "boolean", required: true },
    ],
    indexes: [{ key: "hash", type: "unique", columns: ["tokenHash"] }],
  },
  {
    id: "audit_log",
    name: "Audit log",
    columns: [
      id("teamId"),
      id("actor"),
      text("action", 64, true),
      text("entity", 128, true),
      text("before", 20000),
      text("after", 20000),
      date("at"),
    ],
    indexes: [{ key: "at", type: "key", columns: ["at"], orders: ["DESC"] }],
  },
];

export const DEFAULT_POLICY = `Rules for every task:
- Use no secrets and do not touch anything the task does not ask for.
- If the task is unclear or needs a human decision, stop and call fail with the reason.
- Finish by calling complete with a short summary and details (what you did, where the result is, anything a human should know).`;

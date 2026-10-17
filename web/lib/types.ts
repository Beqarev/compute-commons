// Shared contracts (spec/FEATURE-PLAN.md §3.1). Additions: byName on claims/logs for display,
// leaseMinutes in settings so the demo can show an expiring lease.

export type Role = "lead" | "member";
export type TaskMode = "once" | "routine";
export type ItemStatus = "available" | "done" | "failed" | "skipped";
export type Outcome = "done" | "failed" | "skipped";

export type Caller =
  | { kind: "member"; memberId: string; name: string; role: Role }
  | { kind: "team" }; // a Claude schedule's token: takes approved tasks only

export interface Member {
  $id: string;
  teamId: string;
  userId: string;
  name: string;
  email: string;
  role: Role;
}

export interface Task {
  $id: string;
  teamId: string;
  title: string;
  description: string;
  mode: TaskMode;
  redoDays: number; // routine: comes back after redoDays; once: 0
  items: string[]; // the active list; [] = the task is a single item
  priority: number;
  currentVersion: number;
  approvedVersion: number | null;
}

export interface TaskVersion {
  $id: string;
  taskId: string;
  version: number;
  prompt: string; // markdown, may use {{item}}
  authorId: string;
  createdAt: string;
}

export interface TaskItem {
  $id: string; // deterministic, see itemRowId()
  teamId: string;
  taskId: string;
  item: string; // "" when the task has no list
  status: ItemStatus;
  lastDoneAt: string | null;
  lastLogId: string | null;
}

export interface Claim {
  $id: string; // = task item id: the lock
  by: string; // memberId or "team"
  byName: string;
  claimedAt: string;
  leaseUntil: string;
}

export interface Log {
  $id: string;
  teamId: string;
  taskItemId: string;
  taskId: string;
  by: string;
  byName: string;
  outcome: Outcome;
  summary: string;
  details: string | null; // free text: what was done, where the result is
  version: number;
  startedAt: string;
  finishedAt: string;
}

export interface Settings {
  $id: string;
  teamId: string;
  policy: string;
  maxItemsPerRun: number;
  maxMinutesPerRun: number;
  leaseMinutes: number;
}

export interface ApiToken {
  $id: string;
  owner: string; // memberId or "team"
  name: string;
  tokenHash: string;
  lastUsedAt: string | null;
  revoked: boolean;
}

export interface AuditEntry {
  $id: string;
  teamId: string;
  actor: string;
  action: string;
  entity: string;
  before: string | null;
  after: string | null;
  at: string;
}

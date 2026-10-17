import { Badge } from "@/components/ui/badge";
import type { Task } from "@/lib/types";

export const PRIORITIES = [
  { value: 1, label: "High" },
  { value: 0, label: "Normal" },
  { value: -1, label: "Low" },
];

export function ModeBadge({ task }: { task: Pick<Task, "mode" | "redoDays"> }) {
  return <Badge variant="outline">{task.mode === "routine" ? `Every ${task.redoDays} days` : "One-off"}</Badge>;
}

/** Schedules only run approved versions, so "draft" is what a lead most needs to see. */
export function ApprovalBadge({ task }: { task: Pick<Task, "currentVersion" | "approvedVersion"> }) {
  if (task.approvedVersion == null) return <Badge variant="secondary">Draft: not approved</Badge>;
  if (task.approvedVersion < task.currentVersion)
    return <Badge variant="secondary">v{task.currentVersion} draft · v{task.approvedVersion} approved</Badge>;
  return <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">Approved v{task.approvedVersion}</Badge>;
}

export function PriorityBadge({ priority }: { priority: number }) {
  if (priority === 0) return null;
  return <Badge variant={priority > 0 ? "default" : "outline"}>{priority > 0 ? "High" : "Low"} priority</Badge>;
}

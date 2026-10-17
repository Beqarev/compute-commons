import { cn } from "@/lib/utils";
import { formatLeft, formatTime, formatWhen } from "@/lib/format";
import type { Claim, TaskItem } from "@/lib/types";

const STYLES = {
  free: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  claimed: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300",
  done: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  failed: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  skipped: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
};

export type BoardState = keyof typeof STYLES;

export function boardState(item: Pick<TaskItem, "status">, claim: Claim | null): BoardState {
  if (claim) return "claimed";
  return item.status === "available" ? "free" : item.status;
}

/** One status line a newcomer can read: "Free", "Beqa · until 21:48 (1h 52m)", "Done 17 Oct, 21:48". */
export function StatusBadge({ item, claim }: { item: Pick<TaskItem, "status" | "lastDoneAt">; claim: Claim | null }) {
  const state = boardState(item, claim);
  const label =
    state === "claimed"
      ? `${claim!.byName} · until ${formatTime(claim!.leaseUntil)} (${formatLeft(claim!.leaseUntil)})`
      : state === "free"
        ? "Free"
        : state === "done"
          ? `Done${item.lastDoneAt ? ` ${formatWhen(item.lastDoneAt)}` : ""}`
          : state === "failed"
            ? "Failed: needs a lead"
            : "Skipped";
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap", STYLES[state])}>
      {state === "claimed" && <span className="size-1.5 animate-pulse rounded-full bg-amber-500" />}
      {label}
    </span>
  );
}

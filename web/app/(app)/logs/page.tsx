import Link from "next/link";
import { Query, type Models } from "node-appwrite";
import { AutoRefresh } from "@/components/auto-refresh";
import { PageHeader } from "@/components/page-header";
import { DB_ID, T, TEAM_ID, adminTables } from "@/lib/appwrite";
import { requireMember } from "@/lib/auth";
import { formatWhen } from "@/lib/format";
import { listTasks } from "@/lib/tasks";
import type { Log, Outcome, TaskItem } from "@/lib/types";
import { cn } from "@/lib/utils";

type Row<X> = X & Models.Row;

const OUTCOME_STYLE: Record<Outcome, string> = {
  done: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  failed: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  skipped: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
};
const FILTERS: { value: Outcome | undefined; label: string }[] = [
  { value: undefined, label: "All" },
  { value: "done", label: "Done" },
  { value: "failed", label: "Failed" },
  { value: "skipped", label: "Skipped" },
];

function duration(startedAt: string, finishedAt: string): string {
  const mins = Math.round((new Date(finishedAt).getTime() - new Date(startedAt).getTime()) / 60_000);
  if (mins < 1) return "< 1m";
  return mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
}

export default async function LogsPage({ searchParams }: { searchParams: Promise<{ outcome?: string }> }) {
  const { outcome: raw } = await searchParams;
  const outcome = FILTERS.find((f) => f.value === raw)?.value;
  await requireMember();

  const db = adminTables();
  const [logs, tasks] = await Promise.all([
    db.listRows<Row<Log>>({
      databaseId: DB_ID,
      tableId: T.logs,
      queries: [
        Query.equal("teamId", [TEAM_ID]),
        ...(outcome ? [Query.equal("outcome", [outcome])] : []),
        Query.orderDesc("finishedAt"),
        Query.limit(100),
      ],
    }),
    listTasks(),
  ]);
  const itemIds = [...new Set(logs.rows.map((l) => l.taskItemId))];
  const items = itemIds.length
    ? await db.listRows<Row<TaskItem>>({ databaseId: DB_ID, tableId: T.taskItems, queries: [Query.equal("$id", itemIds), Query.limit(100)] })
    : { rows: [] };
  const taskTitle = new Map(tasks.map((t) => [t.$id, t.title]));
  const itemText = new Map(items.rows.map((i) => [i.$id, i.item]));

  return (
    <>
      <PageHeader
        title="Logs"
        description="Every attempt: who ran it, on what, the result, and where Claude put it."
        actions={<AutoRefresh renderedAt={new Date().toISOString()} seconds={10} />}
      />
      <div className="mb-4 flex gap-1">
        {FILTERS.map((f) => (
          <Link
            key={f.label}
            href={f.value ? `/logs?outcome=${f.value}` : "/logs"}
            className={cn(
              "rounded-md px-3 py-1 text-sm",
              f.value === outcome ? "bg-accent font-medium" : "text-muted-foreground hover:bg-accent/60",
            )}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {logs.rows.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">No log entries yet.</div>
      ) : (
        <div className="divide-y rounded-lg border">
          <div className="grid grid-cols-[8rem_9rem_1fr_6rem_4rem] gap-4 bg-muted/30 px-4 py-2 text-xs font-medium text-muted-foreground">
            <span>Finished</span>
            <span>By</span>
            <span>Task · item · summary</span>
            <span>Result</span>
            <span>Took</span>
          </div>
          {logs.rows.map((l) => (
            <details key={l.$id} className="group">
              <summary className="grid cursor-pointer list-none grid-cols-[8rem_9rem_1fr_6rem_4rem] items-start gap-4 px-4 py-2.5 text-sm hover:bg-muted/40">
                <span className="tabular-nums text-muted-foreground">{formatWhen(l.finishedAt)}</span>
                <span className="truncate">{l.byName}</span>
                <span className="min-w-0">
                  <span className="font-medium">{taskTitle.get(l.taskId) ?? "Deleted task"}</span>
                  <span className="font-mono text-xs text-muted-foreground"> · {itemText.get(l.taskItemId) || "whole task"}</span>
                  <span className="block truncate text-muted-foreground group-open:whitespace-normal">{l.summary}</span>
                </span>
                <span>
                  <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", OUTCOME_STYLE[l.outcome])}>{l.outcome}</span>
                </span>
                <span className="tabular-nums text-muted-foreground">{duration(l.startedAt, l.finishedAt)}</span>
              </summary>
              <div className="flex flex-col gap-2 bg-muted/20 px-4 py-3 text-sm">
                <div className="text-xs text-muted-foreground">
                  Started {formatWhen(l.startedAt)} · finished {formatWhen(l.finishedAt)} · prompt v{l.version}
                </div>
                <pre className="rounded-md bg-muted p-3 font-mono text-xs whitespace-pre-wrap">{l.details || "No details reported."}</pre>
              </div>
            </details>
          ))}
        </div>
      )}
    </>
  );
}

import Link from "next/link";
import { RotateCcw, Unlock } from "lucide-react";
import { Query } from "node-appwrite";
import { AutoRefresh } from "@/components/auto-refresh";
import { PageHeader } from "@/components/page-header";
import { StatusBadge, boardState, type BoardState } from "@/components/status-badge";
import { ApprovalBadge, ModeBadge } from "@/components/task-badges";
import { Button } from "@/components/ui/button";
import { DB_ID, T, adminTables } from "@/lib/appwrite";
import { requireMember } from "@/lib/auth";
import { formatWhen } from "@/lib/format";
import { listTasks } from "@/lib/tasks";
import { loadWork } from "@/lib/work";
import { cn } from "@/lib/utils";
import { releaseAction, resetAction } from "./actions";

const COUNTERS: { key: BoardState; label: string; tone: string }[] = [
  { key: "free", label: "Free", tone: "text-sky-600" },
  { key: "claimed", label: "In progress", tone: "text-amber-600" },
  { key: "done", label: "Done", tone: "text-emerald-600" },
  { key: "failed", label: "Failed", tone: "text-red-600" },
  { key: "skipped", label: "Skipped", tone: "text-zinc-500" },
];

async function collisionsPrevented(): Promise<number> {
  const { total } = await adminTables().listRows({
    databaseId: DB_ID,
    tableId: T.audit,
    queries: [Query.equal("action", ["claim.taken"]), Query.limit(1)],
    total: true,
  });
  return total;
}

export default async function BoardPage() {
  const [member, tasks, work, collisions] = await Promise.all([requireMember(), listTasks(), loadWork(), collisionsPrevented()]);
  const isLead = member.role === "lead";
  const renderedAt = new Date().toISOString();

  const counts = Object.fromEntries(COUNTERS.map((c) => [c.key, 0])) as Record<BoardState, number>;
  for (const r of work) counts[boardState(r.item, r.claim)]++;

  const groups = tasks
    .map((task) => ({
      task,
      rows: work
        .filter((r) => r.task.$id === task.$id)
        .sort((a, b) => task.items.indexOf(a.item.item) - task.items.indexOf(b.item.item)),
    }))
    .filter((g) => g.rows.length > 0);

  return (
    <>
      <PageHeader
        title="Board"
        description="Every task item, and who is on it. Claude claims items through the commons connector."
        actions={<AutoRefresh renderedAt={renderedAt} />}
      />

      <div className="mb-8 grid grid-cols-3 gap-3 sm:grid-cols-6">
        {COUNTERS.map((c) => (
          <div key={c.key} className="rounded-lg border p-3">
            <div className={cn("text-2xl font-semibold tabular-nums", c.tone)}>{counts[c.key]}</div>
            <div className="text-xs text-muted-foreground">{c.label}</div>
          </div>
        ))}
        <div className="rounded-lg border border-dashed p-3" title="Claims refused because someone else already held the item">
          <div className="text-2xl font-semibold tabular-nums">{collisions}</div>
          <div className="text-xs text-muted-foreground">Collisions prevented</div>
        </div>
      </div>

      {groups.length === 0 && (
        <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          No tasks yet. {isLead ? <Link href="/tasks/new" className="underline">Create one</Link> : "Your lead will add some."}
        </div>
      )}

      <div className="flex flex-col gap-6">
        {groups.map(({ task, rows }) => (
          <section key={task.$id} className="rounded-lg border">
            <header className="flex flex-wrap items-center gap-2 border-b bg-muted/30 px-4 py-2.5">
              <Link href={`/tasks/${task.$id}`} className="font-medium hover:underline">
                {task.title}
              </Link>
              <ModeBadge task={task} />
              <ApprovalBadge task={task} />
            </header>
            <ul className="divide-y">
              {rows.map(({ item, claim, lastLog }) => {
                const state = boardState(item, claim);
                return (
                  <li key={item.$id} className="flex items-center gap-4 px-4 py-2.5">
                    <div className="w-64 shrink-0 truncate font-mono text-sm" title={item.item}>
                      {item.item || "Whole task"}
                    </div>
                    <div className="w-72 shrink-0">
                      <StatusBadge item={item} claim={claim} />
                    </div>
                    <div className="min-w-0 flex-1 truncate text-sm text-muted-foreground" title={lastLog?.summary}>
                      {lastLog && state !== "claimed" && (
                        <>
                          <span className="text-foreground">{lastLog.byName}</span> · {formatWhen(lastLog.finishedAt)} · {lastLog.summary}
                        </>
                      )}
                    </div>
                    {isLead && state === "claimed" && (
                      <form action={releaseAction.bind(null, item.$id)}>
                        <Button type="submit" size="sm" variant="ghost" title="Free this item now (the claimer's lease is cancelled)">
                          <Unlock className="size-3.5" /> Release
                        </Button>
                      </form>
                    )}
                    {isLead && state !== "claimed" && state !== "free" && (
                      <form action={resetAction.bind(null, item.$id)}>
                        <Button type="submit" size="sm" variant="ghost" title="Put this item back in the queue">
                          <RotateCcw className="size-3.5" /> Reset
                        </Button>
                      </form>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}

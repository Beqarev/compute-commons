import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { ApprovalBadge, ModeBadge, PriorityBadge } from "@/components/task-badges";
import { buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireMember } from "@/lib/auth";
import { listTasks } from "@/lib/tasks";
import { loadWork, type WorkRow } from "@/lib/work";
import { StatusBadge } from "@/components/status-badge";

export default async function TasksPage() {
  const [member, tasks, work] = await Promise.all([requireMember(), listTasks(), loadWork()]);
  const stats = new Map<string, { total: number; done: number; active: number; whole?: WorkRow }>();
  for (const r of work) {
    const s = stats.get(r.task.$id) ?? { total: 0, done: 0, active: 0, whole: r };
    s.total++;
    if (r.item.status === "done") s.done++;
    if (r.claim) s.active++;
    stats.set(r.task.$id, s);
  }
  const isLead = member.role === "lead";

  return (
    <>
      <PageHeader
        title="Tasks"
        description="Repeatable jobs with a prompt and an optional item list. Each item is claimed separately."
        actions={
          isLead && (
            <Link href="/tasks/new" className={buttonVariants()}>
              <Plus className="size-4" /> New task
            </Link>
          )
        }
      />
      {tasks.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          No tasks yet.{isLead ? " Create the first one." : " Your lead hasn't created any."}
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Task</TableHead>
                <TableHead>Repeats</TableHead>
                <TableHead>Items done</TableHead>
                <TableHead>Version</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.map((t) => {
                const s = stats.get(t.$id) ?? { total: 0, done: 0, active: 0 };
                return (
                  <TableRow key={t.$id}>
                    <TableCell className="max-w-md">
                      <Link href={`/tasks/${t.$id}`} className="font-medium hover:underline">
                        {t.title}
                      </Link>
                      {t.description && <div className="truncate text-xs text-muted-foreground">{t.description}</div>}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <ModeBadge task={t} />
                        <PriorityBadge priority={t.priority} />
                      </div>
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {t.items.length ? `${s.done} / ${s.total}` : s.whole ? <StatusBadge item={s.whole.item} claim={s.whole.claim} /> : "—"}
                      {s.active > 0 && <span className="ml-2 text-xs text-amber-600">{s.active} in progress</span>}
                    </TableCell>
                    <TableCell>
                      <ApprovalBadge task={t} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, Pencil } from "lucide-react";
import { Query, type Models } from "node-appwrite";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { ApprovalBadge, ModeBadge, PriorityBadge } from "@/components/task-badges";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DB_ID, T, TEAM_ID, adminTables } from "@/lib/appwrite";
import { requireMember } from "@/lib/auth";
import { lineDiff } from "@/lib/diff";
import { formatWhen } from "@/lib/format";
import { buildPrompt } from "@/lib/prompt";
import { getSettings } from "@/lib/settings";
import { getTask, listVersions } from "@/lib/tasks";
import { loadWork } from "@/lib/work";
import type { Member } from "@/lib/types";
import { cn } from "@/lib/utils";
import { approveAction } from "../actions";

const itemLabel = (item: string) => item || "Whole task";

export default async function TaskPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ preview?: string }>;
}) {
  const [{ id }, { preview }] = await Promise.all([params, searchParams]);
  const [member, task, versions, work, settings, members] = await Promise.all([
    requireMember(),
    getTask(id),
    listVersions(id),
    loadWork(),
    getSettings(),
    adminTables().listRows<Member & Models.Row>({ databaseId: DB_ID, tableId: T.members, queries: [Query.equal("teamId", [TEAM_ID])] }),
  ]);
  if (!task) notFound();
  const rows = work.filter((r) => r.task.$id === id).sort((a, b) => task.items.indexOf(a.item.item) - task.items.indexOf(b.item.item));
  const nameOf = new Map(members.rows.map((m) => [m.$id, m.name]));
  const isLead = member.role === "lead";
  const current = versions[0];

  const previewIdx = Math.min(Math.max(Number(preview ?? 0) || 0, 0), Math.max(rows.length - 1, 0));
  const previewItem = rows[previewIdx]?.item.item ?? "";
  const built = current ? buildPrompt({ teamPolicy: settings.policy, taskPrompt: current.prompt, values: { item: previewItem } }) : null;

  return (
    <>
      <PageHeader
        title={task.title}
        description={task.description || undefined}
        actions={
          isLead && (
            <div className="flex gap-2">
              <Link href={`/tasks/${id}/edit`} className={buttonVariants({ variant: "outline" })}>
                <Pencil className="size-4" /> Edit
              </Link>
              {task.approvedVersion !== task.currentVersion && (
                <form action={approveAction.bind(null, id, task.currentVersion)}>
                  <Button type="submit">
                    <Check className="size-4" /> Approve v{task.currentVersion}
                  </Button>
                </form>
              )}
            </div>
          )
        }
      />
      <div className="-mt-3 mb-6 flex flex-wrap gap-2">
        <ModeBadge task={task} />
        <ApprovalBadge task={task} />
        <PriorityBadge priority={task.priority} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Items ({rows.length})</CardTitle>
            <CardDescription>Each item is claimed separately. Claude reports back on each one.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {rows.map((r) => (
                <li key={r.item.$id} className="flex flex-col gap-1 py-2.5 first:pt-0 last:pb-0">
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate font-mono text-sm">{itemLabel(r.item.item)}</span>
                    <StatusBadge item={r.item} claim={r.claim} />
                  </div>
                  {r.lastLog && (
                    <p className="text-xs text-muted-foreground">
                      {r.lastLog.byName}: {r.lastLog.summary}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>What Claude gets</CardTitle>
            <CardDescription>
              Team policy, then the task prompt (v{current?.version}), with {"{{item}}"} filled in.
              {task.approvedVersion != null && task.approvedVersion !== current?.version && (
                <> Schedules still run approved v{task.approvedVersion}.</>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {rows.length > 1 && (
              <form className="flex items-center gap-2 text-sm">
                <label htmlFor="preview" className="text-muted-foreground">
                  Preview for
                </label>
                <select id="preview" name="preview" defaultValue={previewIdx} className="h-8 rounded-md border bg-transparent px-2 font-mono text-xs">
                  {rows.map((r, i) => (
                    <option key={r.item.$id} value={i}>
                      {itemLabel(r.item.item)}
                    </option>
                  ))}
                </select>
                <Button type="submit" size="sm" variant="outline">
                  Show
                </Button>
              </form>
            )}
            <pre className="max-h-96 overflow-auto rounded-md bg-muted p-3 font-mono text-xs whitespace-pre-wrap">{built?.text}</pre>
            {built && built.missing.length > 0 && (
              <p className="text-xs text-amber-600">Unfilled blanks: {built.missing.map((m) => `{{${m}}}`).join(", ")}</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Version history</CardTitle>
          <CardDescription>Versions never change. Schedules only run the approved one.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {versions.map((v, i) => {
            const prev = versions[i + 1];
            const approved = task.approvedVersion === v.version;
            return (
              <div key={v.$id} className={cn("rounded-md border p-3", approved && "border-emerald-500/60")}>
                <div className="mb-2 flex items-center justify-between gap-2 text-sm">
                  <div>
                    <span className="font-medium">v{v.version}</span>
                    <span className="text-muted-foreground">
                      {" "}
                      · {nameOf.get(v.authorId) ?? "unknown"} · {formatWhen(v.createdAt)}
                    </span>
                    {approved && <span className="ml-2 text-xs font-medium text-emerald-600">approved</span>}
                  </div>
                  {isLead && !approved && (
                    <form action={approveAction.bind(null, id, v.version)}>
                      <Button type="submit" size="sm" variant="outline">
                        Approve v{v.version}
                      </Button>
                    </form>
                  )}
                </div>
                <pre className="overflow-auto rounded bg-muted/60 p-2 font-mono text-xs whitespace-pre-wrap">
                  {prev
                    ? lineDiff(prev.prompt, v.prompt).map((d, k) => (
                        <div
                          key={k}
                          className={cn(
                            d.type === "add" && "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300",
                            d.type === "del" && "bg-red-500/15 text-red-800 line-through dark:text-red-300",
                          )}
                        >
                          {d.type === "add" ? "+ " : d.type === "del" ? "- " : "  "}
                          {d.text}
                        </div>
                      ))
                    : v.prompt}
                </pre>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </>
  );
}

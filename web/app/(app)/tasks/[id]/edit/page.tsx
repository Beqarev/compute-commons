import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { requireMember } from "@/lib/auth";
import { getTask, listVersions } from "@/lib/tasks";
import { TaskEditor } from "../../task-editor";

export default async function EditTaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const member = await requireMember();
  if (member.role !== "lead") redirect(`/tasks/${id}`);
  const [task, versions] = await Promise.all([getTask(id), listVersions(id)]);
  if (!task) notFound();
  const { title, description, mode, redoDays, items, priority } = task;
  return (
    <>
      <PageHeader title={`Edit: ${task.title}`} />
      <TaskEditor taskId={id} initial={{ title, description, mode, redoDays, items, priority, prompt: versions[0]?.prompt ?? "" }} />
    </>
  );
}

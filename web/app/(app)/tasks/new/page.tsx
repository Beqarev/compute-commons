import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { requireMember } from "@/lib/auth";
import { TaskEditor } from "../task-editor";

export default async function NewTaskPage() {
  const member = await requireMember();
  if (member.role !== "lead") redirect("/tasks");
  return (
    <>
      <PageHeader title="New task" description="A prompt for any repeatable job, with an optional list of items." />
      <TaskEditor taskId={null} />
    </>
  );
}

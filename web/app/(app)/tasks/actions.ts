"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { Forbidden, requireLead } from "@/lib/auth";
import { approveVersion, getTask, parseItems, saveTask } from "@/lib/tasks";

const TaskForm = z
  .object({
    title: z.string().trim().min(1, "Give the task a title.").max(256),
    description: z.string().trim().max(4000),
    prompt: z.string().trim().min(1, "Write the prompt Claude will follow.").max(100000),
    mode: z.enum(["once", "routine"]),
    redoDays: z.coerce.number().int(),
    items: z.string().max(200000),
    priority: z.coerce.number().int().min(-1).max(1),
  })
  .refine((f) => f.mode === "once" || (f.redoDays >= 1 && f.redoDays <= 365), {
    message: "A routine task needs “redo every” between 1 and 365 days.",
  });

export type SaveState = { error: string } | null;

export async function saveTaskAction(taskId: string | null, _prev: SaveState, form: FormData): Promise<SaveState> {
  let lead;
  try {
    lead = await requireLead();
  } catch (e) {
    if (e instanceof Forbidden) return { error: e.message };
    throw e;
  }
  const parsed = TaskForm.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const items = parseItems(parsed.data.items);
  if (items.length > 200) return { error: "Keep the list to 200 items or fewer." };
  if (items.some((i) => i.length > 1024)) return { error: "Each item must be 1024 characters or fewer." };

  const { title, description, prompt, mode, redoDays, priority } = parsed.data;
  const input = { title, description, prompt, mode, redoDays, items, priority };
  const saved = await saveTask(taskId, input, lead.$id);
  await audit(lead.$id, taskId ? "task.update" : "task.create", `task:${saved.id}`, saved.before, { ...input, version: saved.version });

  revalidatePath("/tasks");
  redirect(`/tasks/${saved.id}`);
}

export async function approveAction(taskId: string, version: number) {
  const lead = await requireLead();
  const before = await getTask(taskId);
  await approveVersion(taskId, version);
  await audit(lead.$id, "task.approve", `task:${taskId}`, { approvedVersion: before?.approvedVersion ?? null }, { approvedVersion: version });
  revalidatePath(`/tasks/${taskId}`);
  revalidatePath("/tasks");
}

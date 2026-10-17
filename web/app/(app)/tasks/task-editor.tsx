"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PRIORITIES } from "@/components/task-badges";
import type { TaskInput } from "@/lib/tasks";
import { saveTaskAction } from "./actions";

const selectClass =
  "h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

export function TaskEditor({ taskId, initial }: { taskId: string | null; initial?: TaskInput }) {
  const [state, action, pending] = useActionState(saveTaskAction.bind(null, taskId), null);
  const [mode, setMode] = useState(initial?.mode ?? "once");
  const [prompt, setPrompt] = useState(initial?.prompt ?? "");
  const [items, setItems] = useState(initial?.items.join("\n") ?? "");

  const itemCount = items.split("\n").filter((l) => l.trim()).length;
  const usesItem = /\{\{\s*item\s*\}\}/.test(prompt);
  const hint =
    itemCount > 0 && !usesItem
      ? "The prompt doesn't use {{item}}, so every item gets the same instructions."
      : itemCount === 0 && usesItem
        ? "The prompt uses {{item}} but the list is empty: add items or remove the blank."
        : null;

  return (
    <form action={action} className="flex max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Label htmlFor="title">Title</Label>
        <Input id="title" name="title" defaultValue={initial?.title} placeholder="SEO audit" required maxLength={256} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="description">Description</Label>
        <Input
          id="description"
          name="description"
          defaultValue={initial?.description}
          placeholder="One line for the board: what this task is for"
          maxLength={4000}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="prompt">Prompt</Label>
        <p className="text-xs text-muted-foreground">
          Markdown instructions Claude follows. Use <code className="font-mono">{"{{item}}"}</code> where each list item goes. The
          team policy is added before it automatically.
        </p>
        <Textarea
          id="prompt"
          name="prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={10}
          className="font-mono text-sm"
          placeholder={"Audit {{item}} for technical SEO.\n\nWrite a short report with the top 5 fixes and post it in #seo."}
          required
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="items">
          Items <span className="font-normal text-muted-foreground">(optional, one per line: {itemCount})</span>
        </Label>
        <p className="text-xs text-muted-foreground">
          Each line is claimed and done separately, so two Claudes never do the same one. Leave empty for a single job.
        </p>
        <Textarea
          id="items"
          name="items"
          value={items}
          onChange={(e) => setItems(e.target.value)}
          rows={5}
          className="font-mono text-sm"
          placeholder={"https://site-a.ge\nhttps://site-b.ge\nhttps://site-c.ge"}
        />
        {hint && <p className="text-xs text-amber-600">{hint}</p>}
      </div>
      <div className="flex flex-wrap gap-6">
        <div className="flex flex-col gap-2">
          <Label htmlFor="mode">Repeats</Label>
          <select id="mode" name="mode" value={mode} onChange={(e) => setMode(e.target.value as "once" | "routine")} className={selectClass}>
            <option value="once">One-off: done once</option>
            <option value="routine">Routine: comes back</option>
          </select>
        </div>
        {mode === "routine" ? (
          <div className="flex flex-col gap-2">
            <Label htmlFor="redoDays">Redo every (days)</Label>
            <Input id="redoDays" name="redoDays" type="number" min={1} max={365} defaultValue={initial?.redoDays || 7} className="w-28" />
          </div>
        ) : (
          <input type="hidden" name="redoDays" value="0" />
        )}
        <div className="flex flex-col gap-2">
          <Label htmlFor="priority">Priority</Label>
          <select id="priority" name="priority" defaultValue={String(initial?.priority ?? 0)} className={selectClass}>
            {PRIORITIES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : taskId ? "Save changes" : "Create task"}
        </Button>
        <Link href={taskId ? `/tasks/${taskId}` : "/tasks"} className={buttonVariants({ variant: "ghost" })}>
          Cancel
        </Link>
      </div>
      {taskId && <p className="text-xs text-muted-foreground">Changing the prompt creates a new version. It needs approval before schedules run it.</p>}
    </form>
  );
}

"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Settings } from "@/lib/types";
import { saveSettingsAction } from "./actions";

function NumberField({ name, label, hint, value, min, max }: { name: string; label: string; hint: string; value: number; min: number; max: number }) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type="number" min={min} max={max} defaultValue={value} className="w-32" required />
      <p className="max-w-56 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

export function SettingsForm({ settings }: { settings: Settings }) {
  const [state, action, pending] = useActionState(saveSettingsAction, null);
  return (
    <form action={action} className="flex max-w-3xl flex-col gap-8">
      <div className="flex flex-col gap-2">
        <Label htmlFor="policy">Team policy</Label>
        <p className="text-xs text-muted-foreground">
          Rules placed before every task prompt: how to deliver results, what never to touch. Code teams put their branching
          strategy here (for example “commit on a new branch, never to main”).
        </p>
        <Textarea id="policy" name="policy" defaultValue={settings.policy} rows={8} className="font-mono text-sm" />
      </div>
      <div className="flex flex-wrap gap-8">
        <NumberField
          name="maxItemsPerRun"
          label="Max items per schedule run"
          hint="The team schedule stops claiming after this many items."
          value={settings.maxItemsPerRun}
          min={1}
          max={100}
        />
        <NumberField
          name="maxMinutesPerRun"
          label="Run window (minutes)"
          hint="Items started within this window count toward the run's budget."
          value={settings.maxMinutesPerRun}
          min={5}
          max={1440}
        />
        <NumberField
          name="leaseMinutes"
          label="Lease (minutes)"
          hint="How long a claim lasts without a heartbeat. After that, anyone may take the item."
          value={settings.leaseMinutes}
          min={1}
          max={1440}
        />
      </div>
      {state && "error" in state && <p className="text-sm text-destructive">{state.error}</p>}
      {state && "ok" in state && <p className="text-sm text-emerald-600">Saved. The next Claude call uses the new settings.</p>}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save settings"}
        </Button>
      </div>
    </form>
  );
}

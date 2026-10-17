"use client";

import { useActionState } from "react";
import { CopyBlock } from "@/components/copy-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createTokenAction } from "./actions";

export function TokenCreator({ isLead, mcpUrl, memberName }: { isLead: boolean; mcpUrl: string; memberName: string }) {
  const [state, action, pending] = useActionState(createTokenAction, null);
  const created = state && "token" in state ? state : null;

  return (
    <div className="flex flex-col gap-4">
      <form action={action} className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="name">Token name</Label>
          <Input id="name" name="name" defaultValue={`${memberName}'s laptop`} className="w-56" required />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="owner">Acts as</Label>
          <select id="owner" name="owner" className="h-9 rounded-md border border-input bg-transparent px-3 text-sm" defaultValue="me">
            <option value="me">Me ({memberName}): my Claude Code</option>
            {isLead && <option value="team">Team schedule: runs approved tasks only</option>}
          </select>
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create token"}
        </Button>
      </form>
      {state && "error" in state && <p className="text-sm text-destructive">{state.error}</p>}

      {created && (
        <div className="flex flex-col gap-3 rounded-lg border border-emerald-500/50 bg-emerald-500/5 p-4">
          <p className="text-sm font-medium">
            Token “{created.name}” created. Copy it now: it is shown only once.
          </p>
          <CopyBlock text={created.token} label="Copy token" />
          {created.owner === "me" ? (
            <>
              <p className="text-sm">Run this once in a terminal, inside the folder where you use Claude Code:</p>
              <CopyBlock
                text={`claude mcp add --transport http commons ${mcpUrl} --header "Authorization: Bearer ${created.token}"`}
                label="Copy command"
              />
            </>
          ) : (
            <p className="text-sm">Use it as the connector&apos;s request header in step 3: <code className="font-mono">Authorization: Bearer &lt;token&gt;</code>.</p>
          )}
        </div>
      )}
    </div>
  );
}

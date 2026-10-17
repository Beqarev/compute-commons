import type { ReactNode } from "react";
import { Query, type Models } from "node-appwrite";
import { AutoRefresh } from "@/components/auto-refresh";
import { CopyBlock } from "@/components/copy-button";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DB_ID, T, TEAM_ID, adminTables } from "@/lib/appwrite";
import { requireMember } from "@/lib/auth";
import { formatAgo, formatWhen } from "@/lib/format";
import { SETUP_PROMPT } from "@/lib/mcp/instructions";
import { listTokens } from "@/lib/tokens";
import type { Member } from "@/lib/types";
import { appUrl } from "@/lib/url";
import { revokeTokenAction } from "./actions";
import { TokenCreator } from "./token-creator";

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section className="flex gap-4">
      <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">{n}</div>
      <div className="flex min-w-0 flex-1 flex-col gap-3 pb-8">
        <h2 className="font-semibold">{title}</h2>
        {children}
      </div>
    </section>
  );
}

export default async function SetupPage() {
  const member = await requireMember();
  const isLead = member.role === "lead";
  const mcpUrl = `${await appUrl()}/api/mcp`;
  const [tokens, members] = await Promise.all([
    listTokens(isLead ? undefined : member.$id),
    adminTables().listRows<Member & Models.Row>({ databaseId: DB_ID, tableId: T.members, queries: [Query.equal("teamId", [TEAM_ID])] }),
  ]);
  const nameOf = new Map(members.rows.map((m) => [m.$id, m.name]));
  const isLocal = mcpUrl.includes("localhost") || mcpUrl.includes("127.0.0.1");

  return (
    <>
      <PageHeader
        title="Connect Claude"
        description="Once per person or schedule. After that, Claude gets its work, rules and budget from this server."
        actions={<AutoRefresh renderedAt={new Date().toISOString()} />}
      />
      <div className="max-w-3xl">
        <Step n={1} title="Create a token">
          <p className="text-sm text-muted-foreground">
            Your own token lets your Claude Code claim work as you. The team token is for Claude schedules: it only takes approved
            tasks and is logged as “Team schedule”.
          </p>
          <TokenCreator isLead={isLead} mcpUrl={mcpUrl} memberName={member.name} />
        </Step>

        <Step n={2} title="Claude Code on your laptop">
          <p className="text-sm text-muted-foreground">Step 1 shows this command with your token filled in. Then ask Claude:</p>
          <CopyBlock text="take the next task from commons" />
        </Step>

        <Step n={3} title="A Claude schedule (runs after hours)">
          <p className="text-sm text-muted-foreground">
            Add a custom connector named <b>commons</b> with this URL, and the team token as a request header
            (<code className="font-mono">Authorization: Bearer &lt;team token&gt;</code>):
          </p>
          <CopyBlock text={mcpUrl} label="Copy URL" />
          {isLocal && (
            <p className="text-xs text-amber-600">
              This is a local address. Cloud schedules need the deployed URL; on this laptop, run a schedule with{" "}
              <code className="font-mono">npm run routine</code> in <code className="font-mono">web/</code>.
            </p>
          )}
          <p className="text-sm text-muted-foreground">
            Then create the scheduled task with just this one line. The workflow, the tasks and the budget all come from this server,
            so you never need to paste it again:
          </p>
          <CopyBlock text={SETUP_PROMPT} label="Copy prompt" />
        </Step>

        <Step n={4} title="Check it works">
          <p className="text-sm text-muted-foreground">
            Run the schedule once by hand, or ask your Claude Code for work. “Last used” changes as soon as Claude connects, and the
            board shows the claim.
          </p>
          {tokens.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tokens yet.</p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {tokens.map((t) => (
                <li key={t.$id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{t.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {t.owner === "team" ? "Team schedule" : (nameOf.get(t.owner) ?? "Removed member")} · created {formatWhen(t.$createdAt)}
                    </div>
                  </div>
                  {t.revoked ? (
                    <Badge variant="outline">Revoked</Badge>
                  ) : t.lastUsedAt ? (
                    <span className="text-xs text-emerald-600">Last used {formatAgo(t.lastUsedAt)}</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">Never used</span>
                  )}
                  {!t.revoked && (
                    <form action={revokeTokenAction.bind(null, t.$id)}>
                      <Button type="submit" size="sm" variant="ghost">
                        Revoke
                      </Button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Step>
      </div>
    </>
  );
}

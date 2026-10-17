import { PageHeader } from "@/components/page-header";
import { requireMember } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { SettingsForm } from "./settings-form";

export default async function SettingsPage() {
  const member = await requireMember();
  if (member.role !== "lead") {
    return (
      <>
        <PageHeader title="Settings" />
        <div className="rounded-lg border p-10 text-center">
          <p className="font-medium">Only a lead can change team settings.</p>
          <p className="mt-1 text-sm text-muted-foreground">You can still read tasks, the board and the logs.</p>
        </div>
      </>
    );
  }
  const settings = await getSettings();
  const { policy, maxItemsPerRun, maxMinutesPerRun, leaseMinutes, teamId, $id } = settings;
  return (
    <>
      <PageHeader title="Settings" description="Rules and limits for every Claude that works on this team's tasks." />
      <SettingsForm settings={{ policy, maxItemsPerRun, maxMinutesPerRun, leaseMinutes, teamId, $id }} />
    </>
  );
}

import { ComingSoon, PageHeader } from "@/components/page-header";
import { requireMember } from "@/lib/auth";

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
  return (
    <>
      <PageHeader title="Settings" description="Team policy, run budget and lease length." />
      <ComingSoon what="Policy and budget editing arrive in hour 7." />
    </>
  );
}

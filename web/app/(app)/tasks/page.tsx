import { ComingSoon, PageHeader } from "@/components/page-header";

export default function Page() {
  return (
    <>
      <PageHeader title="Tasks" description="Repeatable jobs with a prompt and an optional item list." />
      <ComingSoon what="The task editor arrives in hour 5." />
    </>
  );
}

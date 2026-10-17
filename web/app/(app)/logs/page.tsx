import { ComingSoon, PageHeader } from "@/components/page-header";

export default function Page() {
  return (
    <>
      <PageHeader title="Logs" description="Who did what, when, and with what result." />
      <ComingSoon what="The log table arrives in hour 6." />
    </>
  );
}

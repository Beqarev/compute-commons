import { ComingSoon, PageHeader } from "@/components/page-header";

export default function Page() {
  return (
    <>
      <PageHeader title="Board" description="Every task item: free, in progress, done, failed or skipped." />
      <ComingSoon what="The live board arrives in hour 6." />
    </>
  );
}

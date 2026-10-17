import type { ReactNode } from "react";

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions}
    </div>
  );
}

/** Temporary body for pages built in a later hour. */
export function ComingSoon({ what }: { what: string }) {
  return <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">{what}</div>;
}

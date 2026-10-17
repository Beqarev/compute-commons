"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/** Re-renders the server page every few seconds while the tab is visible. */
export function AutoRefresh({ seconds = 5, renderedAt }: { seconds?: number; renderedAt: string }) {
  const router = useRouter();
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const id = setInterval(() => {
      if (!document.hidden) router.refresh();
    }, seconds * 1000);
    const onVis = () => setPaused(document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [router, seconds]);

  const time = new Date(renderedAt).toLocaleTimeString("en-GB");
  return (
    <span className="inline-flex items-center gap-2 text-xs text-muted-foreground" suppressHydrationWarning>
      <span className={`size-2 rounded-full ${paused ? "bg-zinc-400" : "animate-pulse bg-emerald-500"}`} />
      {paused ? "Paused" : "Live"} · updated {time}
    </span>
  );
}

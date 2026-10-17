"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, ListTodo, Plug, ScrollText, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/board", label: "Board", icon: LayoutGrid },
  { href: "/tasks", label: "Tasks", icon: ListTodo },
  { href: "/logs", label: "Logs", icon: ScrollText },
  { href: "/setup", label: "Connect Claude", icon: Plug },
  { href: "/settings", label: "Settings", icon: Settings, leadOnly: true },
];

export function Nav({ isLead }: { isLead: boolean }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1">
      {LINKS.filter((l) => isLead || !l.leadOnly).map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
              active ? "bg-accent font-medium text-accent-foreground" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
            )}
          >
            <Icon className="size-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

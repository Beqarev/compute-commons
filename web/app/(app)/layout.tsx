import type { ReactNode } from "react";
import { LogOut } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Nav } from "@/components/nav";
import { ping } from "@/lib/appwrite";
import { requireMember } from "@/lib/auth";
import { logout } from "../(auth)/login/actions";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const [member, up] = await Promise.all([requireMember(), ping()]);
  return (
    <div className="flex min-h-screen">
      <aside className="flex w-56 shrink-0 flex-col gap-6 border-r bg-muted/30 p-4">
        <div className="px-3 pt-1">
          <div className="font-semibold tracking-tight">Compute Commons</div>
          <div className="text-xs text-muted-foreground">Team task queue</div>
        </div>
        <Nav isLead={member.role === "lead"} />
        <div className="mt-auto flex flex-col gap-3 px-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className={`size-2 rounded-full ${up ? "bg-emerald-500" : "bg-red-500"}`} />
            Appwrite {up ? "connected" : "unreachable"}
          </div>
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{member.name}</div>
              <Badge variant={member.role === "lead" ? "default" : "secondary"} className="mt-0.5">
                {member.role}
              </Badge>
            </div>
            <form action={logout}>
              <Button type="submit" variant="ghost" size="icon" aria-label="Sign out" title="Sign out">
                <LogOut className="size-4" />
              </Button>
            </form>
          </div>
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-8">{children}</main>
    </div>
  );
}

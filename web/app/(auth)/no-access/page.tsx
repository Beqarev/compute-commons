import { Button } from "@/components/ui/button";
import { logout } from "../login/actions";

export default function NoAccess() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-xl font-semibold">You&apos;re signed in, but not on this team yet</h1>
      <p className="text-muted-foreground">Ask your lead to add you.</p>
      <form action={logout}>
        <Button type="submit" variant="outline">Sign out</Button>
      </form>
    </main>
  );
}

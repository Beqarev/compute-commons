import { connection } from "next/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Query } from "node-appwrite";
import { DB_ID, T, adminTables, ping } from "@/lib/appwrite";

// Temporary status page for hour 0. Becomes a redirect to /board once login exists.

async function databaseStatus(): Promise<"ready" | "missing" | "error"> {
  try {
    await adminTables().get({ databaseId: DB_ID });
    return "ready";
  } catch (e) {
    return (e as { code?: number }).code === 404 ? "missing" : "error";
  }
}

async function rowCounts(): Promise<[string, number | null][]> {
  const db = adminTables();
  return Promise.all(
    Object.values(T).map(async (tableId) => {
      try {
        const { total } = await db.listRows({ databaseId: DB_ID, tableId, queries: [Query.limit(1)], total: true });
        return [tableId, total] as [string, number];
      } catch {
        return [tableId, null] as [string, null];
      }
    }),
  );
}

export default async function Home() {
  await connection();
  const [up, db] = await Promise.all([ping(), databaseStatus()]);
  const counts = db === "ready" ? await rowCounts() : [];

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-6 p-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Compute Commons</h1>
        <p className="text-muted-foreground">Team tasks for spare Claude capacity.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Backend status</CardTitle>
          <CardDescription>Server-side checks against Appwrite.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          <div className="flex items-center justify-between">
            <span>Appwrite server</span>
            <Badge variant={up ? "default" : "destructive"}>{up ? "connected" : "unreachable"}</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span>
              Database <code className="font-mono">{DB_ID}</code>
            </span>
            <Badge variant={db === "ready" ? "default" : db === "missing" ? "secondary" : "destructive"}>
              {db === "ready" ? "ready" : db === "missing" ? "not created yet" : "error"}
            </Badge>
          </div>
          {counts.length > 0 && (
            <div className="mt-2 grid grid-cols-3 gap-2 border-t pt-4">
              {counts.map(([table, n]) => (
                <div key={table} className="rounded-md bg-muted px-2 py-1.5">
                  <div className="font-mono text-xs text-muted-foreground">{table}</div>
                  <div className="text-lg font-semibold">{n ?? "missing"}</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

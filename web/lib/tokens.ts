import { createHash, randomBytes } from "node:crypto";
import { ID, Query, type Models } from "node-appwrite";
import { DB_ID, T, adminTables } from "./appwrite";
import type { ApiToken, Caller, Member } from "./types";

// MCP access tokens: `cc_` + 32 random bytes. Only the sha256 hash is stored.

export function newTokenString(): string {
  return "cc_" + randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Returns the token once; it cannot be read back later. */
export async function createToken(owner: string, name: string): Promise<{ token: string; row: ApiToken }> {
  const token = newTokenString();
  const row = await adminTables().createRow<ApiToken & Models.Row>({
    databaseId: DB_ID,
    tableId: T.apiTokens,
    rowId: ID.unique(),
    data: { owner, name, tokenHash: hashToken(token), lastUsedAt: null, revoked: false },
  });
  return { token, row };
}

export async function verifyToken(token: string | undefined | null): Promise<Caller | null> {
  if (!token?.startsWith("cc_")) return null;
  const db = adminTables();
  const { rows } = await db.listRows<ApiToken & Models.Row>({
    databaseId: DB_ID,
    tableId: T.apiTokens,
    queries: [Query.equal("tokenHash", [hashToken(token)]), Query.limit(1)],
  });
  const row = rows[0];
  if (!row || row.revoked) return null;

  let caller: Caller;
  if (row.owner === "team") {
    caller = { kind: "team" };
  } else {
    const member = await db
      .getRow<Member & Models.Row>({ databaseId: DB_ID, tableId: T.members, rowId: row.owner })
      .catch(() => null);
    if (!member) return null;
    caller = { kind: "member", memberId: member.$id, name: member.name, role: member.role };
  }
  await db.updateRow({ databaseId: DB_ID, tableId: T.apiTokens, rowId: row.$id, data: { lastUsedAt: new Date().toISOString() } });
  return caller;
}

export async function verifyBearer(header: string | null): Promise<Caller | null> {
  const m = header?.match(/^Bearer\s+(\S+)$/i);
  return verifyToken(m?.[1]);
}

export async function revokeToken(id: string): Promise<void> {
  await adminTables().updateRow({ databaseId: DB_ID, tableId: T.apiTokens, rowId: id, data: { revoked: true } });
}

/** Who a caller is, as stored in claims and logs. */
export function callerId(c: Caller): { by: string; byName: string } {
  return c.kind === "team" ? { by: "team", byName: "Team schedule" } : { by: c.memberId, byName: c.name };
}

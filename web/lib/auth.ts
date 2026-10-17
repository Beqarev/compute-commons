import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { Models } from "node-appwrite";
import { DB_ID, T, TEAM_ID, adminTables, sessionAccount } from "./appwrite";
import type { Member } from "./types";

export class Forbidden extends Error {
  constructor(message = "Only a lead can do this.") {
    super(message);
  }
}

/** The signed-in Appwrite user, or null (no cookie, or an expired session). */
export const getUser = cache(async (): Promise<Models.User | null> => {
  const account = await sessionAccount();
  if (!account) return null;
  try {
    return await account.get();
  } catch {
    return null;
  }
});

/** The signed-in user's member row for this team, or null. Member row id = Appwrite user id. */
export const getMember = cache(async (): Promise<Member | null> => {
  const user = await getUser();
  if (!user) return null;
  try {
    const m = await adminTables().getRow<Member & Models.Row>({ databaseId: DB_ID, tableId: T.members, rowId: user.$id });
    return m.teamId === TEAM_ID ? m : null;
  } catch {
    return null;
  }
});

/** For pages: signed-out users go to /login. */
export async function requireMember(): Promise<Member> {
  const member = await getMember();
  if (!member) redirect((await getUser()) ? "/no-access" : "/login");
  return member;
}

/** For lead-only writes (server actions). Throws Forbidden for members. */
export async function requireLead(): Promise<Member> {
  const member = await requireMember();
  if (member.role !== "lead") throw new Forbidden();
  return member;
}

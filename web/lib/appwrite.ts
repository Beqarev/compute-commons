import "server-only";
import { cookies } from "next/headers";
import { Account, Client, TablesDB, Users } from "node-appwrite";

// Every Appwrite call runs on the server. The browser never talks to Appwrite.

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var ${name}. Copy web/.env.example to web/.env.local.`);
  return value;
}

export const DB_ID = process.env.APPWRITE_DATABASE_ID ?? "commons_beqa";
export const TEAM_ID = process.env.TEAM_ID ?? "rando";
export const SESSION_COOKIE = process.env.SESSION_COOKIE_NAME ?? "commons_session";

/** Scripts that write or wipe data call this first: teammates' databases live in the same project. */
export function assertOwnDatabase() {
  if (!DB_ID.startsWith("commons_beqa")) throw new Error(`Refusing to touch database "${DB_ID}": not this build's.`);
}

export const T = {
  members: "members",
  tasks: "tasks",
  taskVersions: "task_versions",
  taskItems: "task_items",
  claims: "claims",
  logs: "logs",
  settings: "settings",
  apiTokens: "api_tokens",
  audit: "audit_log",
} as const;

function baseClient(): Client {
  return new Client().setEndpoint(env("APPWRITE_ENDPOINT")).setProject(env("APPWRITE_PROJECT_ID"));
}

function adminClient(): Client {
  return baseClient().setKey(env("APPWRITE_API_KEY"));
}

export function adminTables(): TablesDB {
  return new TablesDB(adminClient());
}

export function adminUsers(): Users {
  return new Users(adminClient());
}

export function adminAccount(): Account {
  return new Account(adminClient());
}

/** The signed-in user's Account, or null when there is no session cookie. */
export async function sessionAccount(): Promise<Account | null> {
  const secret = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!secret) return null;
  return new Account(baseClient().setSession(secret));
}

/** True when the Appwrite server answers. */
export async function ping(): Promise<boolean> {
  try {
    await baseClient().ping();
    return true;
  } catch {
    return false;
  }
}

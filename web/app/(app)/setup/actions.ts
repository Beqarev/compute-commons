"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { requireMember } from "@/lib/auth";
import { createToken, getToken, revokeToken } from "@/lib/tokens";

export type CreatedToken = { token: string; name: string; owner: "me" | "team" } | { error: string } | null;

const Input = z.object({ name: z.string().trim().min(1, "Name the token, e.g. “Beqa's laptop”.").max(128), owner: z.enum(["me", "team"]) });

export async function createTokenAction(_prev: CreatedToken, form: FormData): Promise<CreatedToken> {
  const member = await requireMember();
  const parsed = Input.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (parsed.data.owner === "team" && member.role !== "lead") return { error: "Only a lead can create the team (schedule) token." };

  const owner = parsed.data.owner === "team" ? "team" : member.$id;
  const { token, row } = await createToken(owner, parsed.data.name);
  await audit(member.$id, "token.create", `token:${row.$id}`, null, { owner, name: row.name });
  revalidatePath("/setup");
  return { token, name: row.name, owner: parsed.data.owner };
}

export async function revokeTokenAction(id: string) {
  const member = await requireMember();
  const token = await getToken(id);
  if (!token) return;
  if (token.owner !== member.$id && member.role !== "lead") throw new Error("You can only revoke your own tokens.");
  await revokeToken(id);
  await audit(member.$id, "token.revoke", `token:${id}`, { revoked: false }, { revoked: true });
  revalidatePath("/setup");
}

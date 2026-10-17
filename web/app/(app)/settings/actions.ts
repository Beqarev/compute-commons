"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { DB_ID, T, TEAM_ID, adminTables } from "@/lib/appwrite";
import { audit } from "@/lib/audit";
import { Forbidden, requireLead } from "@/lib/auth";
import { getSettings } from "@/lib/settings";

const SettingsForm = z.object({
  policy: z.string().max(20000),
  maxItemsPerRun: z.coerce.number().int().min(1, "A run must be allowed at least 1 item.").max(100),
  maxMinutesPerRun: z.coerce.number().int().min(5).max(24 * 60),
  leaseMinutes: z.coerce.number().int().min(1, "A lease must last at least 1 minute.").max(24 * 60),
});

export type SettingsState = { ok: true } | { error: string } | null;

export async function saveSettingsAction(_prev: SettingsState, form: FormData): Promise<SettingsState> {
  let lead;
  try {
    lead = await requireLead();
  } catch (e) {
    if (e instanceof Forbidden) return { error: e.message };
    throw e;
  }
  const parsed = SettingsForm.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const before = await getSettings();
  const data = { ...parsed.data, policy: parsed.data.policy.trim() };
  await adminTables().updateRow({ databaseId: DB_ID, tableId: T.settings, rowId: TEAM_ID, data });
  const { policy, maxItemsPerRun, maxMinutesPerRun, leaseMinutes } = before;
  await audit(lead.$id, "settings.update", `settings:${TEAM_ID}`, { policy, maxItemsPerRun, maxMinutesPerRun, leaseMinutes }, data);
  revalidatePath("/settings");
  return { ok: true };
}

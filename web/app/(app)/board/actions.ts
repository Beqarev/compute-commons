"use server";

import { revalidatePath } from "next/cache";
import { audit } from "@/lib/audit";
import { requireLead } from "@/lib/auth";
import { releaseClaim, resetItem } from "@/lib/claims";

export async function releaseAction(itemId: string) {
  const lead = await requireLead();
  const released = await releaseClaim(itemId);
  if (released) await audit(lead.$id, "claim.release", `item:${itemId}`, released, null);
  revalidatePath("/board");
}

export async function resetAction(itemId: string) {
  const lead = await requireLead();
  const before = await resetItem(itemId);
  if (before) await audit(lead.$id, "item.reset", `item:${itemId}`, { status: before }, { status: "available" });
  revalidatePath("/board");
}

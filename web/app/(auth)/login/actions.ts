"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { SESSION_COOKIE, adminAccount, sessionAccount } from "@/lib/appwrite";

const LoginInput = z.object({ email: z.email(), password: z.string().min(1) });

export async function login(_prev: { error: string } | null, form: FormData): Promise<{ error: string } | null> {
  const parsed = LoginInput.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { error: "Enter your email and password." };

  let session;
  try {
    // Created with the API key so Appwrite returns the session secret (Appwrite's SSR pattern).
    session = await adminAccount().createEmailPasswordSession(parsed.data);
  } catch {
    return { error: "Wrong email or password." };
  }
  (await cookies()).set(SESSION_COOKIE, session.secret, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(session.expire),
  });
  redirect("/board");
}

export async function logout() {
  const account = await sessionAccount();
  await account?.deleteSession({ sessionId: "current" }).catch(() => {});
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}

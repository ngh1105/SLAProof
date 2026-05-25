"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export type LoginResult = { ok: true } | { ok: false; error: string };

export async function pilotLoginAction(token: string): Promise<LoginResult> {
  const expected = process.env.PILOT_TOKEN;
  if (!expected) return { ok: true };
  if (!token || token !== expected) {
    return { ok: false, error: "Invalid pilot token." };
  }
  const jar = await cookies();
  jar.set("pilot_token", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
  return { ok: true };
}

export async function pilotLogoutAction(): Promise<void> {
  const jar = await cookies();
  jar.delete("pilot_token");
  redirect("/login");
}

"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createRateLimiter } from "@/lib/security/rate-limit";
import { increment } from "@/lib/observability/metrics";
import { log } from "@/lib/observability/logger";

export type LoginResult = { ok: true } | { ok: false; error: string };

// Strict bucket — 5 attempts per ~5 min per IP. Prevents brute-force on
// PILOT_TOKEN even when the token is short.
const loginLimiter = createRateLimiter({ capacity: 5, refillPerSecond: 1 / 60 });

async function clientKey(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for") ?? h.get("x-real-ip") ?? "anonymous";
}

export async function pilotLoginAction(token: string): Promise<LoginResult> {
  const expected = process.env.PILOT_TOKEN;
  if (!expected) return { ok: true };

  const key = await clientKey();
  const limit = loginLimiter.hit(key);
  if (!limit.allowed) {
    const retrySec = Math.ceil(limit.retryAfterMs / 1000);
    increment("login_rate_limited");
    log.warn("login_rate_limited", { client: key, retrySec });
    return { ok: false, error: `Too many attempts. Try again in ${retrySec}s.` };
  }

  if (!token || token !== expected) {
    increment("login_invalid");
    log.warn("login_invalid", { client: key });
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
  increment("login_ok");
  log.info("login_ok", { client: key });
  return { ok: true };
}

export async function pilotLogoutAction(): Promise<void> {
  const jar = await cookies();
  jar.delete("pilot_token");
  redirect("/login");
}

"use server";

import { cookies, headers } from "next/headers";
import { saveDemoCase } from "@/lib/domain/fixtures";
import { validateCasePayload } from "@/lib/domain/case-payload";
import { appendAudit } from "@/lib/audit/audit-log";
import { createRateLimiter } from "@/lib/security/rate-limit";

export type CreateCaseResult = { ok: true; id: string } | { ok: false; errors: string[] };

const rateLimiter = createRateLimiter({ capacity: 5, refillPerSecond: 1 / 6 });

async function clientKey(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for") ?? h.get("x-real-ip") ?? "anonymous";
}

async function authorized(): Promise<boolean> {
  const expected = process.env.PILOT_TOKEN;
  if (!expected) return true; // dev mode: no token configured
  const jar = await cookies();
  return jar.get("pilot_token")?.value === expected;
}

export async function createCaseAction(input: unknown): Promise<CreateCaseResult> {
  if (!(await authorized())) {
    return { ok: false, errors: ["Unauthorized: pilot token required."] };
  }

  const key = await clientKey();
  const limit = rateLimiter.hit(key);
  if (!limit.allowed) {
    const retrySec = Math.ceil(limit.retryAfterMs / 1000);
    return {
      ok: false,
      errors: [`Rate limit exceeded. Try again in ${retrySec}s.`],
    };
  }

  const validated = validateCasePayload(input);
  if (!validated.ok) {
    return { ok: false, errors: validated.errors };
  }

  try {
    saveDemoCase(validated.case);
    appendAudit({
      action: "case_created",
      caseId: validated.case.id,
      actor: "pilot",
      details: { provider: validated.case.providerName, chain: validated.case.chain },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown storage error.";
    appendAudit({
      action: "case_failed",
      caseId: validated.case.id,
      actor: "pilot",
      details: { reason: message },
    });
    return { ok: false, errors: [`Failed to save case: ${message}`] };
  }

  return { ok: true, id: validated.case.id };
}

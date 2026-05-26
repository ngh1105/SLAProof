"use server";

import { cookies, headers } from "next/headers";
import { saveDemoCase } from "@/lib/domain/fixtures";
import { validateCasePayload } from "@/lib/domain/case-payload";
import { appendAudit } from "@/lib/audit/audit-log";
import { createRateLimiter } from "@/lib/security/rate-limit";
import { increment, observe } from "@/lib/observability/metrics";
import { log } from "@/lib/observability/logger";

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
  const startMs = Date.now();
  if (!(await authorized())) {
    increment("case_create_unauthorized");
    log.warn("case_create_unauthorized");
    return { ok: false, errors: ["Unauthorized: pilot token required."] };
  }

  const key = await clientKey();
  const limit = rateLimiter.hit(key);
  if (!limit.allowed) {
    const retrySec = Math.ceil(limit.retryAfterMs / 1000);
    increment("case_create_rate_limited");
    log.warn("case_create_rate_limited", { client: key, retrySec });
    return {
      ok: false,
      errors: [`Rate limit exceeded. Try again in ${retrySec}s.`],
    };
  }

  const validated = validateCasePayload(input);
  if (!validated.ok) {
    increment("case_create_invalid");
    log.warn("case_create_invalid", { errors: validated.errors });
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
    increment("case_create_ok");
    observe("case_create_ms", Date.now() - startMs);
    log.info("case_created", { caseId: validated.case.id, provider: validated.case.providerName });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown storage error.";
    appendAudit({
      action: "case_failed",
      caseId: validated.case.id,
      actor: "pilot",
      details: { reason: message },
    });
    increment("case_create_failed");
    log.error("case_create_failed", { caseId: validated.case.id, reason: message });
    return { ok: false, errors: [`Failed to save case: ${message}`] };
  }

  return { ok: true, id: validated.case.id };
}

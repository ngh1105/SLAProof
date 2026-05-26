"use server";

import { cookies } from "next/headers";
import { saveDemoCase } from "@/lib/domain/fixtures";
import { validateCasePayload } from "@/lib/domain/case-payload";
import { appendAudit } from "@/lib/audit/audit-log";

export type CreateCaseResult = { ok: true; id: string } | { ok: false; errors: string[] };

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

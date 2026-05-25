"use server";

import { saveDemoCase } from "@/lib/domain/fixtures";
import { validateCasePayload } from "@/lib/domain/case-payload";

export type CreateCaseResult = { ok: true; id: string } | { ok: false; errors: string[] };

export async function createCaseAction(input: unknown): Promise<CreateCaseResult> {
  const validated = validateCasePayload(input);
  if (!validated.ok) {
    return { ok: false, errors: validated.errors };
  }

  try {
    saveDemoCase(validated.case);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown storage error.";
    return { ok: false, errors: [`Failed to save case: ${message}`] };
  }

  return { ok: true, id: validated.case.id };
}

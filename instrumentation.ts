// Next.js instrumentation hook. Runs once when the server boots.
// Used to validate environment configuration so we fail fast in
// production instead of crashing on first request.

import { validateEnv } from "@/lib/config/env-validation";
import { log } from "@/lib/observability/logger";

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const result = validateEnv(process.env);
  for (const issue of result.issues) {
    if (issue.level === "error") {
      log.error(`env_invalid:${issue.key}`, { reason: issue.reason });
    } else {
      log.warn(`env_warning:${issue.key}`, { reason: issue.reason });
    }
  }

  if (!result.ok && process.env.NODE_ENV === "production") {
    throw new Error(
      `Environment validation failed: ${result.issues
        .filter((i) => i.level === "error")
        .map((i) => `${i.key} ${i.reason}`)
        .join("; ")}`,
    );
  }
}

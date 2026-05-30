import { describe, expect, it } from "vitest";
import { pingDatabase } from "@/lib/storage/health-ping";

describe("pingDatabase", () => {
  it("returns skipped status in file mode", async () => {
    const result = await pingDatabase({ SLAPROOF_STORE: "file" });
    expect(result.checked).toBe(false);
    expect(result.ok).toBe(true);
  });

  it("returns ok when the query succeeds", async () => {
    const fakePool = { query: async () => ({ rows: [{ "?column?": 1 }] }) };
    const result = await pingDatabase(
      { SLAPROOF_STORE: "postgres", DATABASE_URL: "postgres://x" },
      () => fakePool as never,
    );
    expect(result.checked).toBe(true);
    expect(result.ok).toBe(true);
  });

  it("returns not-ok when the query throws", async () => {
    const fakePool = {
      query: async () => {
        throw new Error("connection refused");
      },
    };
    const result = await pingDatabase(
      { SLAPROOF_STORE: "postgres", DATABASE_URL: "postgres://x" },
      () => fakePool as never,
    );
    expect(result.checked).toBe(true);
    expect(result.ok).toBe(false);
  });
});

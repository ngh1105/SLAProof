import { describe, expect, it } from "vitest";
import {
  CURRENT_RECEIPT_VERSION,
  checkReceiptVersion,
  isSupportedReceiptVersion,
  SUPPORTED_RECEIPT_VERSIONS,
} from "@/lib/domain/receipt-versions";

describe("receipt-versions", () => {
  it("CURRENT_RECEIPT_VERSION is in the supported list", () => {
    expect(SUPPORTED_RECEIPT_VERSIONS).toContain(CURRENT_RECEIPT_VERSION);
  });

  it("isSupportedReceiptVersion accepts the current version", () => {
    expect(isSupportedReceiptVersion(CURRENT_RECEIPT_VERSION)).toBe(true);
  });

  it("isSupportedReceiptVersion rejects unknown versions", () => {
    expect(isSupportedReceiptVersion("slaproof.receipt.v99")).toBe(false);
    expect(isSupportedReceiptVersion("")).toBe(false);
    expect(isSupportedReceiptVersion(undefined)).toBe(false);
  });

  it("checkReceiptVersion ok when version matches", () => {
    const result = checkReceiptVersion({ version: CURRENT_RECEIPT_VERSION });
    expect(result.ok).toBe(true);
  });

  it("checkReceiptVersion reports missing when null/undefined", () => {
    expect(checkReceiptVersion(null)).toMatchObject({ ok: false, reason: "missing" });
    expect(checkReceiptVersion(undefined)).toMatchObject({ ok: false, reason: "missing" });
  });

  it("checkReceiptVersion reports unsupported on unknown version", () => {
    const result = checkReceiptVersion({ version: "slaproof.receipt.v99" } as never);
    expect(result).toMatchObject({ ok: false, reason: "unsupported", observed: "slaproof.receipt.v99" });
  });
});

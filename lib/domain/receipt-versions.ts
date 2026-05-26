import type { Receipt } from "./types";

export const SUPPORTED_RECEIPT_VERSIONS = ["slaproof.receipt.v0"] as const;
export type SupportedReceiptVersion = (typeof SUPPORTED_RECEIPT_VERSIONS)[number];

export const CURRENT_RECEIPT_VERSION: SupportedReceiptVersion = "slaproof.receipt.v0";

export function isSupportedReceiptVersion(version: unknown): version is SupportedReceiptVersion {
  return typeof version === "string" && SUPPORTED_RECEIPT_VERSIONS.includes(
    version as SupportedReceiptVersion,
  );
}

export type ReceiptVersionCheck =
  | { ok: true; version: SupportedReceiptVersion }
  | { ok: false; reason: "missing" | "unsupported"; observed: unknown };

export function checkReceiptVersion(receipt: { version?: unknown } | null | undefined): ReceiptVersionCheck {
  if (!receipt || receipt.version === undefined || receipt.version === null) {
    return { ok: false, reason: "missing", observed: receipt?.version };
  }
  if (!isSupportedReceiptVersion(receipt.version)) {
    return { ok: false, reason: "unsupported", observed: receipt.version };
  }
  return { ok: true, version: receipt.version };
}

export type WalletStatus =
  | { kind: "missing" }
  | { kind: "disconnected" }
  | { kind: "wrong-network"; account: `0x${string}` }
  | { kind: "connected"; account: `0x${string}`; chainId: number };

export type WalletErrorCode =
  | "WALLET_MISSING"
  | "WRONG_NETWORK"
  | "USER_REJECTED"
  | "UNKNOWN";

export class WalletError extends Error {
  public readonly code: WalletErrorCode;
  public readonly cause?: unknown;
  constructor(code: WalletErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = "WalletError";
    this.code = code;
    this.cause = cause;
  }
}

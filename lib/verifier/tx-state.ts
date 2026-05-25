import type { VerifierErrorCode } from "./types";

export type TxState =
  | { kind: "idle" }
  | { kind: "signing" }
  | { kind: "submitted"; txHash: `0x${string}` }
  | { kind: "pending"; txHash: `0x${string}` }
  | { kind: "delayed"; txHash: `0x${string}` }
  | { kind: "done"; txHash: `0x${string}` }
  | { kind: "failed"; code: VerifierErrorCode; message: string };

export type TxEvent =
  | { type: "START" }
  | { type: "SIGNED"; txHash: `0x${string}` }
  | { type: "AWAIT" }
  | { type: "FINALIZED" }
  | { type: "TIMEOUT" }
  | { type: "ERROR"; code: VerifierErrorCode; message: string }
  | { type: "RESET" };

export const initialTxState: TxState = { kind: "idle" };

export function txReduce(state: TxState, event: TxEvent): TxState {
  if (event.type === "RESET") return initialTxState;
  if (event.type === "ERROR") {
    return { kind: "failed", code: event.code, message: event.message };
  }
  switch (state.kind) {
    case "idle":
      if (event.type === "START") return { kind: "signing" };
      return state;
    case "signing":
      if (event.type === "SIGNED") return { kind: "submitted", txHash: event.txHash };
      return state;
    case "submitted":
      if (event.type === "AWAIT") return { kind: "pending", txHash: state.txHash };
      return state;
    case "pending":
      if (event.type === "FINALIZED") return { kind: "done", txHash: state.txHash };
      if (event.type === "TIMEOUT") return { kind: "delayed", txHash: state.txHash };
      return state;
    default:
      return state;
  }
}

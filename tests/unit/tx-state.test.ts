import { describe, expect, it } from "vitest";
import { initialTxState, txReduce } from "@/lib/verifier/tx-state";

const TX_HASH = ("0x" + "ab".repeat(32)) as `0x${string}`;

describe("txReduce", () => {
  it("idle -> signing on START", () => {
    expect(txReduce(initialTxState, { type: "START" })).toEqual({ kind: "signing" });
  });

  it("signing -> submitted on SIGNED", () => {
    expect(txReduce({ kind: "signing" }, { type: "SIGNED", txHash: TX_HASH })).toEqual({
      kind: "submitted",
      txHash: TX_HASH,
    });
  });

  it("submitted -> pending on AWAIT", () => {
    expect(
      txReduce({ kind: "submitted", txHash: TX_HASH }, { type: "AWAIT" }),
    ).toEqual({ kind: "pending", txHash: TX_HASH });
  });

  it("pending -> done on FINALIZED", () => {
    expect(
      txReduce({ kind: "pending", txHash: TX_HASH }, { type: "FINALIZED" }),
    ).toEqual({ kind: "done", txHash: TX_HASH });
  });

  it("pending -> delayed on TIMEOUT", () => {
    expect(
      txReduce({ kind: "pending", txHash: TX_HASH }, { type: "TIMEOUT" }),
    ).toEqual({ kind: "delayed", txHash: TX_HASH });
  });

  it("any state -> failed on ERROR", () => {
    const result = txReduce(
      { kind: "signing" },
      { type: "ERROR", code: "USER_REJECTED", message: "cancelled" },
    );
    expect(result).toMatchObject({ kind: "failed", code: "USER_REJECTED" });
  });

  it("ignores invalid transitions", () => {
    const state = { kind: "signing" } as const;
    expect(txReduce(state, { type: "FINALIZED" })).toEqual(state);
  });
});

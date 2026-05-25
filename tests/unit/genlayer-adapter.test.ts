import { describe, expect, it } from "vitest";
import { createGenLayerVerifier } from "@/lib/verifier/genlayer-adapter";
import { getDemoCase } from "@/lib/storage/case-store";

const ENV = {
  NEXT_PUBLIC_GENLAYER_RPC_URL: "https://studio.genlayer.com/api",
  NEXT_PUBLIC_SLAPROOF_CONTRACT_ADDRESS: "0x" + "a".repeat(40),
};

function withEnv<T>(values: Record<string, string>, fn: () => T): T {
  const prev: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(values)) {
    prev[k] = process.env[k];
    process.env[k] = v;
  }
  try {
    return fn();
  } finally {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

type FakeOpts = {
  txHash?: `0x${string}`;
  execResult?: "Success" | "Reverted";
  receipt?: unknown;
  writeThrows?: Error;
  waitThrows?: Error;
};

function fakeWriteClient(opts: FakeOpts = {}) {
  return {
    async writeContract() {
      if (opts.writeThrows) throw opts.writeThrows;
      return opts.txHash ?? ("0x" + "ab".repeat(32));
    },
    async waitForTransactionReceipt() {
      if (opts.waitThrows) throw opts.waitThrows;
      return {
        txExecutionResultName: opts.execResult ?? "Success",
        statusName: "Finalized",
      };
    },
    async readContract() {
      return opts.receipt ?? null;
    },
  };
}

describe("genlayer-adapter submitCase", () => {
  it("returns txHash when write succeeds", async () => {
    const fake = fakeWriteClient({ txHash: ("0x" + "de".repeat(32)) as `0x${string}` });
    await withEnv(ENV, async () => {
      const v = createGenLayerVerifier({
        readClientFactory: (async () => fake) as never,
        writeClientFactory: (async () => fake) as never,
      });
      const slaCase = getDemoCase("case-rpc-breach-001")!;
      const res = await v.submitCase!({ slaCase, walletClient: fake });
      expect(res.txHash).toBe("0x" + "de".repeat(32));
    });
  });

  it("maps user rejection (code 4001) to USER_REJECTED", async () => {
    const err = Object.assign(new Error("user rejected"), { code: 4001 });
    const fake = fakeWriteClient({ writeThrows: err });
    await withEnv(ENV, async () => {
      const v = createGenLayerVerifier({
        readClientFactory: (async () => fake) as never,
        writeClientFactory: (async () => fake) as never,
      });
      const slaCase = getDemoCase("case-rpc-breach-001")!;
      await expect(v.submitCase!({ slaCase, walletClient: fake })).rejects.toMatchObject({
        code: "USER_REJECTED",
      });
    });
  });

  it("maps generic rpc error to RPC_FAILED", async () => {
    const fake = fakeWriteClient({ writeThrows: new Error("ECONNRESET") });
    await withEnv(ENV, async () => {
      const v = createGenLayerVerifier({
        readClientFactory: (async () => fake) as never,
        writeClientFactory: (async () => fake) as never,
      });
      const slaCase = getDemoCase("case-rpc-breach-001")!;
      await expect(v.submitCase!({ slaCase, walletClient: fake })).rejects.toMatchObject({
        code: "RPC_FAILED",
      });
    });
  });
});

describe("genlayer-adapter waitForFinalization", () => {
  it("resolves on Success", async () => {
    const fake = fakeWriteClient({ execResult: "Success" });
    await withEnv(ENV, async () => {
      const v = createGenLayerVerifier({
        readClientFactory: (async () => fake) as never,
        writeClientFactory: (async () => fake) as never,
      });
      await expect(
        v.waitForFinalization!(("0x" + "ab".repeat(32)) as `0x${string}`),
      ).resolves.toBeUndefined();
    });
  });

  it("throws EXECUTION_FAILED on Reverted", async () => {
    const fake = fakeWriteClient({ execResult: "Reverted" });
    await withEnv(ENV, async () => {
      const v = createGenLayerVerifier({
        readClientFactory: (async () => fake) as never,
        writeClientFactory: (async () => fake) as never,
      });
      await expect(
        v.waitForFinalization!(("0x" + "ab".repeat(32)) as `0x${string}`),
      ).rejects.toMatchObject({ code: "EXECUTION_FAILED" });
    });
  });

  it("throws RPC_FAILED on wait error", async () => {
    const fake = fakeWriteClient({ waitThrows: new Error("network") });
    await withEnv(ENV, async () => {
      const v = createGenLayerVerifier({
        readClientFactory: (async () => fake) as never,
        writeClientFactory: (async () => fake) as never,
      });
      await expect(
        v.waitForFinalization!(("0x" + "ab".repeat(32)) as `0x${string}`),
      ).rejects.toMatchObject({ code: "RPC_FAILED" });
    });
  });
});

describe("genlayer-adapter getReceipt", () => {
  it("returns null when contract returns null", async () => {
    const fake = fakeWriteClient({ receipt: null });
    await withEnv(ENV, async () => {
      const v = createGenLayerVerifier({
        readClientFactory: (async () => fake) as never,
        writeClientFactory: (async () => fake) as never,
      });
      await expect(v.getReceipt("missing")).resolves.toBeNull();
    });
  });
});

"use client";

import { useReducer, useState } from "react";
import { useRouter } from "next/navigation";
import type { SlaCase } from "@/lib/domain/types";
import { useGenLayerWallet } from "@/lib/wallet/use-genlayer-wallet";
import { initialTxState, txReduce } from "@/lib/verifier/tx-state";
import { VerifierError } from "@/lib/verifier/types";
import { genlayerVerifierAdapter } from "@/lib/verifier/genlayer-adapter";

type Props = { slaCase: SlaCase };

export function SubmitPanel({ slaCase }: Props) {
  const wallet = useGenLayerWallet();
  const [state, dispatch] = useReducer(txReduce, initialTxState);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function onSubmit() {
    if (wallet.status.kind !== "connected") return;
    setBusy(true);
    dispatch({ type: "START" });
    try {
      const { txHash } = await genlayerVerifierAdapter.submitCase!({
        slaCase,
        walletClient: wallet.status.account,
      });
      dispatch({ type: "SIGNED", txHash });
      dispatch({ type: "AWAIT" });
      try {
        await genlayerVerifierAdapter.waitForFinalization!(txHash);
        dispatch({ type: "FINALIZED" });
        router.push(`/receipt/${slaCase.id}`);
      } catch (err) {
        if (err instanceof VerifierError && err.code === "TIMEOUT") {
          dispatch({ type: "TIMEOUT" });
        } else if (err instanceof VerifierError) {
          dispatch({ type: "ERROR", code: err.code, message: err.message });
        } else {
          dispatch({
            type: "ERROR",
            code: "UNKNOWN",
            message: String(err).slice(0, 200),
          });
        }
      }
    } catch (err) {
      const code = err instanceof VerifierError ? err.code : "UNKNOWN";
      const message = err instanceof Error ? err.message : String(err);
      dispatch({ type: "ERROR", code, message: message.slice(0, 200) });
    } finally {
      setBusy(false);
    }
  }

  if (wallet.status.kind === "missing") {
    return (
      <section className="panel">
        <h2>Submit to GenLayer</h2>
        <p style={{ color: "var(--muted)" }}>
          No wallet detected. Install a GenLayer-compatible wallet to submit cases on-chain.
        </p>
      </section>
    );
  }

  if (wallet.status.kind === "disconnected") {
    return (
      <section className="panel">
        <h2>Submit to GenLayer</h2>
        <button className="button" type="button" onClick={wallet.connect}>
          Connect wallet to submit
        </button>
      </section>
    );
  }

  if (wallet.status.kind === "wrong-network") {
    return (
      <section className="panel">
        <h2>Submit to GenLayer</h2>
        <button className="button" type="button" onClick={wallet.switchToExpected}>
          Switch to {wallet.network?.label ?? "Studionet"}
        </button>
      </section>
    );
  }

  return (
    <section className="panel" style={{ display: "grid", gap: 12 }}>
      <h2>Submit to GenLayer</h2>
      {state.kind === "idle" ? (
        <button className="button" type="button" onClick={onSubmit} disabled={busy}>
          Submit case
        </button>
      ) : null}
      {state.kind === "signing" ? <p>Waiting for wallet signature…</p> : null}
      {state.kind === "submitted" ? (
        <p>
          Submitted: <code>{state.txHash}</code>
        </p>
      ) : null}
      {state.kind === "pending" ? (
        <p>
          Awaiting finalization for <code>{state.txHash}</code>…
        </p>
      ) : null}
      {state.kind === "delayed" ? (
        <div>
          <p>Finalization is taking longer than expected.</p>
          <a className="ghost-button" href={`/receipt/${slaCase.id}`}>
            Open receipt page to refresh
          </a>
        </div>
      ) : null}
      {state.kind === "failed" ? (
        <div style={{ color: "var(--danger)" }}>
          <p>
            <strong>{state.code}</strong>: {state.message}
          </p>
          <button className="ghost-button" type="button" onClick={onSubmit} disabled={busy}>
            Retry
          </button>
        </div>
      ) : null}
    </section>
  );
}

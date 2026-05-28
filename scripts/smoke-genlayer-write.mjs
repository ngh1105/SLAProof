#!/usr/bin/env node
import { createClient, createAccount } from "genlayer-js";
import { studionet } from "genlayer-js/chains";

const CONTRACT = process.env.NEXT_PUBLIC_SLAPROOF_CONTRACT_ADDRESS;
const RPC = process.env.NEXT_PUBLIC_GENLAYER_RPC_URL;
const PK = process.env.GENLAYER_PRIVATE_KEY;

if (!CONTRACT || !RPC || !PK) {
  console.error(
    "Missing env: NEXT_PUBLIC_SLAPROOF_CONTRACT_ADDRESS, NEXT_PUBLIC_GENLAYER_RPC_URL, GENLAYER_PRIVATE_KEY",
  );
  process.exit(2);
}

const caseId = process.argv[2] ?? "case-rpc-smoke-001";
const payload = {
  version: "slaproof.case.v0",
  case_id: caseId,
  provider_name: "Smoke RPC",
  chain: "ethereum-mainnet",
  endpoint_label: "smoke",
  incident_window: {
    start_utc: "2026-05-22T10:00:00Z",
    end_utc: "2026-05-22T10:30:00Z",
  },
  incident_summary:
    "Sustained 5xx errors 18.6% of requests for 30 minutes during incident window.",
  sla_terms: {
    availability_target: "99.9% monthly",
    error_threshold: "5% for 5+ min",
    latency_threshold: "",
    exclusions: "",
    credit_rule: "",
  },
  evidence: [
    {
      id: "ev-1",
      type: "status_page",
      title: "Provider status page",
      source_url: "https://example.com/status",
      submitted_excerpt: "Provider reports sustained 5xx for 30 min, 18.6% errors.",
      hash: "",
    },
    {
      id: "ev-2",
      type: "monitoring_summary",
      title: "Internal probe",
      submitted_excerpt: "Probe shows 18% failures sustained 30 min in window.",
      hash: "",
    },
  ],
};

const account = createAccount(PK);
const client = createClient({ chain: studionet, account, endpoint: RPC });

console.log("submitting", caseId);
let txHash;
try {
  txHash = await client.writeContract({
    address: CONTRACT,
    functionName: "submit_case",
    args: [caseId, JSON.stringify(payload)],
    value: 0n,
  });
} catch (err) {
  console.error("write failed:", err?.message ?? err);
  process.exit(3);
}
console.log("txHash", txHash);

let receipt;
try {
  receipt = await client.waitForTransactionReceipt({
    hash: txHash,
    retries: 30,
    interval: 4000,
  });
} catch (err) {
  console.error("wait failed:", err?.message ?? err);
  process.exit(4);
}
console.log("status", receipt.statusName, "exec", receipt.txExecutionResultName);

if (receipt.txExecutionResultName !== "Success") {
  console.error("execution failed");
  process.exit(5);
}

let result;
try {
  result = await client.readContract({
    address: CONTRACT,
    functionName: "get_receipt",
    args: [caseId],
  });
} catch (err) {
  console.error("read failed:", err?.message ?? err);
  process.exit(6);
}

if (!result || (typeof result === "string" && result.trim() === "")) {
  console.error("missing receipt after finalization");
  process.exit(7);
}

console.log("receipt", typeof result === "string" ? result : JSON.stringify(result, null, 2));
process.exit(0);

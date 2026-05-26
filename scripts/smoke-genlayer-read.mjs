import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";

const rpcUrl = process.env.NEXT_PUBLIC_GENLAYER_RPC_URL;
const contractAddress = process.env.NEXT_PUBLIC_SLAPROOF_CONTRACT_ADDRESS;
const caseId = process.argv[2];

if (!rpcUrl) {
  console.error("NEXT_PUBLIC_GENLAYER_RPC_URL is required.");
  process.exit(1);
}

if (!contractAddress) {
  console.error("NEXT_PUBLIC_SLAPROOF_CONTRACT_ADDRESS is required.");
  process.exit(1);
}

if (!/^0x[0-9a-fA-F]{40}$/.test(contractAddress)) {
  console.error("NEXT_PUBLIC_SLAPROOF_CONTRACT_ADDRESS must be a valid 0x address.");
  process.exit(1);
}

if (!caseId) {
  console.error("Usage: node scripts/smoke-genlayer-read.mjs <case-id>");
  process.exit(1);
}

function isReceiptNotFound(err) {
  if (!err) return false;
  const message = err instanceof Error ? err.message : String(err);
  if (/receipt not found/i.test(message)) return true;
  // genlayer-js wraps the contract revert reason in cause.data.receipt.result as base64
  const cause = err && typeof err === "object" ? err.cause : null;
  const result = cause?.data?.receipt?.result;
  if (typeof result === "string") {
    try {
      const decoded = Buffer.from(result, "base64").toString("utf-8");
      if (/receipt not found/i.test(decoded)) return true;
    } catch {
      // ignore
    }
  }
  return false;
}

const client = createClient({ chain: studionet, endpoint: rpcUrl });

let raw;
try {
  raw = await client.readContract({
    address: contractAddress,
    functionName: "get_receipt",
    args: [caseId],
  });
} catch (err) {
  if (isReceiptNotFound(err)) {
    console.log(JSON.stringify({ case_id: caseId, status: "no_receipt" }, null, 2));
    process.exit(0);
  }
  throw err;
}

if (typeof raw !== "string" || raw.trim() === "") {
  console.log(JSON.stringify({ case_id: caseId, status: "no_receipt" }, null, 2));
  process.exit(0);
}

const receipt = JSON.parse(raw);
console.log(
  JSON.stringify(
    {
      case_id: receipt.case_id,
      decision: receipt.decision,
      confidence: receipt.confidence,
      receipt_hash: receipt.receipt_hash,
    },
    null,
    2,
  ),
);

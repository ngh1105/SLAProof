import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";

const contractAddress = process.env.NEXT_PUBLIC_SLAPROOF_CONTRACT_ADDRESS;
const caseId = process.argv[2];

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

const client = createClient({ chain: studionet });

const raw = await client.readContract({
  address: contractAddress,
  functionName: "get_receipt",
  args: [caseId],
});

if (typeof raw !== "string" || raw.trim() === "") {
  console.error(`No receipt returned for ${caseId}.`);
  process.exit(1);
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


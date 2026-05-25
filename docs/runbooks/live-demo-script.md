# Live Demo Script

Time: 5 minutes.

## Pre-demo checklist (1 minute before recording)

- Verifier env: `NEXT_PUBLIC_SLAPROOF_VERIFIER=genlayer`
- Studionet RPC reachable: `npm run smoke:genlayer:read case-rpc-breach-001`
- Wallet connected on Studionet
- Browser zoom 110%, no extensions visible besides wallet

## Script

1. Open dashboard at `/`. "Three seeded RPC incident cases."
2. Click `case-rpc-breach-001`. "Provider, chain, incident window, SLA terms,
   evidence."
3. Scroll to evidence. "Each excerpt is hashed client-side before submission."
4. Click **Submit case**. Wallet pops up. Sign.
5. Show submitted state with tx hash.
6. Wait ~30-60s for finalization. If delayed: "Receipt page has a manual
   refresh."
7. Auto-redirect to receipt page. Show: decision, contract address, network, tx
   hash, receipt hash.
8. Click Export JSON. "Audit-ready receipt for postmortem or vendor
   escalation."

## Recovery

- Wallet rejected → "User cancelled, retry."
- RPC failure → switch to mock mode for the rest of the demo: unset
  `NEXT_PUBLIC_SLAPROOF_VERIFIER`, restart dev.
- Tx finalization > 90s → narrate the `delayed` state and Refresh on receipt
  page.

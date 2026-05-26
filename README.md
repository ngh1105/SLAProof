# SLAProof

SLAProof is a GenLayer-backed verifier for Web3 infrastructure SLA incidents.
The first product focuses on RPC provider downtime and degraded service. It
turns scattered evidence, SLA clauses, and incident windows into auditable SLA
Breach Receipts.

## Product Thesis

Web3 teams rely on RPC providers, indexers, and data infrastructure, but when an
incident happens the proof trail is fragmented: status pages, logs, vendor
postmortems, screenshots, support replies, and internal incident timelines.

SLAProof uses GenLayer Intelligent Contracts to evaluate those evidence bundles
against the promised SLA and issue a receipt that answers:

- Did the provider breach the SLA?
- Which clause was violated?
- What evidence supports the verdict?
- How confident is the decision?
- What should the team ask for next: service credit, escalation, or more proof?

## MVP Scope

The MVP is receipt-first. It does not run continuous monitoring and it does not
move funds. Users create an SLA case, attach evidence, run a GenLayer verdict,
and export a signed JSON receipt.

## Local Demo

```bash
npm install
npm run dev
```

Open `http://localhost:3000` and use the seeded case queue. The first runnable
slice uses a deterministic mock verifier so the breach, no-breach,
inconclusive, and needs-more-evidence receipts are stable during demos.

Quality gate:

```bash
npm run verify:demo
npm run test:e2e
```

## Live GenLayer Mode

To run against the deployed `SlaProofRpcVerifier` on Studionet:

1. Copy `.env.local.example` to `.env.local`.
2. Set `NEXT_PUBLIC_SLAPROOF_VERIFIER=genlayer`.
3. Populate `NEXT_PUBLIC_SLAPROOF_CONTRACT_ADDRESS`,
   `NEXT_PUBLIC_GENLAYER_RPC_URL`, `NEXT_PUBLIC_SLAPROOF_NETWORK_LABEL`, and
   `NEXT_PUBLIC_SLAPROOF_CHAIN_ID`.
4. Connect a GenLayer-compatible wallet from the topbar.
5. Open a seeded case and click **Submit case**.

CLI smoke (no UI, server-side demo signer):

```bash
GENLAYER_PRIVATE_KEY=0x... \
NEXT_PUBLIC_SLAPROOF_CONTRACT_ADDRESS=0x... \
NEXT_PUBLIC_GENLAYER_RPC_URL=https://studio.genlayer.com/api \
npm run smoke:genlayer:write
```

## Documentation Map

- [Product Spec](docs/specs/2026-05-22-slaproof-product-spec.md)
- [Product Design](docs/design/01-product-design.md)
- [System Architecture](docs/architecture/01-system-architecture.md)
- [GenLayer Contract Spec](docs/architecture/02-genlayer-contract-spec.md)
- [Contract README](contracts/slaproof_rpc_verifier/README.md)
- [Demo Plan](docs/plans/01-demo-plan.md)
- [Production Roadmap](docs/plans/02-production-roadmap.md)
- [Implementation Plan](docs/plans/03-implementation-plan.md)
- [MVP Task Breakdown](docs/tasks/01-mvp-task-breakdown.md)
- [Production Readiness Checklist](docs/readiness/production-readiness-checklist.md)
- [GenLayer Deployment Runbook](docs/runbooks/genlayer-deployment.md)
- [Pilot Operator Guide](docs/runbooks/pilot-operator-guide.md)
- [Evidence Redaction Checklist](docs/templates/evidence-redaction-checklist.md)
- [Vendor Escalation Template](docs/templates/vendor-escalation.md)

## Positioning Guardrails

SLAProof intentionally avoids crowded GenLayer project territory:

- Not freelance escrow or job settlement.
- Not a generic on-chain court.
- Not a prediction market.
- Not a wallet risk scanner.
- Not a no-code contract builder.

Its narrow wedge is Web3 infrastructure incident verification, starting with RPC
SLA breach receipts.

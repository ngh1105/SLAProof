# Data Retention Policy

Date: 2026-05-26
Status: Pilot scope
Owner: app team

## Scope

Covers data the SLAProof app stores or processes during pilot. Production
policy needs separate legal review (GDPR, contractual SLAs with vendors).

## Data classes

| Class | Where | Sensitivity | Retention |
|---|---|---|---|
| Case JSON | `.data/db.json` | Medium | 90 days post-finalization |
| Audit log | `.data/audit.log.jsonl` | Medium | 365 days |
| Receipts on chain | GenLayer Studionet | Public by design | Permanent (chain) |
| App logs | stdout/stderr (file or aggregator) | Medium | 30 days |
| Pilot token | env + cookie | High | Rotate monthly |
| Wallet keys | browser wallet | Critical | Operator-managed |
| Evidence excerpts | inside Case JSON | High | Same as case |

## Retention rules

### Cases (`.data/db.json`)

- Active cases: kept indefinitely while pilot operator is using them
- Cases finalized (receipt read back) for 90+ days: candidate for archival
- Archival format: append to `.data/archive/cases-YYYY-QN.jsonl`
- No automated job yet — Phase 4 follow-up is a cron script

### Audit log (`.data/audit.log.jsonl`)

- Append-only, never edited
- Rotate when file exceeds 50 MB or every quarter, whichever comes first
- Rotation: rename to `audit.log.jsonl.YYYY-QN` and start a fresh file
- Retention: 365 days from rotation date, then delete

### App logs

- Default sink writes to stdout/stderr
- When shipped to aggregator, retain 30 days hot, 90 days cold
- Never log evidence excerpts (see threat model T8)

### On-chain receipts

- Cannot be deleted (GenLayer immutability is the product, not a bug)
- "Removing" a receipt means: redeploy contract, leave old address unreferenced
- App keeps the previous contract address in the runbook so historical receipts
  remain readable

## Deletion requests

For pilot operators only — production needs a formal DSAR process.

### Case deletion

```bash
# 1. Locate case
jq '.[] | select(.id=="case-rpc-xyz")' .data/db.json

# 2. Append audit entry first (preserves trail)
node -e 'require("./lib/audit/audit-log").appendAudit({action:"case_failed",caseId:"case-rpc-xyz",actor:"admin",details:{reason:"deletion request"}})'

# 3. Remove from db.json
jq '[.[] | select(.id != "case-rpc-xyz")]' .data/db.json > .data/db.json.tmp
mv .data/db.json.tmp .data/db.json

# 4. NOTE: on-chain receipt at the deployed contract cannot be deleted
```

### Audit log redaction

Append-only — do not edit lines. To redact, append a `case_failed` entry with
`reason: "redaction request"` referencing the original `caseId`. Downstream
tooling treats redaction entries as superseding the original.

## Backups

Pilot has none. File store is single-host. **Production blocker** — flagged in
production-readiness checklist.

## Encryption

- At rest: relies on host disk encryption (operator responsibility)
- In transit: HTTPS to Studionet RPC; cookies marked `secure` in production
- Pilot does **not** encrypt `.data/*` files application-side

## Review cadence

- Quarterly: confirm rotation script ran, archive directory size healthy
- Per deletion request: log in audit trail, confirm chain receipt status
- Annually: re-read this policy alongside the threat model

## Out of scope (production policy)

- Right-to-be-forgotten compliance (GDPR Art. 17)
- Subject access requests (DSAR)
- Cross-border data transfer rules
- Backup encryption + key management
- Immutable backup storage (WORM)
- Legal hold workflow

## References

- Threat model: `docs/security/threat-model-pilot.md`
- Audit log module: `lib/audit/audit-log.ts`
- Pilot operator guide: `docs/runbooks/pilot-operator-guide.md`

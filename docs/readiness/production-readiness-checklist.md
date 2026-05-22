# Production Readiness Checklist

## Product Claims

- The app says "SLA breach receipt" instead of "legal judgment".
- The app distinguishes public evidence from user-submitted excerpts.
- Inconclusive outcomes explain missing evidence.
- Exported receipts include confidence and limitations.
- Product copy does not imply automatic payout or enforceability.

## Security

- Secrets are never stored in frontend code.
- Users are warned not to paste private keys, API keys, or sensitive customer
  data into evidence fields.
- Evidence uploads and excerpts have size limits.
- Auth protects non-public workspaces.
- Rate limits protect case creation and GenLayer submission.
- Receipt exports redact private workspace metadata.
- Dependencies are audited before production release.

## Privacy And Data Retention

- Data retention policy is documented.
- Users can delete draft cases.
- Final contract receipts are treated as public or semi-public artifacts.
- Private logs are not sent to the contract by default.
- Pasted excerpts are hashed and labeled.

## Reliability

- Draft cases survive page reload.
- GenLayer write failures are retryable.
- Delayed finalization has a clear pending state.
- Contract read-back is required before showing finalized receipt.
- App has health endpoint.
- App has error tracking.
- App has structured logs for case lifecycle events.

## Contract Quality

- Contract methods are documented.
- Contract payload schema is versioned.
- Direct tests cover valid and invalid payloads.
- Tests cover breach, no breach, inconclusive, and needs more evidence.
- GenVM lint passes.
- Deployment runbook exists.
- Contract address and network are visible in the app.

## Data Integrity

- Case ids are unique.
- Evidence ids are unique per case.
- Timestamps are normalized to UTC.
- Receipt hash is deterministic.
- Receipt version is included.
- Exported JSON validates against schema.

## Operations

- Production deploy runbook exists.
- Rollback process exists.
- Database backup and restore process exists.
- Incident response contact is defined.
- Manual case recovery process exists.
- GenLayer RPC outage fallback is documented.

## Observability

- Track case created.
- Track evidence added.
- Track submit started.
- Track GenLayer transaction accepted.
- Track receipt read success.
- Track receipt read failure.
- Track export generated.
- Monitor error rate, latency, and failed contract reads.

## Pilot Gate

Before a real pilot:

- Use a managed database.
- Protect workspace access.
- Provide evidence redaction guidance.
- Run at least three realistic incident cases.
- Review product language for legal overclaiming.
- Verify live GenLayer receipt read-back.
- Document known limitations.

## Production Gate

Before public production:

- Complete security review.
- Complete threat model.
- Complete contract audit or focused review.
- Establish backup and restore.
- Establish monitoring and alerting.
- Establish support and incident response.
- Establish data retention and deletion policy.


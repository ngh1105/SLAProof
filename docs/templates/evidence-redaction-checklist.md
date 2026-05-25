# Evidence Redaction Checklist

Before submitting evidence to SLAProof, remove or replace sensitive material.

## Remove

- API keys and bearer tokens.
- Private RPC URLs that contain credentials.
- Customer names, emails, IP addresses, or support identifiers.
- Internal chat unrelated to the incident.
- Raw logs that include user payloads.
- Screenshots with secrets in browser tabs, headers, or sidebars.

## Keep

- UTC timestamps.
- Request totals.
- Error-rate percentages.
- Latency percentiles.
- Public status page links.
- Vendor postmortem links.
- Short support-ticket excerpts relevant to the incident.
- Evidence hashes.

## Replace With Placeholders

- Customer identifiers -> `[customer-redacted]`
- Internal hostnames -> `[internal-host-redacted]`
- API credentials -> `[secret-redacted]`
- Private URLs -> `[private-url-redacted]`

## Final Check

Before export, ask:

- Could this receipt be shared with a vendor?
- Could this receipt be pasted into a governance forum?
- Would a leaked copy expose secrets or customer data?
- Are all timestamps still specific enough after redaction?


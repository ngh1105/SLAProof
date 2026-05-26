# Security

## Reporting a vulnerability

Email: open a private GitHub security advisory at
<https://github.com/ngh1105/SLAProof/security/advisories/new> (preferred) or
file a regular issue tagged `security` if you cannot use advisories.

Please include:

- Vulnerability description
- Affected files / endpoints / contract addresses
- Reproduction steps
- Potential impact
- Suggested remediation if you have one

Do **not** open a public issue with exploit details before we've had a chance
to respond.

## Response timeline

| Severity | First response | Mitigation target |
|---|---|---|
| Critical (exploitable, data loss, key exposure) | 24 hours | 7 days |
| High (auth/authorization bypass, RCE on validator) | 72 hours | 14 days |
| Medium / Low | 1 week | best-effort |

Pilot is single-maintainer. Severity ladder is aspirational and may slip on
holidays.

## In scope

- Web application code in this repository
- GenLayer contract `SlaProofRpcVerifier` deployed at addresses listed in
  `docs/runbooks/genlayer-deployment.md`
- Default configuration in `.env.local.example`

## Out of scope

- Vulnerabilities in `genlayer-js`, `next`, `react`, `viem`, or other upstream
  dependencies (report those upstream)
- Third-party RPC endpoints (Studio Network, Bradbury, etc.)
- Issues that require physical access to the operator's machine
- Social engineering / phishing
- Best-practice violations without a concrete exploit
- Browser zero-days

## Threat model

The full pilot threat model is in `docs/security/threat-model-pilot.md`. It
enumerates 8 known threats (T1-T8) with mitigations and residual risk.

## Disclosure policy

We aim for coordinated disclosure once a fix is shipped. We'll credit the
reporter unless they ask to remain anonymous.

## Contact

GitHub: [@ngh1105](https://github.com/ngh1105)

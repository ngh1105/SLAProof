# GenLayer Deployment Runbook

This runbook is for the first live deployment of `SlaProofRpcVerifier`.

## Deployed Addresses

| Network | Contract | Tx hash | Deployed |
|---|---|---|---|
| Studionet | `0x419D67e92855B94C0BF997638963961CA0A5dBC9` | `0xaeabf7d8737ae32a20164263c33776f6e0c87da924e692c96638604ffd9b8900` | 2026-05-26 |

Studionet chain id: `61999`. RPC: `https://studio.genlayer.com/api`.
Validator round: 5/5 AGREE, status ACCEPTED.

## Current Status

The contract package is ready for local deterministic checks:

```powershell
py -3 -m pytest contracts\slaproof_rpc_verifier
py -3 -m py_compile contracts\slaproof_rpc_verifier\main.py contracts\slaproof_rpc_verifier\evaluator.py
```

`genvm-lint` exists in two local Python installs. PATH prefers a stale Python
3.14 shim that exits without useful diagnostics. The Python 3.12 shim works for
AST lint with UTF-8 output enabled, but full validation currently fails to load
the SDK with `HTTP Error 404: Not Found`.

Working AST lint command:

```powershell
$env:PYTHONIOENCODING='utf-8'
$env:PYTHONUTF8='1'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()
& 'C:\Users\Admin\AppData\Local\Programs\Python\Python312\Scripts\genvm-lint.exe' lint contracts\slaproof_rpc_verifier\main.py
```

Do not treat the contract as deploy-ready until full `genvm-lint check` passes
or the contract is validated in a clean GenLayer SDK environment.

## Environment Variables

Frontend live mode expects:

```env
NEXT_PUBLIC_SLAPROOF_VERIFIER=genlayer
NEXT_PUBLIC_GENLAYER_RPC_URL=https://studio.genlayer.com/api
NEXT_PUBLIC_SLAPROOF_NETWORK_LABEL=Studionet
NEXT_PUBLIC_SLAPROOF_CONTRACT_ADDRESS=0x...
```

## Pre-Deploy Checklist

- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build`
- `npm run test:e2e`
- `py -3 -m pytest contracts\slaproof_rpc_verifier`
- `py -3 -m py_compile contracts\slaproof_rpc_verifier\main.py contracts\slaproof_rpc_verifier\evaluator.py`
- `genvm-lint check contracts\slaproof_rpc_verifier\main.py`

## Deploy Steps

1. Repair or reinstall the GenVM lint environment.
2. Run `genvm-lint check contracts\slaproof_rpc_verifier\main.py`.
3. Configure GenLayer CLI for the target network.
4. Deploy the contract:

   ```powershell
   genlayer deploy --contract contracts\slaproof_rpc_verifier\main.py
   ```

5. Copy the deployed contract address into `.env.local` as
   `NEXT_PUBLIC_SLAPROOF_CONTRACT_ADDRESS`.
6. Start the app in live readiness mode:

   ```powershell
   $env:NEXT_PUBLIC_SLAPROOF_VERIFIER="genlayer"
   npm run dev -- --hostname 127.0.0.1 --port 3307
   ```

7. Confirm the dashboard shows `genlayer` mode and no readiness issues.
8. Run a read/write smoke only after the `genlayer-js` submit/read path has
   replaced the current gated adapter stub.

Read smoke after at least one case exists on the deployed contract:

```powershell
$env:NEXT_PUBLIC_SLAPROOF_CONTRACT_ADDRESS="0x..."
npm run smoke:genlayer:read -- case_rpc_breach_001
```

## Rollback

If a live deployment is wrong:

- Remove `NEXT_PUBLIC_SLAPROOF_CONTRACT_ADDRESS` from the app environment.
- Set `NEXT_PUBLIC_SLAPROOF_VERIFIER=mock`.
- Rebuild/redeploy the frontend.
- Keep the broken address in deployment notes for audit context.

## Notes For Next Implementation Phase

The app already prepares the `slaproof.case.v0` JSON payload through
`toContractCaseJson` and can read `get_receipt(case_id)` through `genlayer-js`.
The next code phase should add:

- Wallet or demo signer connection.
- `submit_case(case_id, case_json)` write.
- Error categories for missing env, rejected signature, RPC failure, pending
  finalization, and missing contract state.

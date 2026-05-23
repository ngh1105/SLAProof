# SLAProof RPC Verifier Contract

`SlaProofRpcVerifier` stores compact JSON receipts for RPC SLA incident cases.
The contract accepts serialized case payloads, evaluates a breach verdict, stores
the receipt by case id, and exposes read-back methods for the app.

## Methods

- `submit_case(case_id, case_json)` writes and returns a receipt JSON string.
- `get_receipt(case_id)` reads the stored receipt JSON.
- `list_case_ids()` lists submitted case ids.

## Local Checks

```powershell
py -3 -m pytest contracts\slaproof_rpc_verifier
py -3 -m py_compile contracts\slaproof_rpc_verifier\main.py
genvm-lint check contracts\slaproof_rpc_verifier\main.py
```

The pure-Python `evaluator.py` mirrors deterministic validation and receipt
copy so tests can run without the GenLayer runtime.

## Current Local Lint Note

On this Windows machine, `genvm-lint.exe` is present but exits with code 1 and
no diagnostics because its backing Python 3.14 runtime is not available through
the launcher. Until that environment is repaired, the contract phase is gated by
`pytest` and `py_compile`.

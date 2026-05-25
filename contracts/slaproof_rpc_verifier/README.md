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

On this Windows machine, PATH prefers a stale Python 3.14 `genvm-lint.exe` shim.
The Python 3.12 shim works when UTF-8 output is enabled:

```powershell
$env:PYTHONIOENCODING='utf-8'
$env:PYTHONUTF8='1'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()
& 'C:\Users\Admin\AppData\Local\Programs\Python\Python312\Scripts\genvm-lint.exe' lint contracts\slaproof_rpc_verifier\main.py
```

Current result:

- AST lint passes.
- Full `genvm-lint check` reaches validation but fails to load the SDK with
  `HTTP Error 404: Not Found`.

Until that SDK download path is repaired, the contract phase is gated by pytest,
py_compile, and AST lint.

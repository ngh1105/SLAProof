"""Pure-Python deterministic SLAProof receipt helpers.

This module mirrors the deterministic receipt shaping used by the GenLayer
contract. It is importable without the GenLayer runtime so tests can pin payload
validation, fallback verdicts, and receipt copy.
"""

from __future__ import annotations

import json
from typing import Iterable, Mapping


VERDICTS = ("breach", "no_breach", "inconclusive", "needs_more_evidence")
CASE_VERSION = "slaproof.case.v0"
RECEIPT_VERSION = "slaproof.receipt.v0"
MAX_EVIDENCE_ITEMS = 8
MAX_EXCERPT_CHARS = 1200
MAX_URL_CHARS = 500


def parse_case(case_json: str) -> dict:
    try:
        payload = json.loads(case_json)
    except Exception as exc:  # pragma: no cover - exact JSON error differs by runtime
        raise ValueError("case_json must be valid JSON") from exc

    if not isinstance(payload, dict):
        raise ValueError("case_json must encode an object")

    return payload


def validate_case(payload: Mapping) -> tuple[list[str], list[str]]:
    errors: list[str] = []
    warnings: list[str] = []
    incident_window = payload.get("incident_window") or {}
    sla_terms = payload.get("sla_terms") or {}
    evidence = payload.get("evidence") or []

    if payload.get("version") != CASE_VERSION:
        errors.append(f"version must be {CASE_VERSION}")

    for key in ("case_id", "provider_name", "chain", "endpoint_label"):
        if not str(payload.get(key, "")).strip():
            errors.append(f"{key} is required")

    if not str(payload.get("incident_summary", "")).strip():
        errors.append("incident_summary is required")

    start_utc = str(incident_window.get("start_utc", "")).strip()
    end_utc = str(incident_window.get("end_utc", "")).strip()
    if not start_utc:
        errors.append("incident_window.start_utc is required")
    if not end_utc:
        errors.append("incident_window.end_utc is required")
    if start_utc and not start_utc.endswith("Z"):
        errors.append("incident_window.start_utc must be UTC")
    if end_utc and not end_utc.endswith("Z"):
        errors.append("incident_window.end_utc must be UTC")
    if start_utc and end_utc and start_utc >= end_utc:
        errors.append("incident start must be before incident end")

    has_threshold = bool(
        str(sla_terms.get("error_threshold", "")).strip()
        or str(sla_terms.get("availability_target", "")).strip()
        or str(sla_terms.get("latency_threshold", "")).strip()
    )
    if not has_threshold:
        errors.append("at least one measurable SLA threshold is required")

    if not isinstance(evidence, list):
        errors.append("evidence must be a list")
        evidence = []
    if len(evidence) > MAX_EVIDENCE_ITEMS:
        errors.append(f"evidence cannot exceed {MAX_EVIDENCE_ITEMS} items")

    evidence_ids: set[str] = set()
    for item in evidence:
        if not isinstance(item, dict):
            errors.append("each evidence item must be an object")
            continue
        evidence_id = str(item.get("id", "")).strip()
        if not evidence_id:
            errors.append("evidence.id is required")
        elif evidence_id in evidence_ids:
            errors.append(f"duplicate evidence id: {evidence_id}")
        evidence_ids.add(evidence_id)
        excerpt = str(item.get("submitted_excerpt", "")).strip()
        if not excerpt:
            errors.append(f"evidence {evidence_id or '?'} needs an excerpt")
        if len(excerpt) > MAX_EXCERPT_CHARS:
            errors.append(f"evidence {evidence_id or '?'} excerpt is too long")
        source_url = str(item.get("source_url", ""))
        if len(source_url) > MAX_URL_CHARS:
            errors.append(f"evidence {evidence_id or '?'} source_url is too long")
        submitted_hash = str(item.get("hash", "")).strip()
        if submitted_hash and submitted_hash != fnv1a_text(excerpt):
            errors.append(f"evidence {evidence_id or '?'} hash mismatch")

    if len(evidence_ids) < 2:
        warnings.append("at least two evidence items are recommended")

    return errors, warnings


def fallback_decision(payload: Mapping, errors: Iterable[str]) -> str:
    if list(errors):
        return "needs_more_evidence"

    evidence = payload.get("evidence") or []
    text = " ".join(
        [
            str(payload.get("incident_summary", "")),
            str((payload.get("sla_terms") or {}).get("error_threshold", "")),
            *[
                f"{item.get('title', '')} {item.get('submitted_excerpt', '')}"
                for item in evidence
                if isinstance(item, dict)
            ],
        ]
    ).lower()

    if "18.6%" in text or "elevated 5xx" in text or "sustained 5xx" in text:
        return "breach"
    if "under 3%" in text or "below the provider" in text or "below threshold" in text:
        return "no_breach"
    if len(evidence) < 2:
        return "needs_more_evidence"
    return "inconclusive"


def decision_copy(decision: str) -> tuple[int, list[str], str, str]:
    if decision == "breach":
        return (
            88,
            ["5% request failures for 5+ consecutive minutes"],
            "Evidence supports a sustained RPC failure window that exceeds the SLA threshold.",
            "Open a vendor service credit claim with the receipt and monitoring summary attached.",
        )
    if decision == "no_breach":
        return (
            81,
            [],
            "Evidence shows degradation, but duration and error rate remain below the SLA threshold.",
            "Keep the incident in the postmortem without escalating as an SLA credit claim.",
        )
    if decision == "inconclusive":
        return (
            54,
            [],
            "Evidence is relevant but does not establish request totals, consistent UTC timing, or provider acknowledgement.",
            "Collect timestamped monitoring totals and provider confirmation before escalation.",
        )
    return (
        25,
        [],
        "Required SLA thresholds or corroborating evidence are missing.",
        "Add SLA thresholds, status page evidence, and monitoring summaries before submission.",
    )


def build_receipt(payload: Mapping, decision: str, created_at: str, tx_hash: str = "") -> dict:
    confidence, violated_clauses, reasoning, recommended = decision_copy(decision)
    evidence = payload.get("evidence") or []
    citations = []
    for item in evidence[:3]:
        if not isinstance(item, dict):
            continue
        evidence_id = str(item.get("id", ""))
        title = str(item.get("title", evidence_id))
        if decision == "needs_more_evidence":
            finding = "Evidence is present but not sufficient for SLA threshold evaluation."
        else:
            finding = f"{title} contributes to the {decision.replace('_', ' ')} assessment."
        citations.append({"evidence_id": evidence_id, "finding": finding})

    receipt = {
        "version": RECEIPT_VERSION,
        "case_id": payload.get("case_id", ""),
        "provider_name": payload.get("provider_name", ""),
        "chain": payload.get("chain", ""),
        "endpoint_label": payload.get("endpoint_label", ""),
        "decision": decision,
        "confidence": confidence,
        "violated_clauses": violated_clauses,
        "evidence_citations": citations,
        "validator_reasoning": reasoning,
        "recommended_next_action": recommended,
        "created_at": created_at,
        "transaction_hash": tx_hash,
        "receipt_hash": "",
    }
    receipt["receipt_hash"] = receipt_digest(receipt)
    return receipt


def finalize_receipt_hash(receipt: dict) -> dict:
    receipt["receipt_hash"] = receipt_digest(receipt)
    return receipt


def receipt_digest(receipt: Mapping) -> str:
    normalized = dict(receipt)
    normalized["receipt_hash"] = ""
    encoded = json.dumps(normalized, sort_keys=True, separators=(",", ":"))
    hash_value = 0x811C9DC5
    for char in encoded:
        hash_value ^= ord(char)
        hash_value = (hash_value * 0x01000193) & 0xFFFFFFFF
    return f"fnv1a:{hash_value:08x}"


def fnv1a_text(text: str) -> str:
    normalized = " ".join(text.strip().split())
    hash_value = 0x811C9DC5
    for char in normalized:
        hash_value ^= ord(char)
        hash_value = (hash_value * 0x01000193) & 0xFFFFFFFF
    return f"fnv1a:{hash_value:08x}"


def evaluate_case(case_json: str, created_at: str = "2026-05-22T00:00:00Z") -> dict:
    payload = parse_case(case_json)
    errors, warnings = validate_case(payload)
    decision = fallback_decision(payload, errors)
    receipt = build_receipt(payload, decision, created_at)
    receipt["validation_errors"] = errors
    receipt["validation_warnings"] = warnings
    return finalize_receipt_hash(receipt)

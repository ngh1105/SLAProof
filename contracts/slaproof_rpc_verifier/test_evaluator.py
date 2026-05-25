import json

import pytest

from evaluator import evaluate_case, fnv1a_text, parse_case, receipt_digest, validate_case


def case_payload(**overrides):
    payload = {
        "version": "slaproof.case.v0",
        "case_id": "case_rpc_breach_001",
        "provider_name": "Northstar RPC",
        "chain": "ethereum-mainnet",
        "endpoint_label": "prod-read-primary",
        "incident_window": {
            "start_utc": "2026-05-22T10:05:00Z",
            "end_utc": "2026-05-22T10:42:00Z",
        },
        "incident_summary": "Production reads saw sustained 5xx responses.",
        "sla_terms": {
            "availability_target": "99.9% monthly availability",
            "error_threshold": "5% request failures for 5+ consecutive minutes",
            "latency_threshold": "p95 under 1000ms",
            "exclusions": "planned maintenance",
            "credit_rule": "10% service credit",
        },
        "evidence": [
            {
                "id": "ev_status",
                "type": "status_page",
                "title": "Provider status page incident",
                "submitted_excerpt": "Investigating elevated 5xx errors from 10:03 UTC to 10:48 UTC.",
                "hash": fnv1a_text(
                    "Investigating elevated 5xx errors from 10:03 UTC to 10:48 UTC."
                ),
            },
            {
                "id": "ev_monitor",
                "type": "monitoring_summary",
                "title": "Internal probe summary",
                "submitted_excerpt": "18.6% request failures between 10:05 UTC and 10:42 UTC.",
                "hash": fnv1a_text(
                    "18.6% request failures between 10:05 UTC and 10:42 UTC."
                ),
            },
        ],
    }
    payload.update(overrides)
    return payload


def test_parse_case_rejects_invalid_json():
    with pytest.raises(ValueError):
        parse_case("{not-json")


def test_validate_case_accepts_complete_payload():
    errors, warnings = validate_case(case_payload())

    assert errors == []
    assert warnings == []


def test_validate_case_reports_missing_thresholds():
    payload = case_payload(
        sla_terms={
            "availability_target": "",
            "error_threshold": "",
            "latency_threshold": "",
        }
    )

    errors, warnings = validate_case(payload)

    assert "at least one measurable SLA threshold is required" in errors
    assert warnings == []


def test_validate_case_reports_unsupported_version_and_bad_window():
    payload = case_payload(
        version="slaproof.case.v9",
        incident_window={
            "start_utc": "2026-05-22T10:42:00Z",
            "end_utc": "2026-05-22T10:05:00Z",
        },
    )

    errors, _warnings = validate_case(payload)

    assert "version must be slaproof.case.v0" in errors
    assert "incident start must be before incident end" in errors


def test_validate_case_reports_duplicate_ids_and_hash_mismatch():
    payload = case_payload(
        evidence=[
            {
                "id": "ev_dup",
                "type": "status_page",
                "title": "Provider status page incident",
                "submitted_excerpt": "Investigating elevated 5xx errors.",
                "hash": "fnv1a:wrong",
            },
            {
                "id": "ev_dup",
                "type": "monitoring_summary",
                "title": "Internal probe summary",
                "submitted_excerpt": "18.6% request failures.",
            },
        ]
    )

    errors, _warnings = validate_case(payload)

    assert "duplicate evidence id: ev_dup" in errors
    assert "evidence ev_dup hash mismatch" in errors


def test_evaluate_case_returns_breach_receipt():
    receipt = evaluate_case(json.dumps(case_payload()))

    assert receipt["decision"] == "breach"
    assert receipt["confidence"] == 88
    assert receipt["violated_clauses"] == ["5% request failures for 5+ consecutive minutes"]
    assert receipt["evidence_citations"]
    assert receipt["receipt_hash"] == receipt_digest(receipt)


def test_evaluate_case_returns_no_breach():
    payload = case_payload(
        case_id="case_rpc_no_breach_001",
        incident_summary="Short degradation stayed below threshold.",
        evidence=[
            {
                "id": "ev_status",
                "type": "status_page",
                "title": "Status note",
                "submitted_excerpt": "Brief degraded performance; error rate remained under 3%.",
                "hash": fnv1a_text("Brief degraded performance; error rate remained under 3%."),
            },
            {
                "id": "ev_monitor",
                "type": "monitoring_summary",
                "title": "Probe summary",
                "submitted_excerpt": "Failure rate stayed below threshold.",
                "hash": fnv1a_text("Failure rate stayed below threshold."),
            },
        ],
    )

    receipt = evaluate_case(json.dumps(payload))

    assert receipt["decision"] == "no_breach"
    assert receipt["violated_clauses"] == []


def test_evaluate_case_returns_inconclusive():
    payload = case_payload(
        case_id="case_rpc_inconclusive_001",
        incident_summary="Reports suggest stale reads but no provider acknowledgement.",
        evidence=[
            {
                "id": "ev_community",
                "type": "community_report",
                "title": "Community thread",
                "submitted_excerpt": "Reports use mixed local timezones and no request totals.",
                "hash": fnv1a_text("Reports use mixed local timezones and no request totals."),
            },
            {
                "id": "ev_sample",
                "type": "error_sample",
                "title": "Sample stale response",
                "submitted_excerpt": "Ten calls lagged by 35 blocks, total volume unavailable.",
                "hash": fnv1a_text("Ten calls lagged by 35 blocks, total volume unavailable."),
            },
        ],
    )

    receipt = evaluate_case(json.dumps(payload))

    assert receipt["decision"] == "inconclusive"
    assert receipt["confidence"] == 54


def test_evaluate_case_returns_needs_more_evidence_for_invalid_payload():
    payload = case_payload(
        case_id="case_rpc_missing_001",
        sla_terms={
            "availability_target": "",
            "error_threshold": "",
            "latency_threshold": "",
        },
        evidence=[
            {
                "id": "ev_note",
                "type": "other",
                "title": "Operator note",
                "submitted_excerpt": "Users reported failures but no probe summary is attached.",
                "hash": fnv1a_text("Users reported failures but no probe summary is attached."),
            }
        ],
    )

    receipt = evaluate_case(json.dumps(payload))

    assert receipt["decision"] == "needs_more_evidence"
    assert receipt["validation_errors"]
    assert receipt["validation_warnings"] == ["at least two evidence items are recommended"]

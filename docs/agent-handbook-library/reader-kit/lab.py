#!/usr/bin/env python3
"""Offline teaching checks: no provider, ports, persistence, account, or networking."""
from __future__ import annotations

import argparse
import json
from datetime import date
from pathlib import Path

CASES = Path(__file__).with_name("lab-cases.json")


def eligible_documents(record):
    cutoff = date.fromisoformat(record["as_of"])
    eligible = []
    for item in record["documents"]:
        if item["scope"] != record["scope"]:
            continue
        if date.fromisoformat(item["published"]) > cutoff:
            continue
        if item["state"] != "read" or not item["locator"] or not item["effective"]:
            continue
        if date.fromisoformat(item["effective"]) > cutoff:
            continue
        eligible.append({k: item[k] for k in ("id", "locator", "text")})
    return eligible


def settle(record):
    if record["effect"] == "unknown":
        return "reconcile-before-considering-retry"
    if record["run"] == "cancelled":
        return "stop-and-keep-already-saved-body"
    if record["body"] == "saved":
        return "reopen-same-artifact"
    if record["run"] == "completed":
        return "investigate-missing-artifact-not-success"
    if record["effect"] == "not-dispatched":
        return "check-admission-and-user-intent-before-new-attempt"
    return "inspect-effect-receipt"


def grade(row):
    criteria = {
        "delivery": row["saved"] and row["readback_matches"],
        "date_content": row["statement"] == row["expected"],
        "evidence_locator_present": bool(row["evidence_locator"]),
    }
    return {**criteria, "review_ready": all(criteria.values())}


def review_proposal(row):
    """Read-only admission lab. Roles and workspace come from the simulated session."""
    fields = {
        "search-handbook": {"workspace", "query"},
        "update-handbook": {"workspace", "draft_id"},
    }.get(row["family"])
    if fields is None or row["schema"] != 1:
        return "unsupported-contract"
    args = row["args"]
    if not isinstance(args, dict) or set(args) != fields:
        return "invalid-arguments"
    if not all(isinstance(v, str) and v.strip() for v in args.values()):
        return "invalid-arguments"
    if args["workspace"] != row["workspace"]:
        return "deny-outside-workspace"
    if row["family"] == "update-handbook":
        return "approval-required" if row["role"] == "editor" else "deny-role"
    return "ready-for-read" if row["role"] in {"editor", "viewer"} else "deny-role"


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("lab", choices=("admission", "source", "settlement", "grading", "all"))
    args = p.parse_args()
    data = json.loads(CASES.read_text(encoding="utf-8"))
    proposals = {}
    for row in data["proposal_cases"]:
        actual = review_proposal(row)
        if actual != row["expected"]:
            raise ValueError(f"{row['id']}: expected {row['expected']}, got {actual}")
        proposals[row["id"]] = actual
    checks = {
        "admission": proposals,
        "source": eligible_documents(data["material_readback"]),
        "settlement": {r["id"]: settle(r) for r in data["dispatch_settlement"]},
        "grading": {r["id"]: grade(r) for r in data["grading_cases"]},
    }
    print(json.dumps(checks if args.lab == "all" else checks[args.lab], ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

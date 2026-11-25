"""Phase 5 tests: OR-Tools resource allocation and baseline comparison."""

from __future__ import annotations

import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from app.main import reset_scenario, run_resource_allocation  # noqa: E402


def test_allocation_respects_verification_capability_and_compares_baseline() -> None:
    reset_scenario()
    res = run_resource_allocation()
    assert "human_review_note" in res
    opt = res["optimised"]
    base = res["baseline"]

    # Verified incidents (inc-101..105) should be assigned; inc-106 (unverified) must remain unassigned
    assigned_ids = {a["incident_id"] for a in opt["assignments"]}
    assert "inc-106" not in assigned_ids
    unassigned_ids = {u["incident_id"] for u in opt["unassigned"]}
    assert "inc-106" in unassigned_ids
    assert opt["total_assigned"] == 5
    assert base["total_assigned"] >= 1
    assert opt["total_priority_covered"] >= base["total_priority_covered"]

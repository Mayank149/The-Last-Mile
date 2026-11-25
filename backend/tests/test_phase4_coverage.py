"""Phase 4 tests: explainable underserved-area gap detection."""

from __future__ import annotations

import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from app.main import get_coverage_gaps, reset_scenario  # noqa: E402


def test_coverage_gaps_returns_explainable_factors_and_warning() -> None:
    reset_scenario()
    res = get_coverage_gaps()
    assert "weights" in res
    assert abs(sum(res["weights"].values()) - 1.0) < 1e-6
    assert "does NOT estimate" in res["note"]
    zones = res["zones"]
    assert len(zones) == 6
    for z in zones:
        assert 0.0 <= z["gap_score"] <= 1.0
        assert z["gap_level"] in ("high", "moderate", "low")
        assert len(z["contributing_factors"]) >= 3
        assert "does NOT estimate" in z["verification_warning"]

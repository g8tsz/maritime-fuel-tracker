from __future__ import annotations

import json
from decimal import Decimal
from typing import Any


def score_edge_sample(
    prev: dict[str, Any] | None,
    curr: dict[str, Any],
) -> tuple[int, dict[str, int]]:
    factors: dict[str, int] = {}
    score = 0
    sq = curr.get("signal_quality")
    if sq is not None and sq < 70:
        factors["signal_quality_low"] = 20
        score += 20
    if sq is not None and sq < 50:
        factors["signal_quality_critical"] = 15
        score += 15

    if prev and prev.get("density_kg_m3") is not None and curr.get("density_kg_m3") is not None:
        delta = abs(Decimal(str(curr["density_kg_m3"])) - Decimal(str(prev["density_kg_m3"])))
        if delta > 5:
            factors["density_deviation"] = 25
            score += 25
        elif delta > 2:
            factors["density_deviation"] = 10
            score += 10

    if prev and prev.get("mass_rate_kgs") is not None and curr.get("mass_rate_kgs") is not None:
        a = abs(Decimal(str(prev["mass_rate_kgs"])))
        b = abs(Decimal(str(curr["mass_rate_kgs"])))
        if a > 0 and b > 0:
            ratio = b / a
            if ratio > Decimal("1.2") or ratio < Decimal("0.8"):
                factors["flow_rate_step"] = 15
                score += 15

    return min(100, score), factors


def merge_factor_scores(existing_json: str, delta: dict[str, int]) -> str:
    try:
        cur: dict[str, int] = json.loads(existing_json or "{}")
    except json.JSONDecodeError:
        cur = {}
    for k, v in delta.items():
        cur[k] = max(cur.get(k, 0), v)
    return json.dumps(cur)

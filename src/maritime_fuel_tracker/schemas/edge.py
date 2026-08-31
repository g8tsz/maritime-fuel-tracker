from __future__ import annotations

import re
from datetime import datetime
from decimal import Decimal
from typing import Any, Optional

from pydantic import BaseModel, Field, field_validator

_CUID = re.compile(r"^[a-z0-9]{20,40}$", re.I)


def _is_cuid_like(s: str) -> bool:
    return bool(_CUID.match(s))


class EdgeReading(BaseModel):
    site_id: str = Field(alias="siteId")
    berth_line_id: str = Field(alias="berthLineId")
    delivery_id: str = Field(alias="deliveryId")
    observed_at: datetime = Field(alias="observedAt")
    cumulative_mass_kg: Optional[str] = Field(None, alias="cumulativeMassKg")
    cumulative_volume_m3: Optional[str] = Field(None, alias="cumulativeVolumeM3")
    mass_kg: Optional[str] = Field(None, alias="massKg")
    mass_rate_kgs: Optional[str] = Field(None, alias="massRateKgs")
    volume_m3: Optional[str] = Field(None, alias="volumeM3")
    volume_rate_m3s: Optional[str] = Field(None, alias="volumeRateM3s")
    temp_c: Optional[str] = Field(None, alias="tempC")
    density_kg_m3: Optional[str] = Field(None, alias="densityKgM3")
    signal_quality: Optional[int] = Field(None, alias="signalQuality", ge=0, le=100)
    pressure_bar: Optional[str] = Field(None, alias="pressureBar")
    tank_level_m: Optional[str] = Field(None, alias="tankLevelM")
    pump_running: Optional[bool] = Field(None, alias="pumpRunning")
    raw_payload: Optional[dict[str, Any]] = Field(None, alias="rawPayload")

    model_config = {"populate_by_name": True, "extra": "forbid"}

    @field_validator("site_id", "berth_line_id", "delivery_id")
    @classmethod
    def ids(cls, v: str) -> str:
        if not _is_cuid_like(v):
            raise ValueError("invalid id")
        return v

    def has_measurements(self) -> bool:
        def nonempty(x: Optional[str]) -> bool:
            return x is not None and str(x).strip() != ""

        return any(
            nonempty(self.cumulative_mass_kg),
            nonempty(self.cumulative_volume_m3),
            nonempty(self.mass_kg),
            nonempty(self.volume_m3),
        )


def dec(s: Optional[str]) -> Optional[Decimal]:
    if s is None or str(s).strip() == "":
        return None
    return Decimal(str(s))

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Literal

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from maritime_fuel_tracker.db.models import BerthLine, Delivery, EdgeIdempotencyRecord, MeasurementReading
from maritime_fuel_tracker.errors import AppError, MBP, app_error
from maritime_fuel_tracker.schemas.edge import EdgeReading, dec
from maritime_fuel_tracker.services.anomaly import merge_factor_scores, score_edge_sample


def ingest_edge_reading(
    session: Session,
    *,
    body_raw: dict[str, Any],
    device: Any,
    api_version: Literal["v1", "v2"],
    idempotency_key: str | None,
) -> dict[str, Any]:
    try:
        body = EdgeReading.model_validate(body_raw)
    except Exception as e:
        raise app_error(MBP.common_validation, message="Invalid payload", details=str(e)) from e

    if body.site_id != device.site_id:
        raise app_error(MBP.edge_site_mismatch)

    idem = (idempotency_key or "").strip() or None
    if idem:
        existing = session.get(EdgeIdempotencyRecord, idem)
        if existing:
            return {"duplicate": True, "api_version": api_version}

    if not body.has_measurements():
        raise app_error(MBP.edge_ingest_no_measurements)

    delivery = session.execute(
        select(Delivery)
        .options(joinedload(Delivery.berth_line).joinedload(BerthLine.meter))
        .where(
            Delivery.id == body.delivery_id,
            Delivery.site_id == body.site_id,
            Delivery.berth_line_id == body.berth_line_id,
        ),
    ).scalar_one_or_none()

    if delivery is None:
        raise app_error(MBP.edge_delivery_not_found)
    if delivery.status != "IN_PROGRESS":
        raise app_error(MBP.edge_delivery_not_in_progress)

    has_cum_m = body.cumulative_mass_kg is not None and str(body.cumulative_mass_kg).strip() != ""
    has_cum_v = body.cumulative_volume_m3 is not None and str(body.cumulative_volume_m3).strip() != ""
    has_net_m = body.mass_kg is not None and str(body.mass_kg).strip() != ""
    has_net_v = body.volume_m3 is not None and str(body.volume_m3).strip() != ""

    payload_meta: dict[str, Any] = {
        "cumulativeMassKg": str(body.cumulative_mass_kg) if has_cum_m else None,
        "cumulativeVolumeM3": str(body.cumulative_volume_m3) if has_cum_v else None,
        "netMassKg": None if has_cum_m else (str(body.mass_kg) if has_net_m else None),
        "netVolumeM3": None if has_cum_v else (str(body.volume_m3) if has_net_v else None),
        "idempotencyKey": idem,
        "apiVersion": api_version,
    }

    prev = session.execute(
        select(MeasurementReading)
        .where(MeasurementReading.delivery_id == delivery.id)
        .order_by(MeasurementReading.observed_at.desc())
        .limit(1),
    ).scalar_one_or_none()

    raw_mass_kg = delivery.raw_mass_kg
    raw_volume_m3 = delivery.raw_volume_m3
    meter_start_mass_kg = delivery.meter_start_mass_kg
    meter_start_volume_m3 = delivery.meter_start_volume_m3
    edge_last_cumulative_mass_kg = delivery.edge_last_cumulative_mass_kg
    edge_last_cumulative_volume_m3 = delivery.edge_last_cumulative_volume_m3

    if has_cum_m:
        cum = Decimal(str(body.cumulative_mass_kg))
        if delivery.meter_start_mass_kg is None:
            meter_start_mass_kg = cum
            raw_mass_kg = Decimal("0")
        else:
            meter_start_mass_kg = delivery.meter_start_mass_kg
            raw_mass_kg = cum - delivery.meter_start_mass_kg
        edge_last_cumulative_mass_kg = cum
    elif has_net_m:
        raw_mass_kg = Decimal(str(body.mass_kg))

    if has_cum_v:
        cum_v = Decimal(str(body.cumulative_volume_m3))
        if delivery.meter_start_volume_m3 is None:
            meter_start_volume_m3 = cum_v
            raw_volume_m3 = Decimal("0")
        else:
            meter_start_volume_m3 = delivery.meter_start_volume_m3
            raw_volume_m3 = cum_v - delivery.meter_start_volume_m3
        edge_last_cumulative_volume_m3 = cum_v
    elif has_net_v:
        raw_volume_m3 = Decimal(str(body.volume_m3))

    source = f"edge_{api_version}"
    meter_profile_id = delivery.berth_line.meter.id if delivery.berth_line.meter else None

    obs = body.observed_at
    if obs.tzinfo is None:
        obs = obs.replace(tzinfo=timezone.utc)

    raw_payload = {
        **{k: v for k, v in payload_meta.items() if v is not None},
        "edgeDeviceName": device.name,
        **(body.raw_payload or {}),
    }

    reading = MeasurementReading(
        id=str(uuid.uuid4()),
        delivery_id=delivery.id,
        meter_profile_id=meter_profile_id,
        observed_at=obs,
        mass_kg=Decimal(str(body.cumulative_mass_kg)) if has_cum_m else dec(body.mass_kg),
        mass_rate_kgs=dec(body.mass_rate_kgs),
        volume_m3=Decimal(str(body.cumulative_volume_m3)) if has_cum_v else dec(body.volume_m3),
        volume_rate_m3s=dec(body.volume_rate_m3s),
        temp_c=dec(body.temp_c),
        density_kg_m3=dec(body.density_kg_m3),
        signal_quality=body.signal_quality,
        pressure_bar=dec(body.pressure_bar),
        tank_level_m=dec(body.tank_level_m),
        pump_running=body.pump_running,
        source=source,
        raw_payload_json=json.dumps(raw_payload),
        created_at=datetime.now(timezone.utc),
    )

    prev_for_score = None
    if prev:
        prev_for_score = {
            "signal_quality": prev.signal_quality,
            "density_kg_m3": prev.density_kg_m3,
            "mass_rate_kgs": prev.mass_rate_kgs,
        }
    curr_for_score = {
        "signal_quality": body.signal_quality,
        "density_kg_m3": dec(body.density_kg_m3),
        "mass_rate_kgs": dec(body.mass_rate_kgs),
    }
    score, factors = score_edge_sample(prev_for_score, curr_for_score)
    merged = merge_factor_scores(delivery.anomaly_factors_json or "{}", factors)
    next_anomaly = min(100, max(delivery.anomaly_score or 0, score))

    try:
        if idem:
            session.add(
                EdgeIdempotencyRecord(
                    key=idem,
                    delivery_id=delivery.id,
                    created_at=datetime.now(timezone.utc),
                ),
            )
            session.flush()
        session.add(reading)
        delivery.raw_mass_kg = raw_mass_kg
        delivery.raw_volume_m3 = raw_volume_m3
        if body.temp_c:
            delivery.avg_temp_c = dec(body.temp_c)
        if body.density_kg_m3:
            delivery.density_kg_m3 = dec(body.density_kg_m3)
        delivery.meter_start_mass_kg = meter_start_mass_kg
        delivery.meter_start_volume_m3 = meter_start_volume_m3
        delivery.edge_last_cumulative_mass_kg = edge_last_cumulative_mass_kg
        delivery.edge_last_cumulative_volume_m3 = edge_last_cumulative_volume_m3
        delivery.anomaly_score = next_anomaly
        delivery.anomaly_factors_json = merged
        delivery.updated_at = datetime.now(timezone.utc)
        session.flush()
    except IntegrityError:
        session.rollback()
        return {"duplicate": True, "api_version": api_version}

    return {"duplicate": False, "api_version": api_version}

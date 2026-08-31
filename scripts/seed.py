"""Populate SQLite with demo org, site, berth, users, edge device (run from repo root)."""

from __future__ import annotations

import json
import secrets
import sys
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path

import bcrypt

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from maritime_fuel_tracker.db.base import Base  # noqa: E402
from sqlalchemy import select  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

from maritime_fuel_tracker.db.models import (  # noqa: E402
    BerthLine,
    CalibrationRecord,
    Contract,
    Customer,
    Delivery,
    EdgeDevice,
    FuelGrade,
    FuelHub,
    HubSensor,
    Membership,
    MeterProfile,
    Organization,
    Site,
    Station,
    User,
    Vessel,
)
from maritime_fuel_tracker.db.session import get_engine, init_engine  # noqa: E402
from maritime_fuel_tracker.services.edge_auth import hash_api_key  # noqa: E402


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _id() -> str:
    return secrets.token_hex(12)


def main() -> None:
    init_engine()
    eng = get_engine()
    Base.metadata.drop_all(bind=eng)
    Base.metadata.create_all(bind=eng)

    with Session(eng) as session:
        org = Organization(id=_id(), name="Demo Bunker Co", created_at=_now(), updated_at=_now())
        site = Site(
            id=_id(),
            organization_id=org.id,
            name="Pier 7 — High-flow berth",
            timezone="America/New_York",
            created_at=_now(),
            updated_at=_now(),
        )
        station = Station(
            id=_id(),
            site_id=site.id,
            code="STATION-1",
            display_name="Station 1 — Line A manifold",
            sort_order=1,
            created_at=_now(),
            updated_at=_now(),
        )
        berth = BerthLine(
            id=_id(),
            site_id=site.id,
            station_id=station.id,
            name="Line A",
            max_rate_m3h=3500.0,
            created_at=_now(),
            updated_at=_now(),
        )
        integration = {
            "protocol": "modbus_tcp",
            "host": "127.0.0.1",
            "port": 502,
            "holdingRegisters": {"massKg": 40001, "massRate": 40003},
            "notes": "Replace with vendor map.",
        }
        meter = MeterProfile(
            id=_id(),
            berth_line_id=berth.id,
            mode="CLAMP_ON_ULTRASONIC",
            integration_json=json.dumps(integration),
            created_at=_now(),
            updated_at=_now(),
        )
        session.add_all([org, site, station, berth, meter])

        admin_hash = bcrypt.hashpw(b"admin123", bcrypt.gensalt()).decode()
        it_hash = bcrypt.hashpw(b"itadmin123", bcrypt.gensalt()).decode()
        op_hash = bcrypt.hashpw(b"operator123", bcrypt.gensalt()).decode()
        fin_hash = bcrypt.hashpw(b"finance123", bcrypt.gensalt()).decode()

        admin = User(
            id=_id(),
            organization_id=org.id,
            email="admin@demo.local",
            password_hash=admin_hash,
            display_name="Org Admin",
            created_at=_now(),
            updated_at=_now(),
        )
        it = User(
            id=_id(),
            organization_id=org.id,
            email="itadmin@demo.local",
            password_hash=it_hash,
            display_name="IT / Control plane",
            created_at=_now(),
            updated_at=_now(),
        )
        op = User(
            id=_id(),
            organization_id=org.id,
            email="operator@demo.local",
            password_hash=op_hash,
            display_name="Berth Operator",
            created_at=_now(),
            updated_at=_now(),
        )
        fin = User(
            id=_id(),
            organization_id=org.id,
            email="finance@demo.local",
            password_hash=fin_hash,
            display_name="Finance",
            created_at=_now(),
            updated_at=_now(),
        )
        session.add_all([admin, it, op, fin])

        session.add_all(
            [
                Membership(id=_id(), user_id=admin.id, site_id=None, role="ORG_ADMIN", created_at=_now()),
                Membership(id=_id(), user_id=it.id, site_id=None, role="IT_ADMIN", created_at=_now()),
                Membership(id=_id(), user_id=op.id, site_id=site.id, role="OPERATOR", created_at=_now()),
                Membership(id=_id(), user_id=fin.id, site_id=site.id, role="FINANCE", created_at=_now()),
            ],
        )

        session.add_all(
            [
                FuelGrade(
                    id=_id(),
                    code="VLSFO",
                    description="Very Low Sulphur Fuel Oil",
                    sulfur_pct=0.5,
                    created_at=_now(),
                ),
                FuelGrade(
                    id=_id(),
                    code="MGO",
                    description="Marine Gas Oil",
                    sulfur_pct=0.1,
                    created_at=_now(),
                ),
            ],
        )
        session.flush()

        cust = Customer(
            id=_id(),
            organization_id=org.id,
            name="Oceanic Lines Ltd",
            billing_email="bunkers@oceanic.example",
            created_at=_now(),
            updated_at=_now(),
        )
        session.add(cust)
        session.add(
            Vessel(
                id=_id(),
                organization_id=org.id,
                name="MV Demo Trader",
                imo_number="9876543",
                flag="Panama",
                created_at=_now(),
                updated_at=_now(),
            ),
        )
        session.flush()

        session.add(
            Contract(
                id=_id(),
                organization_id=org.id,
                customer_id=cust.id,
                title="2026 VLSFO frame",
                currency="USD",
                basis="PER_MT",
                unit_price=Decimal("750.00"),
                tax_rate=Decimal("0.07"),
                rounding_kg=1000,
                rounding_m3=3,
                recon_variance_kg=Decimal("500"),
                effective_from=_now(),
                effective_to=None,
                created_at=_now(),
                updated_at=_now(),
            ),
        )
        session.flush()

        api_key = f"mbp_edge_{secrets.token_urlsafe(24)}"
        edge = EdgeDevice(
            id=_id(),
            site_id=site.id,
            name="Pier-7-edge-01",
            api_key_hash=hash_api_key(api_key),
            last_seen_at=None,
            created_at=_now(),
        )
        session.add(edge)
        session.flush()

        hub = FuelHub(
            id=_id(),
            site_id=site.id,
            station_id=station.id,
            berth_line_id=berth.id,
            code="PUMP-07",
            display_name="FuelTrace-class hub — Pier 7 Line A",
            firmware_version="4.2.1-demo",
            edge_device_id=edge.id,
            created_at=_now(),
            updated_at=_now(),
        )
        session.add(hub)
        session.flush()
        session.add_all(
            [
                HubSensor(
                    id=_id(),
                    hub_id=hub.id,
                    kind="FLOW_CLAMP_ON_ULTRASONIC",
                    label="Clamp-on ultrasonic pair",
                    channel_index=0,
                    install_json="{}",
                    is_active=True,
                    created_at=_now(),
                    updated_at=_now(),
                ),
                HubSensor(
                    id=_id(),
                    hub_id=hub.id,
                    kind="TEMP_PIPE_CLAMP",
                    label="Pipe temperature",
                    channel_index=1,
                    install_json="{}",
                    is_active=True,
                    created_at=_now(),
                    updated_at=_now(),
                ),
            ],
        )
        session.add(
            CalibrationRecord(
                id=_id(),
                meter_profile_id=meter.id,
                k_factor=Decimal("1.0000"),
                reference_note="Seed baseline K-factor.",
                created_at=_now(),
                created_by_id=None,
            ),
        )

        contract_row = session.execute(select(Contract).where(Contract.organization_id == org.id)).scalar_one()
        fg_row = session.execute(select(FuelGrade).where(FuelGrade.code == "VLSFO")).scalar_one()
        vessel_row = session.execute(select(Vessel).where(Vessel.organization_id == org.id)).scalar_one()
        session.add(
            Delivery(
                id=_id(),
                site_id=site.id,
                station_id=station.id,
                berth_line_id=berth.id,
                customer_id=cust.id,
                vessel_id=vessel_row.id,
                fuel_grade_id=fg_row.id,
                contract_id=contract_row.id,
                status="IN_PROGRESS",
                started_at=_now(),
                created_at=_now(),
                updated_at=_now(),
            ),
        )

        session.commit()

    print("\n=== Demo users (passwords) ===")
    print("admin@demo.local / admin123")
    print("itadmin@demo.local / itadmin123")
    print("operator@demo.local / operator123")
    print("finance@demo.local / finance123")
    print("\n=== Edge device API key ===")
    print(api_key)
    print("\nEdge ingest: POST http://localhost:8000/api/edge/v2/readings")
    with Session(eng) as s2:
        d = s2.execute(select(Delivery).limit(1)).scalar_one()
        print(f"\nDemo delivery id (use in edge JSON): {d.id}")
        print(f"Demo site id: {d.site_id}")
        print(f"Demo berth line id: {d.berth_line_id}")


if __name__ == "__main__":
    main()

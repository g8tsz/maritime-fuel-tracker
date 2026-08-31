"""SQLAlchemy models — column names match Prisma (camelCase) for SQLite compatibility."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    LargeBinary,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from maritime_fuel_tracker.db.base import Base


def _dec() -> type[Numeric]:
    return Numeric(24, 9)


class Organization(Base):
    __tablename__ = "Organization"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column("createdAt", DateTime, nullable=False)
    updated_at: Mapped[datetime] = mapped_column("updatedAt", DateTime, nullable=False)


class User(Base):
    __tablename__ = "User"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    organization_id: Mapped[str] = mapped_column("organizationId", String(36), ForeignKey("Organization.id"))
    email: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column("passwordHash", String, nullable=False)
    display_name: Mapped[Optional[str]] = mapped_column("displayName", String, nullable=True)
    created_at: Mapped[datetime] = mapped_column("createdAt", DateTime, nullable=False)
    updated_at: Mapped[datetime] = mapped_column("updatedAt", DateTime, nullable=False)


class Site(Base):
    __tablename__ = "Site"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    organization_id: Mapped[str] = mapped_column("organizationId", String(36), ForeignKey("Organization.id"))
    name: Mapped[str] = mapped_column(String, nullable=False)
    timezone: Mapped[str] = mapped_column(String, nullable=False, default="UTC")
    created_at: Mapped[datetime] = mapped_column("createdAt", DateTime, nullable=False)
    updated_at: Mapped[datetime] = mapped_column("updatedAt", DateTime, nullable=False)


class Station(Base):
    __tablename__ = "Station"
    __table_args__ = (UniqueConstraint("siteId", "code", name="Station_siteId_code_key"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    site_id: Mapped[str] = mapped_column("siteId", String(36), ForeignKey("Site.id"))
    code: Mapped[str] = mapped_column(String, nullable=False)
    display_name: Mapped[str] = mapped_column("displayName", String, nullable=False)
    sort_order: Mapped[int] = mapped_column("sortOrder", Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column("createdAt", DateTime, nullable=False)
    updated_at: Mapped[datetime] = mapped_column("updatedAt", DateTime, nullable=False)


class Membership(Base):
    __tablename__ = "Membership"
    __table_args__ = (UniqueConstraint("userId", "siteId", name="Membership_userId_siteId_key"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str] = mapped_column("userId", String(36), ForeignKey("User.id"))
    site_id: Mapped[Optional[str]] = mapped_column("siteId", String(36), ForeignKey("Site.id"), nullable=True)
    role: Mapped[str] = mapped_column(String(32), nullable=False)
    created_at: Mapped[datetime] = mapped_column("createdAt", DateTime, nullable=False)


class FuelGrade(Base):
    __tablename__ = "FuelGrade"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    code: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    description: Mapped[str] = mapped_column(String, nullable=False)
    sulfur_pct: Mapped[Optional[float]] = mapped_column("sulfurPct", Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column("createdAt", DateTime, nullable=False)


class Customer(Base):
    __tablename__ = "Customer"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    organization_id: Mapped[str] = mapped_column("organizationId", String(36), ForeignKey("Organization.id"))
    name: Mapped[str] = mapped_column(String, nullable=False)
    billing_email: Mapped[Optional[str]] = mapped_column("billingEmail", String, nullable=True)
    created_at: Mapped[datetime] = mapped_column("createdAt", DateTime, nullable=False)
    updated_at: Mapped[datetime] = mapped_column("updatedAt", DateTime, nullable=False)


class Vessel(Base):
    __tablename__ = "Vessel"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    organization_id: Mapped[str] = mapped_column("organizationId", String(36), ForeignKey("Organization.id"))
    imo_number: Mapped[Optional[str]] = mapped_column("imoNumber", String, nullable=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    flag: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column("createdAt", DateTime, nullable=False)
    updated_at: Mapped[datetime] = mapped_column("updatedAt", DateTime, nullable=False)


class Contract(Base):
    __tablename__ = "Contract"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    organization_id: Mapped[str] = mapped_column("organizationId", String(36), ForeignKey("Organization.id"))
    customer_id: Mapped[str] = mapped_column("customerId", String(36), ForeignKey("Customer.id"))
    title: Mapped[str] = mapped_column(String, nullable=False)
    currency: Mapped[str] = mapped_column(String, nullable=False, default="USD")
    basis: Mapped[str] = mapped_column(String(32), nullable=False)
    unit_price: Mapped[Decimal] = mapped_column("unitPrice", _dec(), nullable=False)
    tax_rate: Mapped[Decimal] = mapped_column("taxRate", _dec(), nullable=False, default=Decimal("0"))
    rounding_kg: Mapped[int] = mapped_column("roundingKg", Integer, nullable=False, default=1)
    rounding_m3: Mapped[int] = mapped_column("roundingM3", Integer, nullable=False, default=3)
    recon_variance_kg: Mapped[Decimal] = mapped_column("reconVarianceKg", _dec(), nullable=False, default=Decimal("500"))
    effective_from: Mapped[datetime] = mapped_column("effectiveFrom", DateTime, nullable=False)
    effective_to: Mapped[Optional[datetime]] = mapped_column("effectiveTo", DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column("createdAt", DateTime, nullable=False)
    updated_at: Mapped[datetime] = mapped_column("updatedAt", DateTime, nullable=False)


class BerthLine(Base):
    __tablename__ = "BerthLine"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    site_id: Mapped[str] = mapped_column("siteId", String(36), ForeignKey("Site.id"))
    station_id: Mapped[str] = mapped_column("stationId", String(36), ForeignKey("Station.id"))
    name: Mapped[str] = mapped_column(String, nullable=False)
    max_rate_m3h: Mapped[Optional[float]] = mapped_column("maxRateM3h", Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column("createdAt", DateTime, nullable=False)
    updated_at: Mapped[datetime] = mapped_column("updatedAt", DateTime, nullable=False)
    meter: Mapped[Optional["MeterProfile"]] = relationship(
        "MeterProfile", back_populates="berth_line", uselist=False
    )


class MeterProfile(Base):
    __tablename__ = "MeterProfile"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    berth_line_id: Mapped[str] = mapped_column("berthLineId", String(36), ForeignKey("BerthLine.id"), unique=True)
    mode: Mapped[str] = mapped_column(String(32), nullable=False)
    integration_json: Mapped[str] = mapped_column("integrationJson", Text, nullable=False, default="{}")
    created_at: Mapped[datetime] = mapped_column("createdAt", DateTime, nullable=False)
    updated_at: Mapped[datetime] = mapped_column("updatedAt", DateTime, nullable=False)
    berth_line: Mapped["BerthLine"] = relationship("BerthLine", back_populates="meter", foreign_keys=[berth_line_id])


class EdgeDevice(Base):
    __tablename__ = "EdgeDevice"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    site_id: Mapped[str] = mapped_column("siteId", String(36), ForeignKey("Site.id"))
    name: Mapped[str] = mapped_column(String, nullable=False)
    api_key_hash: Mapped[str] = mapped_column("apiKeyHash", String(128), nullable=False)
    last_seen_at: Mapped[Optional[datetime]] = mapped_column("lastSeenAt", DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column("createdAt", DateTime, nullable=False)
    hub: Mapped[Optional["FuelHub"]] = relationship("FuelHub", back_populates="edge_device", uselist=False)


class FuelHub(Base):
    __tablename__ = "FuelHub"
    __table_args__ = (UniqueConstraint("siteId", "code", name="FuelHub_siteId_code_key"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    site_id: Mapped[str] = mapped_column("siteId", String(36), ForeignKey("Site.id"))
    station_id: Mapped[Optional[str]] = mapped_column("stationId", String(36), ForeignKey("Station.id"), nullable=True)
    berth_line_id: Mapped[Optional[str]] = mapped_column("berthLineId", String(36), ForeignKey("BerthLine.id"), nullable=True)
    code: Mapped[str] = mapped_column(String, nullable=False)
    display_name: Mapped[str] = mapped_column("displayName", String, nullable=False)
    firmware_version: Mapped[Optional[str]] = mapped_column("firmwareVersion", String, nullable=True)
    edge_device_id: Mapped[Optional[str]] = mapped_column("edgeDeviceId", String(36), ForeignKey("EdgeDevice.id"), unique=True, nullable=True)
    created_at: Mapped[datetime] = mapped_column("createdAt", DateTime, nullable=False)
    updated_at: Mapped[datetime] = mapped_column("updatedAt", DateTime, nullable=False)
    edge_device: Mapped[Optional["EdgeDevice"]] = relationship("EdgeDevice", back_populates="hub")


class HubSensor(Base):
    __tablename__ = "HubSensor"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    hub_id: Mapped[str] = mapped_column("hubId", String(36), ForeignKey("FuelHub.id"))
    kind: Mapped[str] = mapped_column(String(48), nullable=False)
    label: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    channel_index: Mapped[int] = mapped_column("channelIndex", Integer, nullable=False, default=0)
    install_json: Mapped[str] = mapped_column("installJson", Text, nullable=False, default="{}")
    is_active: Mapped[bool] = mapped_column("isActive", Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column("createdAt", DateTime, nullable=False)
    updated_at: Mapped[datetime] = mapped_column("updatedAt", DateTime, nullable=False)


class CalibrationRecord(Base):
    __tablename__ = "CalibrationRecord"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    meter_profile_id: Mapped[str] = mapped_column("meterProfileId", String(36), ForeignKey("MeterProfile.id"))
    k_factor: Mapped[Decimal] = mapped_column("kFactor", _dec(), nullable=False)
    reference_note: Mapped[str] = mapped_column("referenceNote", Text, nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column("createdAt", DateTime, nullable=False)
    created_by_id: Mapped[Optional[str]] = mapped_column("createdById", String(36), ForeignKey("User.id"), nullable=True)


class Delivery(Base):
    __tablename__ = "Delivery"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    site_id: Mapped[str] = mapped_column("siteId", String(36), ForeignKey("Site.id"))
    station_id: Mapped[str] = mapped_column("stationId", String(36), ForeignKey("Station.id"))
    berth_line_id: Mapped[str] = mapped_column("berthLineId", String(36), ForeignKey("BerthLine.id"))
    customer_id: Mapped[str] = mapped_column("customerId", String(36), ForeignKey("Customer.id"))
    vessel_id: Mapped[Optional[str]] = mapped_column("vesselId", String(36), ForeignKey("Vessel.id"), nullable=True)
    fuel_grade_id: Mapped[str] = mapped_column("fuelGradeId", String(36), ForeignKey("FuelGrade.id"))
    contract_id: Mapped[Optional[str]] = mapped_column("contractId", String(36), ForeignKey("Contract.id"), nullable=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="DRAFT")
    started_at: Mapped[Optional[datetime]] = mapped_column("startedAt", DateTime, nullable=True)
    ended_at: Mapped[Optional[datetime]] = mapped_column("endedAt", DateTime, nullable=True)
    meter_start_mass_kg: Mapped[Optional[Decimal]] = mapped_column("meterStartMassKg", _dec(), nullable=True)
    meter_start_volume_m3: Mapped[Optional[Decimal]] = mapped_column("meterStartVolumeM3", _dec(), nullable=True)
    meter_stop_mass_kg: Mapped[Optional[Decimal]] = mapped_column("meterStopMassKg", _dec(), nullable=True)
    meter_stop_volume_m3: Mapped[Optional[Decimal]] = mapped_column("meterStopVolumeM3", _dec(), nullable=True)
    edge_last_cumulative_mass_kg: Mapped[Optional[Decimal]] = mapped_column("edgeLastCumulativeMassKg", _dec(), nullable=True)
    edge_last_cumulative_volume_m3: Mapped[Optional[Decimal]] = mapped_column("edgeLastCumulativeVolumeM3", _dec(), nullable=True)
    raw_mass_kg: Mapped[Optional[Decimal]] = mapped_column("rawMassKg", _dec(), nullable=True)
    raw_volume_m3: Mapped[Optional[Decimal]] = mapped_column("rawVolumeM3", _dec(), nullable=True)
    avg_temp_c: Mapped[Optional[Decimal]] = mapped_column("avgTempC", _dec(), nullable=True)
    density_kg_m3: Mapped[Optional[Decimal]] = mapped_column("densityKgM3", _dec(), nullable=True)
    vcf_standard: Mapped[Optional[str]] = mapped_column("vcfStandard", String, nullable=True)
    commercial_mass_kg: Mapped[Optional[Decimal]] = mapped_column("commercialMassKg", _dec(), nullable=True)
    commercial_volume_m3: Mapped[Optional[Decimal]] = mapped_column("commercialVolumeM3", _dec(), nullable=True)
    est_mass_kg: Mapped[Optional[Decimal]] = mapped_column("estMassKg", _dec(), nullable=True)
    est_volume_m3: Mapped[Optional[Decimal]] = mapped_column("estVolumeM3", _dec(), nullable=True)
    est_cost: Mapped[Optional[Decimal]] = mapped_column("estCost", _dec(), nullable=True)
    gross_metered_mass_kg: Mapped[Optional[Decimal]] = mapped_column("grossMeteredMassKg", _dec(), nullable=True)
    line_contents_mass_kg: Mapped[Optional[Decimal]] = mapped_column("lineContentsMassKg", _dec(), nullable=True)
    hose_length_m: Mapped[Optional[float]] = mapped_column("hoseLengthM", Float, nullable=True)
    hose_inner_diameter_mm: Mapped[Optional[float]] = mapped_column("hoseInnerDiameterMm", Float, nullable=True)
    anomaly_score: Mapped[Optional[int]] = mapped_column("anomalyScore", Integer, nullable=True)
    anomaly_factors_json: Mapped[str] = mapped_column("anomalyFactorsJson", Text, nullable=False, default="{}")
    zero_verification_passed_at: Mapped[Optional[datetime]] = mapped_column("zeroVerificationPassedAt", DateTime, nullable=True)
    zero_drift_kg_per_hr: Mapped[Optional[Decimal]] = mapped_column("zeroDriftKgPerHr", _dec(), nullable=True)
    created_at: Mapped[datetime] = mapped_column("createdAt", DateTime, nullable=False)
    updated_at: Mapped[datetime] = mapped_column("updatedAt", DateTime, nullable=False)
    berth_line: Mapped["BerthLine"] = relationship("BerthLine", foreign_keys=[berth_line_id])


class MeasurementReading(Base):
    __tablename__ = "MeasurementReading"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    delivery_id: Mapped[str] = mapped_column("deliveryId", String(36), ForeignKey("Delivery.id"))
    meter_profile_id: Mapped[Optional[str]] = mapped_column("meterProfileId", String(36), ForeignKey("MeterProfile.id"), nullable=True)
    observed_at: Mapped[datetime] = mapped_column("observedAt", DateTime, nullable=False)
    mass_kg: Mapped[Optional[Decimal]] = mapped_column("massKg", _dec(), nullable=True)
    mass_rate_kgs: Mapped[Optional[Decimal]] = mapped_column("massRateKgs", _dec(), nullable=True)
    volume_m3: Mapped[Optional[Decimal]] = mapped_column("volumeM3", _dec(), nullable=True)
    volume_rate_m3s: Mapped[Optional[Decimal]] = mapped_column("volumeRateM3s", _dec(), nullable=True)
    temp_c: Mapped[Optional[Decimal]] = mapped_column("tempC", _dec(), nullable=True)
    density_kg_m3: Mapped[Optional[Decimal]] = mapped_column("densityKgM3", _dec(), nullable=True)
    signal_quality: Mapped[Optional[int]] = mapped_column("signalQuality", Integer, nullable=True)
    pressure_bar: Mapped[Optional[Decimal]] = mapped_column("pressureBar", _dec(), nullable=True)
    tank_level_m: Mapped[Optional[Decimal]] = mapped_column("tankLevelM", _dec(), nullable=True)
    pump_running: Mapped[Optional[bool]] = mapped_column("pumpRunning", Boolean, nullable=True)
    source: Mapped[str] = mapped_column(String, nullable=False)
    raw_payload_json: Mapped[str] = mapped_column("rawPayloadJson", Text, nullable=False, default="{}")
    created_at: Mapped[datetime] = mapped_column("createdAt", DateTime, nullable=False)


class DeliveryPreFlightItem(Base):
    __tablename__ = "DeliveryPreFlightItem"
    __table_args__ = (UniqueConstraint("deliveryId", "key", name="DeliveryPreFlightItem_deliveryId_key_key"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    delivery_id: Mapped[str] = mapped_column("deliveryId", String(36), ForeignKey("Delivery.id"))
    key: Mapped[str] = mapped_column(String, nullable=False)
    label: Mapped[str] = mapped_column(String, nullable=False)
    required: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column("completedAt", DateTime, nullable=True)
    evidence_note: Mapped[Optional[str]] = mapped_column("evidenceNote", String, nullable=True)
    created_at: Mapped[datetime] = mapped_column("createdAt", DateTime, nullable=False)


class BunkerDeliveryNote(Base):
    __tablename__ = "BunkerDeliveryNote"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    delivery_id: Mapped[str] = mapped_column("deliveryId", String(36), ForeignKey("Delivery.id"), unique=True)
    number: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    pdf_blob: Mapped[Optional[bytes]] = mapped_column("pdfBlob", LargeBinary, nullable=True)
    signed_by_supplier: Mapped[Optional[str]] = mapped_column("signedBySupplier", String, nullable=True)
    signed_by_receiver: Mapped[Optional[str]] = mapped_column("signedByReceiver", String, nullable=True)
    signed_at: Mapped[Optional[datetime]] = mapped_column("signedAt", DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column("createdAt", DateTime, nullable=False)


class Invoice(Base):
    __tablename__ = "Invoice"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    customer_id: Mapped[str] = mapped_column("customerId", String(36), ForeignKey("Customer.id"))
    number: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="DRAFT")
    currency: Mapped[str] = mapped_column(String, nullable=False)
    subtotal: Mapped[Decimal] = mapped_column("subtotal", _dec(), nullable=False)
    tax: Mapped[Decimal] = mapped_column("tax", _dec(), nullable=False)
    total: Mapped[Decimal] = mapped_column("total", _dec(), nullable=False)
    issued_at: Mapped[Optional[datetime]] = mapped_column("issuedAt", DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column("createdAt", DateTime, nullable=False)
    updated_at: Mapped[datetime] = mapped_column("updatedAt", DateTime, nullable=False)


class InvoiceLine(Base):
    __tablename__ = "InvoiceLine"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    invoice_id: Mapped[str] = mapped_column("invoiceId", String(36), ForeignKey("Invoice.id"))
    delivery_id: Mapped[str] = mapped_column("deliveryId", String(36), ForeignKey("Delivery.id"), unique=True)
    description: Mapped[str] = mapped_column(String, nullable=False)
    quantity: Mapped[Decimal] = mapped_column("quantity", _dec(), nullable=False)
    unit: Mapped[str] = mapped_column(String, nullable=False)
    unit_price: Mapped[Decimal] = mapped_column("unitPrice", _dec(), nullable=False)
    line_total: Mapped[Decimal] = mapped_column("lineTotal", _dec(), nullable=False)


class EdgeIdempotencyRecord(Base):
    __tablename__ = "EdgeIdempotencyRecord"
    key: Mapped[str] = mapped_column(String(256), primary_key=True)
    delivery_id: Mapped[str] = mapped_column("deliveryId", String(36), ForeignKey("Delivery.id"))
    created_at: Mapped[datetime] = mapped_column("createdAt", DateTime, nullable=False)


class ReconciliationCase(Base):
    __tablename__ = "ReconciliationCase"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    delivery_id: Mapped[str] = mapped_column("deliveryId", String(36), ForeignKey("Delivery.id"), unique=True)
    ship_reported_mass_kg: Mapped[Optional[Decimal]] = mapped_column("shipReportedMassKg", _dec(), nullable=True)
    variance_kg: Mapped[Optional[Decimal]] = mapped_column("varianceKg", _dec(), nullable=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="OPEN")
    notes: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column("createdAt", DateTime, nullable=False)
    updated_at: Mapped[datetime] = mapped_column("updatedAt", DateTime, nullable=False)


class AuditEvent(Base):
    __tablename__ = "AuditEvent"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    actor_id: Mapped[Optional[str]] = mapped_column("actorId", String(36), ForeignKey("User.id"), nullable=True)
    action: Mapped[str] = mapped_column(String, nullable=False)
    entity: Mapped[str] = mapped_column(String, nullable=False)
    entity_id: Mapped[Optional[str]] = mapped_column("entityId", String, nullable=True)
    payload: Mapped[str] = mapped_column(String, nullable=False, default="{}")
    correlation_id: Mapped[Optional[str]] = mapped_column("correlationId", String, nullable=True)
    created_at: Mapped[datetime] = mapped_column("createdAt", DateTime, nullable=False)


class StationMetricRollup(Base):
    __tablename__ = "StationMetricRollup"
    __table_args__ = (
        UniqueConstraint("stationId", "periodStart", "granularity", name="StationMetricRollup_station_period_granularity_key"),
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    station_id: Mapped[str] = mapped_column("stationId", String(36), ForeignKey("Station.id"))
    period_start: Mapped[datetime] = mapped_column("periodStart", DateTime, nullable=False)
    granularity: Mapped[str] = mapped_column(String(16), nullable=False)
    delivery_count: Mapped[int] = mapped_column("deliveryCount", Integer, nullable=False, default=0)
    error_count: Mapped[int] = mapped_column("errorCount", Integer, nullable=False, default=0)
    total_raw_mass_kg: Mapped[Optional[Decimal]] = mapped_column("totalRawMassKg", _dec(), nullable=True)
    total_raw_volume_m3: Mapped[Optional[Decimal]] = mapped_column("totalRawVolumeM3", _dec(), nullable=True)
    created_at: Mapped[datetime] = mapped_column("createdAt", DateTime, nullable=False)
    updated_at: Mapped[datetime] = mapped_column("updatedAt", DateTime, nullable=False)


class JobQueue(Base):
    __tablename__ = "JobQueue"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    organization_id: Mapped[Optional[str]] = mapped_column("organizationId", String(36), nullable=True)
    station_id: Mapped[Optional[str]] = mapped_column("stationId", String(36), ForeignKey("Station.id"), nullable=True)
    type: Mapped[str] = mapped_column(String(48), nullable=False)
    payload: Mapped[str] = mapped_column(String, nullable=False, default="{}")
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="PENDING")
    run_after: Mapped[Optional[datetime]] = mapped_column("runAfter", DateTime, nullable=True)
    last_error: Mapped[Optional[str]] = mapped_column("lastError", String, nullable=True)
    created_at: Mapped[datetime] = mapped_column("createdAt", DateTime, nullable=False)
    updated_at: Mapped[datetime] = mapped_column("updatedAt", DateTime, nullable=False)


class ApplicationErrorLog(Base):
    __tablename__ = "ApplicationErrorLog"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    correlation_id: Mapped[Optional[str]] = mapped_column("correlationId", String, nullable=True)
    code: Mapped[str] = mapped_column(String, nullable=False)
    site_id: Mapped[Optional[str]] = mapped_column("siteId", String(36), nullable=True)
    station_id: Mapped[Optional[str]] = mapped_column("stationId", String(36), ForeignKey("Station.id"), nullable=True)
    delivery_id: Mapped[Optional[str]] = mapped_column("deliveryId", String(36), nullable=True)
    edge_device_id: Mapped[Optional[str]] = mapped_column("edgeDeviceId", String(36), nullable=True)
    http_status: Mapped[Optional[int]] = mapped_column("httpStatus", Integer, nullable=True)
    message: Mapped[str] = mapped_column(String, nullable=False)
    details: Mapped[str] = mapped_column(String, nullable=False, default="{}")
    created_at: Mapped[datetime] = mapped_column("createdAt", DateTime, nullable=False)

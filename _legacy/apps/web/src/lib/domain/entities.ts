/**
 * Domain identifiers and enums mirrored from Prisma for documentation
 * and stable imports outside DB-generated types.
 */
export const ENTITY = {
  Organization: "Organization",
  Site: "Site",
  User: "User",
  Membership: "Membership",
  BerthLine: "BerthLine",
  MeterProfile: "MeterProfile",
  EdgeDevice: "EdgeDevice",
  FuelGrade: "FuelGrade",
  Customer: "Customer",
  Vessel: "Vessel",
  Contract: "Contract",
  Delivery: "Delivery",
  MeasurementReading: "MeasurementReading",
  BunkerDeliveryNote: "BunkerDeliveryNote",
  Invoice: "Invoice",
  InvoiceLine: "InvoiceLine",
  ReconciliationCase: "ReconciliationCase",
  AuditEvent: "AuditEvent",
} as const;

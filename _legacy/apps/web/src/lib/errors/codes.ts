/** Centralized MBP error codes for APIs, logs, and admin views. */
export const MBP = {
  common: {
    unauthorized: "MBP.common.unauthorized",
    forbidden: "MBP.common.forbidden",
    validation: "MBP.common.validation",
    internal: "MBP.common.internal",
  },
  edge: {
    authInvalidKey: "MBP.edge.auth.invalid_key",
    rateLimited: "MBP.edge.rate_limited",
    siteMismatch: "MBP.edge.site_mismatch",
    deliveryNotFound: "MBP.edge.delivery.not_found",
    deliveryNotInProgress: "MBP.edge.delivery.not_in_progress",
    ingestNoMeasurements: "MBP.edge.ingest.no_measurements",
    ingestDuplicate: "MBP.edge.ingest.duplicate_idempotency",
  },
  billing: {
    invoiceDuplicate: "MBP.billing.invoice.duplicate",
    custodyInvalid: "MBP.billing.custody.invalid",
    quantityZero: "MBP.billing.quantity.zero",
  },
  delivery: {
    notFound: "MBP.delivery.not_found",
    forbidden: "MBP.delivery.forbidden",
    contractRequired: "MBP.delivery.contract_required",
    invalidState: "MBP.delivery.invalid_state",
    preflightIncomplete: "MBP.delivery.preflight_incomplete",
    custodyGrossIncomplete: "MBP.delivery.custody_gross_incomplete",
  },
  meter: {
    integrationInvalid: "MBP.meter.integration.invalid_json",
  },
  jobs: {
    unauthorized: "MBP.jobs.unauthorized",
  },
} as const;

export type ErrorCode = string;

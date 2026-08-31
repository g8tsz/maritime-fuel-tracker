import { MBP } from "./codes";

export type ErrorDefinition = {
  httpStatus: number;
  /** Safe for UI; no secrets. */
  userMessage: string;
};

export const ERROR_CATALOG: Record<string, ErrorDefinition> = {
  [MBP.common.unauthorized]: { httpStatus: 401, userMessage: "Authentication required." },
  [MBP.common.forbidden]: { httpStatus: 403, userMessage: "You do not have access to this resource." },
  [MBP.common.validation]: { httpStatus: 400, userMessage: "Request validation failed." },
  [MBP.common.internal]: { httpStatus: 500, userMessage: "Something went wrong. Please try again." },

  [MBP.edge.authInvalidKey]: { httpStatus: 401, userMessage: "Invalid or missing edge device credentials." },
  [MBP.edge.rateLimited]: { httpStatus: 429, userMessage: "Too many requests from this device or network." },
  [MBP.edge.siteMismatch]: { httpStatus: 403, userMessage: "Device is not authorized for this site." },
  [MBP.edge.deliveryNotFound]: { httpStatus: 404, userMessage: "Delivery not found for this berth." },
  [MBP.edge.deliveryNotInProgress]: { httpStatus: 409, userMessage: "Delivery is not accepting live meter data." },
  [MBP.edge.ingestNoMeasurements]: { httpStatus: 400, userMessage: "No mass or volume measurements were provided." },

  [MBP.billing.invoiceDuplicate]: { httpStatus: 409, userMessage: "This delivery is already invoiced." },
  [MBP.billing.custodyInvalid]: { httpStatus: 400, userMessage: "Custody data does not match the contract pricing basis." },
  [MBP.billing.quantityZero]: { httpStatus: 400, userMessage: "Billable quantity is zero." },

  [MBP.delivery.notFound]: { httpStatus: 404, userMessage: "Delivery not found." },
  [MBP.delivery.forbidden]: { httpStatus: 403, userMessage: "You cannot modify this delivery." },
  [MBP.delivery.contractRequired]: { httpStatus: 400, userMessage: "A contract is required for this action." },
  [MBP.delivery.invalidState]: { httpStatus: 409, userMessage: "This action is not allowed in the current delivery state." },
  [MBP.delivery.preflightIncomplete]: {
    httpStatus: 409,
    userMessage: "Complete all required pre-bunker checklist items before closing custody.",
  },
  [MBP.delivery.custodyGrossIncomplete]: {
    httpStatus: 400,
    userMessage: "Gross metered mass requires hose length, inner diameter, and density to compute line contents.",
  },

  [MBP.meter.integrationInvalid]: { httpStatus: 400, userMessage: "Meter integration configuration is invalid." },

  [MBP.jobs.unauthorized]: { httpStatus: 401, userMessage: "Job worker authentication failed." },
};

export function resolveError(code: string): ErrorDefinition {
  return ERROR_CATALOG[code] ?? ERROR_CATALOG[MBP.common.internal]!;
}

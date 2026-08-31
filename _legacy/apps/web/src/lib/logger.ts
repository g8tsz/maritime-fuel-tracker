export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogFields = {
  level: LogLevel;
  code?: string;
  msg: string;
  correlationId?: string;
  siteId?: string;
  stationId?: string;
  deliveryId?: string;
  edgeDeviceId?: string;
  durationMs?: number;
  apiVersion?: string;
  [key: string]: unknown;
};

/** Structured JSON logs for aggregators / admin. */
export function logJson(fields: LogFields) {
  const line = JSON.stringify({ ts: new Date().toISOString(), ...fields });
  if (fields.level === "error" || fields.level === "warn") {
    console.error(line);
  } else {
    console.log(line);
  }
}

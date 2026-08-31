import { z } from "zod";
import { cuid, decimalString } from "./common";

export const edgeReadingSchema = z.object({
  siteId: cuid,
  berthLineId: cuid,
  deliveryId: cuid,
  observedAt: z.string().datetime(),
  /// Totalizer / Coriolis cumulative mass at observation time (preferred for custody).
  cumulativeMassKg: decimalString.optional(),
  cumulativeVolumeM3: decimalString.optional(),
  /// Legacy: net delivered snapshot when no cumulative fields are supplied.
  massKg: decimalString.optional(),
  massRateKgs: decimalString.optional(),
  volumeM3: decimalString.optional(),
  volumeRateM3s: decimalString.optional(),
  tempC: decimalString.optional(),
  densityKgM3: decimalString.optional(),
  /// Hub / ultrasonic quality of service (0–100). JSON number only (no string coercion).
  signalQuality: z.number().int().min(0).max(100).optional(),
  pressureBar: decimalString.optional(),
  tankLevelM: decimalString.optional(),
  pumpRunning: z.boolean().optional(),
  rawPayload: z.record(z.string(), z.unknown()).optional(),
});

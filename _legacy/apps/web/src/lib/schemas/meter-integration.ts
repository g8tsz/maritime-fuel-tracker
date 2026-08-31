import { z } from "zod";

/** Validates `MeterProfile.integrationJson` before save / CI. */
export const meterIntegrationSchema = z.object({
  protocol: z.enum(["modbus_tcp", "opcua", "simulator"]).default("simulator"),
  host: z.string().optional(),
  port: z.coerce.number().int().positive().optional(),
  holdingRegisters: z.record(z.string(), z.coerce.number().int().nonnegative()).optional(),
  opcNodes: z.record(z.string(), z.string()).optional(),
  notes: z.string().max(4000).optional(),
});

export type MeterIntegration = z.infer<typeof meterIntegrationSchema>;

export function parseMeterIntegrationJson(raw: string): MeterIntegration {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw || "{}");
  } catch {
    throw new Error("invalid_json");
  }
  return meterIntegrationSchema.parse(parsed);
}

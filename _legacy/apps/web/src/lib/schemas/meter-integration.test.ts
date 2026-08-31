import { describe, expect, it } from "vitest";
import { meterIntegrationSchema, parseMeterIntegrationJson } from "./meter-integration";

describe("meterIntegrationSchema", () => {
  it("accepts demo seed shape", () => {
    const raw = JSON.stringify({
      protocol: "modbus_tcp",
      host: "127.0.0.1",
      port: 502,
      holdingRegisters: { massKg: 40001 },
      notes: "ok",
    });
    expect(() => parseMeterIntegrationJson(raw)).not.toThrow();
  });

  it("rejects bad protocol", () => {
    expect(() =>
      meterIntegrationSchema.parse({
        protocol: "unknown",
      }),
    ).toThrow();
  });
});

import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { computeLineContentsMassKg, hoseVolumeM3 } from "./line-contents";

describe("computeLineContentsMassKg", () => {
  it("matches cylinder volume × density (30m × 101.6mm @ 941 kg/m³)", () => {
    const d = new Prisma.Decimal("941");
    const m = computeLineContentsMassKg(30, 101.6, d);
    const vol = hoseVolumeM3(30, 101.6);
    expect(vol.mul(d).toString()).toBe(m.toString());
  });
});

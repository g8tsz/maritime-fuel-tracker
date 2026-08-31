import { z } from "zod";
import { cuid, decimalString } from "./common";

const optionalCuid = z.union([z.literal(""), cuid]).transform((v) => (v === "" ? null : v));

export const createDeliverySchema = z.object({
  siteId: cuid,
  berthLineId: cuid,
  customerId: cuid,
  vesselId: optionalCuid,
  fuelGradeId: cuid,
  contractId: optionalCuid,
});

const optionalPositiveFloat = z.preprocess((v) => {
  if (v === "" || v === undefined || v === null) return undefined;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}, z.number().positive().optional());

export const manualCustodySchema = z
  .object({
    rawMassKg: decimalString.optional(),
    rawVolumeM3: decimalString.optional(),
    avgTempC: decimalString.optional(),
    densityKgM3: decimalString.optional(),
    vcfStandard: z.string().optional(),
    /// If set with hose + density, net raw mass = gross − line contents.
    grossMeteredMassKg: decimalString.optional(),
    hoseLengthM: optionalPositiveFloat,
    hoseInnerDiameterMm: optionalPositiveFloat,
  })
  .superRefine((d, ctx) => {
    if (!d.rawMassKg && !d.grossMeteredMassKg) {
      ctx.addIssue({ code: "custom", message: "Enter net raw mass (kg) or gross metered mass with hose correction." });
    }
    if (d.grossMeteredMassKg && (!d.hoseLengthM || !d.hoseInnerDiameterMm || !d.densityKgM3)) {
      ctx.addIssue({
        code: "custom",
        path: ["grossMeteredMassKg"],
        message: "Gross metered mass requires hose length, inner diameter (mm), and density (kg/m³).",
      });
    }
  });

export const estimateSchema = z.object({
  estMassKg: decimalString.optional(),
  estCost: decimalString.optional(),
});

export const reconSchema = z.object({
  shipReportedMassKg: decimalString,
  notes: z.string().optional(),
});

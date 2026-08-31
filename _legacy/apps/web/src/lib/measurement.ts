import type { Contract, PricingBasis } from "@prisma/client";
import { Prisma } from "@prisma/client";

/**
 * Commercial rounding: mass to nearest `roundingKg` kg; volume to `roundingM3` decimal places.
 */
export function roundMassKg(rawKg: Prisma.Decimal, stepKg: number): Prisma.Decimal {
  const n = Number(rawKg);
  const rounded = Math.round(n / stepKg) * stepKg;
  return new Prisma.Decimal(rounded);
}

export function roundVolumeM3(rawM3: Prisma.Decimal, decimals: number): Prisma.Decimal {
  const f = Number(rawM3);
  const p = 10 ** decimals;
  return new Prisma.Decimal(Math.round(f * p) / p);
}

export function computeBillableQuantities(params: {
  basis: PricingBasis;
  rawMassKg?: Prisma.Decimal | null;
  rawVolumeM3?: Prisma.Decimal | null;
  contract: Pick<Contract, "roundingKg" | "roundingM3">;
}) {
  const { basis, rawMassKg, rawVolumeM3, contract } = params;
  const step = contract.roundingKg;
  const dec = contract.roundingM3;

  let commercialMassKg: Prisma.Decimal | null = null;
  let commercialVolumeM3: Prisma.Decimal | null = null;

  if (rawMassKg != null) {
    commercialMassKg = roundMassKg(rawMassKg, step);
  }
  if (rawVolumeM3 != null) {
    commercialVolumeM3 = roundVolumeM3(rawVolumeM3, dec);
  }

  if (basis === "PER_MT" && commercialMassKg == null && commercialVolumeM3 != null) {
    // Caller should supply mass; keep volume only.
  }

  return { commercialMassKg, commercialVolumeM3 };
}

export type EstimateResult =
  | { ok: true; subtotal: Prisma.Decimal; tax: Prisma.Decimal; total: Prisma.Decimal }
  | { ok: false; reason: string };

export function estimateDeliveryCost(params: {
  basis: PricingBasis;
  estMassKg?: Prisma.Decimal | null;
  estVolumeM3?: Prisma.Decimal | null;
  unitPrice: Prisma.Decimal;
  taxRate: Prisma.Decimal;
}): EstimateResult {
  let sub = new Prisma.Decimal(0);
  if (params.basis === "PER_MT") {
    if (!params.estMassKg) {
      return {
        ok: false,
        reason: "This contract is priced per MT — enter an estimated mass (kg) to compute cost.",
      };
    }
    sub = params.estMassKg.div(1000).mul(params.unitPrice);
  } else if (params.basis === "PER_M3_AT_15C" || params.basis === "PER_M3_AT_DELIVERY_TEMP") {
    if (!params.estVolumeM3) {
      return {
        ok: false,
        reason: "This contract is priced per m³ — enter an estimated volume (m³) to compute cost.",
      };
    }
    sub = params.estVolumeM3.mul(params.unitPrice);
  }
  if (sub.lte(0)) {
    return { ok: false, reason: "Estimated cost is zero — check inputs against contract pricing basis." };
  }
  const tax = sub.mul(params.taxRate);
  return { ok: true, subtotal: sub, tax, total: sub.add(tax) };
}

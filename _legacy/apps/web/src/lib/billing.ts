import type { Contract, Customer, Delivery, PricingBasis } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { computeBillableQuantities } from "./measurement";

function quantityForBasis(
  basis: PricingBasis,
  commercialMassKg: Prisma.Decimal | null,
  commercialVolumeM3: Prisma.Decimal | null,
) {
  if (basis === "PER_MT") {
    const kg = commercialMassKg ?? new Prisma.Decimal(0);
    return { quantity: kg.div(1000), unit: "MT" as const };
  }
  const m3 = commercialVolumeM3 ?? new Prisma.Decimal(0);
  return { quantity: m3, unit: "m3" as const };
}

export function buildInvoiceTotalsFromDelivery(delivery: Delivery, contract: Contract) {
  const { commercialMassKg, commercialVolumeM3 } = computeBillableQuantities({
    basis: contract.basis,
    rawMassKg: delivery.rawMassKg,
    rawVolumeM3: delivery.rawVolumeM3,
    contract,
  });

  const { quantity, unit } = quantityForBasis(contract.basis, commercialMassKg, commercialVolumeM3);
  const unitPrice = contract.unitPrice;
  const subtotal = quantity.mul(unitPrice);
  const tax = subtotal.mul(contract.taxRate);
  const total = subtotal.add(tax);
  return {
    commercialMassKg,
    commercialVolumeM3,
    quantity,
    unit,
    unitPrice,
    subtotal,
    tax,
    total,
  };
}

export function custodyGapReason(
  basis: PricingBasis,
  rawMassKg: Prisma.Decimal | null | undefined,
  rawVolumeM3: Prisma.Decimal | null | undefined,
): string | null {
  if (basis === "PER_MT") {
    if (rawMassKg == null) return "Contract is priced per MT but no mass custody figure is recorded.";
    if (new Prisma.Decimal(rawMassKg).lte(0)) return "Mass custody must be greater than zero for MT pricing.";
    return null;
  }
  if (rawVolumeM3 == null) return "Contract is priced per m³ but no volume custody figure is recorded.";
  if (new Prisma.Decimal(rawVolumeM3).lte(0)) return "Volume custody must be greater than zero for m³ pricing.";
  return null;
}

export type BillableValidation =
  | { ok: true; totals: ReturnType<typeof buildInvoiceTotalsFromDelivery> }
  | { ok: false; reason: string };

export function validateDeliveryForBilling(delivery: Delivery, contract: Contract): BillableValidation {
  const gap = custodyGapReason(contract.basis, delivery.rawMassKg, delivery.rawVolumeM3);
  if (gap) return { ok: false, reason: gap };
  const totals = buildInvoiceTotalsFromDelivery(delivery, contract);
  if (totals.quantity.lte(0)) {
    return { ok: false, reason: "Computed billable quantity is zero — check contract basis vs custody inputs." };
  }
  return { ok: true, totals };
}

export function nextInvoiceNumber(): string {
  const y = new Date().getUTCFullYear();
  const r = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `INV-${y}-${r}`;
}

export function nextBdnNumber(): string {
  const y = new Date().getUTCFullYear();
  const r = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `BDN-${y}-${r}`;
}

export function invoiceLineDescription(customer: Customer, delivery: Delivery) {
  return `Bunker delivery ${delivery.id} — ${customer.name}`;
}

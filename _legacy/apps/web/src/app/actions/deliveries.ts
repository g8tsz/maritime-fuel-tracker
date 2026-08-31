"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth-context";
import { canOnSite } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { buildBunkerDeliveryNotePdf } from "@/lib/bdn";
import {
  custodyGapReason,
  invoiceLineDescription,
  nextBdnNumber,
  nextInvoiceNumber,
  validateDeliveryForBilling,
} from "@/lib/billing";
import { Prisma } from "@prisma/client";
import { computeBillableQuantities, estimateDeliveryCost } from "@/lib/measurement";
import { createDeliverySchema, estimateSchema, manualCustodySchema, reconSchema } from "@/lib/schemas/delivery";
import { FUELTRACE_PREFLIGHT_ITEMS } from "@/lib/fueltrace/preflight-template";
import { computeLineContentsMassKg } from "@/lib/fueltrace/line-contents";

export type EstimateState = { error?: string };

export async function createDelivery(formData: FormData) {
  const user = await getSessionUser();
  if (!user) throw new Error("Unauthorized");
  const parsed = createDeliverySchema.parse({
    siteId: String(formData.get("siteId")),
    berthLineId: String(formData.get("berthLineId")),
    customerId: String(formData.get("customerId")),
    vesselId: formData.get("vesselId") ? String(formData.get("vesselId")) : null,
    fuelGradeId: String(formData.get("fuelGradeId")),
    contractId: formData.get("contractId") ? String(formData.get("contractId")) : null,
  });
  if (!canOnSite(user.memberships, parsed.siteId, "delivery.write")) throw new Error("Forbidden");
  const berth = await prisma.berthLine.findUnique({ where: { id: parsed.berthLineId } });
  if (!berth || berth.siteId !== parsed.siteId) throw new Error("Invalid berth line for site");
  const d = await prisma.delivery.create({
    data: {
      siteId: parsed.siteId,
      stationId: berth.stationId,
      berthLineId: parsed.berthLineId,
      customerId: parsed.customerId,
      vesselId: parsed.vesselId,
      fuelGradeId: parsed.fuelGradeId,
      contractId: parsed.contractId,
      status: "DRAFT",
    },
  });
  await audit(user.id, "delivery.create", "Delivery", d.id, { siteId: parsed.siteId });
  revalidatePath("/deliveries");
  redirect(`/deliveries/${d.id}`);
}

export async function saveEstimateAction(_prev: EstimateState, formData: FormData): Promise<EstimateState> {
  const user = await getSessionUser();
  if (!user) return { error: "Unauthorized" };
  const deliveryId = String(formData.get("deliveryId") ?? "");
  if (!deliveryId) return { error: "Missing delivery" };
  const d = await prisma.delivery.findUnique({ where: { id: deliveryId }, include: { contract: true } });
  if (!d) return { error: "Not found" };
  if (!canOnSite(user.memberships, d.siteId, "delivery.write")) return { error: "Forbidden" };
  const est = estimateSchema.parse({
    estMassKg: formData.get("estMassKg") || undefined,
    estCost: undefined,
  });
  const estVolumeM3 = formData.get("estVolumeM3") ? String(formData.get("estVolumeM3")) : null;
  let estCost: Prisma.Decimal | null = null;
  let estimateError: string | undefined;
  if (d.contract) {
    const res = estimateDeliveryCost({
      basis: d.contract.basis,
      estMassKg: est.estMassKg ? new Prisma.Decimal(est.estMassKg) : null,
      estVolumeM3: estVolumeM3 ? new Prisma.Decimal(estVolumeM3) : null,
      unitPrice: d.contract.unitPrice,
      taxRate: d.contract.taxRate,
    });
    if (res.ok) {
      estCost = res.total;
    } else {
      estimateError = res.reason;
    }
  }
  await prisma.delivery.update({
    where: { id: deliveryId },
    data: {
      estMassKg: est.estMassKg ? new Prisma.Decimal(est.estMassKg) : null,
      estVolumeM3: estVolumeM3 ? new Prisma.Decimal(estVolumeM3) : null,
      estCost,
    },
  });
  await audit(user.id, "delivery.estimate", "Delivery", deliveryId, {});
  revalidatePath(`/deliveries/${deliveryId}`);
  return estimateError ? { error: estimateError } : {};
}

export async function startDelivery(deliveryId: string) {
  const user = await getSessionUser();
  if (!user) throw new Error("Unauthorized");
  const d = await prisma.delivery.findUnique({ where: { id: deliveryId } });
  if (!d) throw new Error("Not found");
  if (!canOnSite(user.memberships, d.siteId, "delivery.write")) throw new Error("Forbidden");
  await prisma.deliveryPreFlightItem.deleteMany({ where: { deliveryId } });
  await prisma.delivery.update({
    where: { id: deliveryId },
    data: {
      status: "IN_PROGRESS",
      startedAt: new Date(),
      meterStartMassKg: null,
      meterStartVolumeM3: null,
      meterStopMassKg: null,
      meterStopVolumeM3: null,
      edgeLastCumulativeMassKg: null,
      edgeLastCumulativeVolumeM3: null,
      rawMassKg: null,
      rawVolumeM3: null,
      grossMeteredMassKg: null,
      lineContentsMassKg: null,
      hoseLengthM: null,
      hoseInnerDiameterMm: null,
      commercialMassKg: null,
      commercialVolumeM3: null,
      anomalyScore: null,
      anomalyFactorsJson: "{}",
      zeroVerificationPassedAt: null,
      zeroDriftKgPerHr: null,
    },
  });
  await prisma.deliveryPreFlightItem.createMany({
    data: FUELTRACE_PREFLIGHT_ITEMS.map((it) => ({
      deliveryId,
      key: it.key,
      label: it.label,
      required: it.required,
    })),
  });
  await audit(user.id, "delivery.start", "Delivery", deliveryId, {});
  revalidatePath(`/deliveries/${deliveryId}`);
}

export async function completeDeliveryManual(deliveryId: string, formData: FormData) {
  const user = await getSessionUser();
  if (!user) throw new Error("Unauthorized");
  const d = await prisma.delivery.findUnique({ where: { id: deliveryId }, include: { contract: true } });
  if (!d) throw new Error("Not found");
  if (!canOnSite(user.memberships, d.siteId, "delivery.complete")) throw new Error("Forbidden");
  if (!d.contract) throw new Error("Contract required for custody completion");
  const incomplete = await prisma.deliveryPreFlightItem.count({
    where: { deliveryId, required: true, completedAt: null },
  });
  if (incomplete > 0) {
    throw new Error(`Complete all required pre-bunker checklist items first (${incomplete} remaining).`);
  }
  const formHoseLen = formData.get("hoseLengthM");
  const formHoseDia = formData.get("hoseInnerDiameterMm");
  const hoseLengthM =
    formHoseLen != null && String(formHoseLen).trim() !== ""
      ? formHoseLen
      : d.hoseLengthM != null
        ? d.hoseLengthM
        : undefined;
  const hoseInnerDiameterMm =
    formHoseDia != null && String(formHoseDia).trim() !== ""
      ? formHoseDia
      : d.hoseInnerDiameterMm != null
        ? d.hoseInnerDiameterMm
        : undefined;
  const parsed = manualCustodySchema.safeParse({
    rawMassKg: formData.get("rawMassKg") || undefined,
    rawVolumeM3: formData.get("rawVolumeM3") || undefined,
    avgTempC: formData.get("avgTempC") || undefined,
    densityKgM3: formData.get("densityKgM3") || undefined,
    vcfStandard: formData.get("vcfStandard") || undefined,
    grossMeteredMassKg: formData.get("grossMeteredMassKg") || undefined,
    hoseLengthM,
    hoseInnerDiameterMm,
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid custody form");
  }
  const m = parsed.data;

  let rawMassKg: Prisma.Decimal | null = m.rawMassKg ? new Prisma.Decimal(m.rawMassKg) : null;
  let grossMeteredMassKg: Prisma.Decimal | null = null;
  let lineContentsMassKg: Prisma.Decimal | null = null;
  if (m.grossMeteredMassKg && m.hoseLengthM != null && m.hoseInnerDiameterMm != null && m.densityKgM3) {
    const density = new Prisma.Decimal(m.densityKgM3);
    const line = computeLineContentsMassKg(m.hoseLengthM, m.hoseInnerDiameterMm, density);
    const gross = new Prisma.Decimal(m.grossMeteredMassKg);
    grossMeteredMassKg = gross;
    lineContentsMassKg = line;
    rawMassKg = gross.sub(line);
  }

  const rawVolumeM3 = m.rawVolumeM3 ? new Prisma.Decimal(m.rawVolumeM3) : null;
  const gap = custodyGapReason(d.contract.basis, rawMassKg, rawVolumeM3);
  if (gap) throw new Error(gap);
  const { commercialMassKg, commercialVolumeM3 } = computeBillableQuantities({
    basis: d.contract.basis,
    rawMassKg,
    rawVolumeM3,
    contract: d.contract,
  });
  await prisma.delivery.update({
    where: { id: deliveryId },
    data: {
      status: "COMPLETED",
      endedAt: new Date(),
      rawMassKg,
      rawVolumeM3,
      grossMeteredMassKg: grossMeteredMassKg ?? undefined,
      lineContentsMassKg: lineContentsMassKg ?? undefined,
      hoseLengthM: m.hoseLengthM ?? d.hoseLengthM ?? undefined,
      hoseInnerDiameterMm: m.hoseInnerDiameterMm ?? d.hoseInnerDiameterMm ?? undefined,
      avgTempC: m.avgTempC ? new Prisma.Decimal(m.avgTempC) : null,
      densityKgM3: m.densityKgM3 ? new Prisma.Decimal(m.densityKgM3) : null,
      vcfStandard: m.vcfStandard ?? null,
      commercialMassKg,
      commercialVolumeM3,
      meterStartMassKg: rawMassKg != null ? new Prisma.Decimal(0) : null,
      meterStopMassKg: rawMassKg,
      meterStartVolumeM3: rawVolumeM3 != null ? new Prisma.Decimal(0) : null,
      meterStopVolumeM3: rawVolumeM3,
    },
  });
  await audit(user.id, "delivery.complete", "Delivery", deliveryId, {});
  revalidatePath(`/deliveries/${deliveryId}`);
}

export async function generateBdn(deliveryId: string) {
  const user = await getSessionUser();
  if (!user) throw new Error("Unauthorized");
  const d = await prisma.delivery.findUnique({
    where: { id: deliveryId },
    include: { site: true, customer: true, vessel: true, fuelGrade: true, contract: true },
  });
  if (!d) throw new Error("Not found");
  if (!canOnSite(user.memberships, d.siteId, "delivery.write")) throw new Error("Forbidden");
  if (d.status !== "COMPLETED" || !d.contract) throw new Error("Delivery must be completed with contract");
  const billable = validateDeliveryForBilling(d, d.contract);
  if (!billable.ok) throw new Error(billable.reason);
  const totals = billable.totals;
  const number = nextBdnNumber();
  const pdf = await buildBunkerDeliveryNotePdf({
    bdnNumber: number,
    delivery: d,
    site: d.site,
    customer: d.customer,
    vessel: d.vessel,
    commercialMassKg: totals.commercialMassKg,
    commercialVolumeM3: totals.commercialVolumeM3,
  });
  await prisma.bunkerDeliveryNote.upsert({
    where: { deliveryId },
    create: {
      deliveryId,
      number,
      pdfBlob: Buffer.from(pdf),
    },
    update: {
      number,
      pdfBlob: Buffer.from(pdf),
    },
  });
  await audit(user.id, "bdn.generate", "BunkerDeliveryNote", deliveryId, { number });
  revalidatePath(`/deliveries/${deliveryId}`);
}

export async function issueInvoice(deliveryId: string) {
  const user = await getSessionUser();
  if (!user) throw new Error("Unauthorized");
  const d = await prisma.delivery.findUnique({
    where: { id: deliveryId },
    include: { contract: true, customer: true },
  });
  if (!d) throw new Error("Not found");
  if (!canOnSite(user.memberships, d.siteId, "invoice.write")) throw new Error("Forbidden");
  if (!d.contract) throw new Error("Contract required");
  if (d.status !== "COMPLETED") throw new Error("Delivery not completed");
  const existing = await prisma.invoiceLine.findUnique({ where: { deliveryId } });
  if (existing) throw new Error("This delivery is already linked to an invoice line.");
  const billable = validateDeliveryForBilling(d, d.contract);
  if (!billable.ok) throw new Error(billable.reason);
  const totals = billable.totals;
  try {
    const inv = await prisma.invoice.create({
      data: {
        customerId: d.customerId,
        number: nextInvoiceNumber(),
        status: "ISSUED",
        currency: d.contract.currency,
        subtotal: totals.subtotal,
        tax: totals.tax,
        total: totals.total,
        issuedAt: new Date(),
        lines: {
          create: [
            {
              deliveryId,
              description: invoiceLineDescription(d.customer, d),
              quantity: totals.quantity,
              unit: totals.unit,
              unitPrice: totals.unitPrice,
              lineTotal: totals.subtotal,
            },
          ],
        },
      },
    });
    await audit(user.id, "invoice.issue", "Invoice", inv.id, { deliveryId });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new Error("This delivery is already invoiced (unique constraint).");
    }
    throw e;
  }
  revalidatePath(`/deliveries/${deliveryId}`);
  revalidatePath("/invoices");
}

export async function submitReconciliation(deliveryId: string, formData: FormData) {
  const user = await getSessionUser();
  if (!user) throw new Error("Unauthorized");
  const d = await prisma.delivery.findUnique({ where: { id: deliveryId }, include: { contract: true } });
  if (!d) throw new Error("Not found");
  if (!canOnSite(user.memberships, d.siteId, "recon.write")) throw new Error("Forbidden");
  const r = reconSchema.parse({
    shipReportedMassKg: String(formData.get("shipReportedMassKg")),
    notes: formData.get("notes") ? String(formData.get("notes")) : undefined,
  });
  const shipKg = new Prisma.Decimal(r.shipReportedMassKg);
  const meterKg = d.commercialMassKg ?? d.rawMassKg ?? new Prisma.Decimal(0);
  const varianceKg = shipKg.sub(meterKg);
  const band = d.contract?.reconVarianceKg ?? new Prisma.Decimal(500);
  const accepted = varianceKg.abs().lte(band);
  await prisma.reconciliationCase.upsert({
    where: { deliveryId },
    create: {
      deliveryId,
      shipReportedMassKg: shipKg,
      varianceKg,
      status: accepted ? "ACCEPTED" : "DISPUTED",
      notes: r.notes ?? null,
    },
    update: {
      shipReportedMassKg: shipKg,
      varianceKg,
      status: accepted ? "ACCEPTED" : "DISPUTED",
      notes: r.notes ?? null,
    },
  });
  await prisma.delivery.update({
    where: { id: deliveryId },
    data: { status: "RECONCILED" },
  });
  await audit(user.id, "recon.submit", "ReconciliationCase", deliveryId, {});
  revalidatePath(`/deliveries/${deliveryId}`);
}

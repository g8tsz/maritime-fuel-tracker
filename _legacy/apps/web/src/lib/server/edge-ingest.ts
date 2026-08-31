import type { PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { MBP } from "@/lib/errors/codes";
import { AppError } from "@/lib/errors/app-error";
import { edgeReadingSchema } from "@/lib/schemas/edge";
import { mergeFactorScores, scoreEdgeSample } from "@/lib/fueltrace/anomaly";

export type EdgeDeviceCtx = { id: string; siteId: string; name: string };

export async function ingestEdgeReading(
  prisma: PrismaClient,
  params: {
    body: unknown;
    device: EdgeDeviceCtx;
    correlationId: string;
    apiVersion: "v1" | "v2";
    idempotencyKey?: string | null;
  },
): Promise<{ duplicate: boolean; apiVersion: "v1" | "v2" }> {
  const parsed = edgeReadingSchema.safeParse(params.body);
  if (!parsed.success) {
    throw new AppError(MBP.common.validation, "Invalid payload", parsed.error.flatten());
  }
  const body = parsed.data;
  if (body.siteId !== params.device.siteId) {
    throw new AppError(MBP.edge.siteMismatch);
  }

  const idemFromRequest = params.idempotencyKey?.trim() || undefined;

  if (idemFromRequest) {
    const seen = await prisma.edgeIdempotencyRecord.findUnique({ where: { key: idemFromRequest } });
    if (seen) return { duplicate: true, apiVersion: params.apiVersion };
  }

  const delivery = await prisma.delivery.findFirst({
    where: { id: body.deliveryId, siteId: body.siteId, berthLineId: body.berthLineId },
    include: { berthLine: { include: { meter: true } } },
  });
  if (!delivery) throw new AppError(MBP.edge.deliveryNotFound);
  if (delivery.status !== "IN_PROGRESS") {
    throw new AppError(MBP.edge.deliveryNotInProgress);
  }

  const hasCumMass = body.cumulativeMassKg != null && String(body.cumulativeMassKg).length > 0;
  const hasCumVol = body.cumulativeVolumeM3 != null && String(body.cumulativeVolumeM3).length > 0;
  const hasNetMass = body.massKg != null && String(body.massKg).length > 0;
  const hasNetVol = body.volumeM3 != null && String(body.volumeM3).length > 0;
  if (!hasCumMass && !hasCumVol && !hasNetMass && !hasNetVol) {
    throw new AppError(MBP.edge.ingestNoMeasurements);
  }

  const payloadMeta = {
    cumulativeMassKg: hasCumMass ? String(body.cumulativeMassKg) : undefined,
    cumulativeVolumeM3: hasCumVol ? String(body.cumulativeVolumeM3) : undefined,
    netMassKg: hasCumMass ? undefined : hasNetMass ? String(body.massKg) : undefined,
    netVolumeM3: hasCumVol ? undefined : hasNetVol ? String(body.volumeM3) : undefined,
    idempotencyKey: idemFromRequest,
    apiVersion: params.apiVersion,
  };

  try {
    await prisma.$transaction(async (tx) => {
      if (idemFromRequest) {
        await tx.edgeIdempotencyRecord.create({
          data: { key: idemFromRequest, deliveryId: delivery.id },
        });
      }

      const prevReading = await tx.measurementReading.findFirst({
        where: { deliveryId: delivery.id },
        orderBy: { observedAt: "desc" },
      });

      let rawMassKg: Prisma.Decimal | null | undefined = delivery.rawMassKg ?? undefined;
      let rawVolumeM3: Prisma.Decimal | null | undefined = delivery.rawVolumeM3 ?? undefined;
      let meterStartMassKg = delivery.meterStartMassKg ?? undefined;
      let meterStartVolumeM3 = delivery.meterStartVolumeM3 ?? undefined;
      let edgeLastCumulativeMassKg = delivery.edgeLastCumulativeMassKg ?? undefined;
      let edgeLastCumulativeVolumeM3 = delivery.edgeLastCumulativeVolumeM3 ?? undefined;

      if (hasCumMass) {
        const cum = new Prisma.Decimal(body.cumulativeMassKg!);
        if (delivery.meterStartMassKg == null) {
          meterStartMassKg = cum;
          rawMassKg = new Prisma.Decimal(0);
        } else {
          meterStartMassKg = delivery.meterStartMassKg;
          rawMassKg = cum.sub(delivery.meterStartMassKg);
        }
        edgeLastCumulativeMassKg = cum;
      } else if (hasNetMass) {
        rawMassKg = new Prisma.Decimal(body.massKg!);
      }

      if (hasCumVol) {
        const cumV = new Prisma.Decimal(body.cumulativeVolumeM3!);
        if (delivery.meterStartVolumeM3 == null) {
          meterStartVolumeM3 = cumV;
          rawVolumeM3 = new Prisma.Decimal(0);
        } else {
          meterStartVolumeM3 = delivery.meterStartVolumeM3;
          rawVolumeM3 = cumV.sub(delivery.meterStartVolumeM3);
        }
        edgeLastCumulativeVolumeM3 = cumV;
      } else if (hasNetVol) {
        rawVolumeM3 = new Prisma.Decimal(body.volumeM3!);
      }

      const source = `edge_${params.apiVersion}`;

      await tx.measurementReading.create({
        data: {
          deliveryId: delivery.id,
          meterProfileId: delivery.berthLine.meter?.id,
          observedAt: new Date(body.observedAt),
          massKg: hasCumMass
            ? new Prisma.Decimal(body.cumulativeMassKg!)
            : body.massKg
              ? new Prisma.Decimal(body.massKg)
              : null,
          massRateKgs: body.massRateKgs ? new Prisma.Decimal(body.massRateKgs) : null,
          volumeM3: hasCumVol
            ? new Prisma.Decimal(body.cumulativeVolumeM3!)
            : body.volumeM3
              ? new Prisma.Decimal(body.volumeM3)
              : null,
          volumeRateM3s: body.volumeRateM3s ? new Prisma.Decimal(body.volumeRateM3s) : null,
          tempC: body.tempC ? new Prisma.Decimal(body.tempC) : null,
          densityKgM3: body.densityKgM3 ? new Prisma.Decimal(body.densityKgM3) : null,
          signalQuality: body.signalQuality ?? null,
          pressureBar: body.pressureBar ? new Prisma.Decimal(body.pressureBar) : null,
          tankLevelM: body.tankLevelM ? new Prisma.Decimal(body.tankLevelM) : null,
          pumpRunning: body.pumpRunning ?? null,
          source,
          rawPayloadJson: JSON.stringify({
            ...payloadMeta,
            edgeDeviceName: params.device.name,
            ...(body.rawPayload ?? {}),
          }),
        },
      });

      const { score, factors } = scoreEdgeSample(
        prevReading
          ? {
              signalQuality: prevReading.signalQuality,
              densityKgM3: prevReading.densityKgM3,
              massRateKgs: prevReading.massRateKgs,
            }
          : null,
        {
          signalQuality: body.signalQuality ?? null,
          densityKgM3: body.densityKgM3 ? new Prisma.Decimal(body.densityKgM3) : null,
          massRateKgs: body.massRateKgs ? new Prisma.Decimal(body.massRateKgs) : null,
        },
      );
      const mergedFactors = mergeFactorScores(delivery.anomalyFactorsJson ?? "{}", factors);
      const nextAnomaly = Math.min(100, Math.max(delivery.anomalyScore ?? 0, score));

      await tx.delivery.update({
        where: { id: delivery.id },
        data: {
          rawMassKg,
          rawVolumeM3,
          avgTempC: body.tempC ? new Prisma.Decimal(body.tempC) : undefined,
          densityKgM3: body.densityKgM3 ? new Prisma.Decimal(body.densityKgM3) : undefined,
          meterStartMassKg,
          meterStartVolumeM3,
          edgeLastCumulativeMassKg,
          edgeLastCumulativeVolumeM3,
          anomalyScore: nextAnomaly,
          anomalyFactorsJson: mergedFactors,
        },
      });
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { duplicate: true, apiVersion: params.apiVersion };
    }
    throw e;
  }

  return { duplicate: false, apiVersion: params.apiVersion };
}

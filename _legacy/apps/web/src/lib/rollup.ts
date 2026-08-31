import type { PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";
import type { RollupGranularity } from "@prisma/client";

function periodEnd(start: Date, g: RollupGranularity): Date {
  const d = new Date(start);
  if (g === "HOUR") d.setUTCHours(d.getUTCHours() + 1);
  else d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

export async function computeStationRollup(
  prisma: PrismaClient,
  stationId: string,
  granularity: RollupGranularity,
  periodStart: Date,
) {
  const end = periodEnd(periodStart, granularity);
  const deliveries = await prisma.delivery.findMany({
    where: {
      stationId,
      createdAt: { gte: periodStart, lt: end },
    },
    select: { rawMassKg: true, rawVolumeM3: true },
  });
  let totalMass = new Prisma.Decimal(0);
  let totalVol = new Prisma.Decimal(0);
  for (const d of deliveries) {
    if (d.rawMassKg) totalMass = totalMass.add(d.rawMassKg);
    if (d.rawVolumeM3) totalVol = totalVol.add(d.rawVolumeM3);
  }
  const errors = await prisma.applicationErrorLog.count({
    where: { stationId, createdAt: { gte: periodStart, lt: end } },
  });
  await prisma.stationMetricRollup.upsert({
    where: {
      stationId_periodStart_granularity: { stationId, periodStart, granularity },
    },
    create: {
      stationId,
      periodStart,
      granularity,
      deliveryCount: deliveries.length,
      errorCount: errors,
      totalRawMassKg: totalMass,
      totalRawVolumeM3: totalVol,
    },
    update: {
      deliveryCount: deliveries.length,
      errorCount: errors,
      totalRawMassKg: totalMass,
      totalRawVolumeM3: totalVol,
    },
  });
}

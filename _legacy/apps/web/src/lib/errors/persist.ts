import type { PrismaClient } from "@prisma/client";

export async function persistApplicationError(
  prisma: PrismaClient,
  row: {
    correlationId?: string | null;
    code: string;
    siteId?: string | null;
    stationId?: string | null;
    deliveryId?: string | null;
    edgeDeviceId?: string | null;
    httpStatus?: number | null;
    message: string;
    details?: unknown;
  },
) {
  await prisma.applicationErrorLog.create({
    data: {
      correlationId: row.correlationId ?? null,
      code: row.code,
      siteId: row.siteId ?? null,
      stationId: row.stationId ?? null,
      deliveryId: row.deliveryId ?? null,
      edgeDeviceId: row.edgeDeviceId ?? null,
      httpStatus: row.httpStatus ?? null,
      message: row.message,
      details: JSON.stringify(row.details ?? {}),
    },
  });
}

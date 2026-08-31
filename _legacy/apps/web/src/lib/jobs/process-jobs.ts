import type { PrismaClient } from "@prisma/client";
import { computeStationRollup } from "@/lib/rollup";

export async function processNextJob(prisma: PrismaClient): Promise<boolean> {
  const job = await prisma.jobQueue.findFirst({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
  });
  if (!job) return false;
  await prisma.jobQueue.update({ where: { id: job.id }, data: { status: "RUNNING" } });
  try {
    const payload = JSON.parse(job.payload || "{}") as { periodStart?: string };
    if (job.type === "STATION_ROLLUP_HOUR" && job.stationId && payload.periodStart) {
      await computeStationRollup(prisma, job.stationId, "HOUR", new Date(payload.periodStart));
    } else if (job.type === "STATION_ROLLUP_DAY" && job.stationId && payload.periodStart) {
      await computeStationRollup(prisma, job.stationId, "DAY", new Date(payload.periodStart));
    } else if (job.type === "ROLLING_RESTART_EDGE") {
      // Placeholder: integrate with edge supervisor / systemd API.
      await new Promise((r) => setTimeout(r, 50));
    }
    await prisma.jobQueue.update({ where: { id: job.id }, data: { status: "COMPLETED", lastError: null } });
  } catch (e) {
    await prisma.jobQueue.update({
      where: { id: job.id },
      data: {
        status: "FAILED",
        lastError: e instanceof Error ? e.message : String(e),
      },
    });
  }
  return true;
}

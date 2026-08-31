"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth-context";

function isControlPlane(user: Awaited<ReturnType<typeof getSessionUser>>) {
  return user?.memberships.some((m) => m.role === "IT_ADMIN" || m.role === "ORG_ADMIN") ?? false;
}

export async function enqueueRollupJobs(stationId: string) {
  const user = await getSessionUser();
  if (!user || !isControlPlane(user)) throw new Error("Forbidden");
  const station = await prisma.station.findFirst({
    where: { id: stationId, site: { organizationId: user.organizationId } },
  });
  if (!station) throw new Error("Station not found");
  const now = new Date();
  const hourStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours(), 0, 0, 0));
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
  await prisma.jobQueue.createMany({
    data: [
      {
        organizationId: user.organizationId,
        stationId,
        type: "STATION_ROLLUP_HOUR",
        payload: JSON.stringify({ periodStart: hourStart.toISOString() }),
      },
      {
        organizationId: user.organizationId,
        stationId,
        type: "STATION_ROLLUP_DAY",
        payload: JSON.stringify({ periodStart: dayStart.toISOString() }),
      },
    ],
  });
  revalidatePath("/admin");
  revalidatePath(`/admin/stations/${stationId}`);
}

export async function enqueueRollingRestartStub(stationId: string) {
  const user = await getSessionUser();
  if (!user || !isControlPlane(user)) throw new Error("Forbidden");
  await prisma.jobQueue.create({
    data: {
      organizationId: user.organizationId,
      stationId,
      type: "ROLLING_RESTART_EDGE",
      payload: JSON.stringify({ requestedBy: user.id, at: new Date().toISOString() }),
    },
  });
  revalidatePath("/admin/jobs");
}

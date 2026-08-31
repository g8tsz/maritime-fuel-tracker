"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth-context";
import { canOnSite } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { FUELTRACE_PREFLIGHT_ITEMS } from "@/lib/fueltrace/preflight-template";

export async function togglePreflightItem(formData: FormData) {
  const user = await getSessionUser();
  if (!user) throw new Error("Unauthorized");
  const deliveryId = String(formData.get("deliveryId") ?? "");
  const key = String(formData.get("key") ?? "");
  const setDone = String(formData.get("setDone") ?? "") === "true";
  if (!deliveryId || !key) throw new Error("Missing delivery or checklist key");
  const d = await prisma.delivery.findUnique({ where: { id: deliveryId } });
  if (!d) throw new Error("Not found");
  if (!canOnSite(user.memberships, d.siteId, "delivery.write")) throw new Error("Forbidden");
  if (d.status !== "IN_PROGRESS") throw new Error("Checklist only while bunkering is in progress");
  const def = FUELTRACE_PREFLIGHT_ITEMS.find((it) => it.key === key);
  if (!def) throw new Error("Unknown checklist key");
  await prisma.deliveryPreFlightItem.upsert({
    where: { deliveryId_key: { deliveryId, key } },
    create: {
      deliveryId,
      key: def.key,
      label: def.label,
      required: def.required,
      completedAt: setDone ? new Date() : null,
    },
    update: { completedAt: setDone ? new Date() : null },
  });
  await audit(user.id, "delivery.preflight.toggle", "Delivery", deliveryId, { key, setDone });
  revalidatePath(`/deliveries/${deliveryId}`);
}

export async function saveHoseProfileAction(formData: FormData) {
  const user = await getSessionUser();
  if (!user) throw new Error("Unauthorized");
  const deliveryId = String(formData.get("deliveryId") ?? "");
  if (!deliveryId) throw new Error("Missing delivery");
  const d = await prisma.delivery.findUnique({ where: { id: deliveryId } });
  if (!d) throw new Error("Not found");
  if (!canOnSite(user.memberships, d.siteId, "delivery.write")) throw new Error("Forbidden");
  if (d.status !== "IN_PROGRESS") throw new Error("Hose profile only while in progress");
  const len = formData.get("hoseLengthM");
  const dia = formData.get("hoseInnerDiameterMm");
  const hoseLengthM = len != null && String(len).trim() !== "" ? Number(len) : null;
  const hoseInnerDiameterMm = dia != null && String(dia).trim() !== "" ? Number(dia) : null;
  if (hoseLengthM != null && (!Number.isFinite(hoseLengthM) || hoseLengthM <= 0)) throw new Error("Invalid hose length");
  if (hoseInnerDiameterMm != null && (!Number.isFinite(hoseInnerDiameterMm) || hoseInnerDiameterMm <= 0)) {
    throw new Error("Invalid hose inner diameter");
  }
  await prisma.delivery.update({
    where: { id: deliveryId },
    data: {
      // Use null (not undefined) so operators can clear saved hose geometry.
      hoseLengthM,
      hoseInnerDiameterMm,
    },
  });
  await audit(user.id, "delivery.hose_profile", "Delivery", deliveryId, {});
  revalidatePath(`/deliveries/${deliveryId}`);
}

export async function markZeroVerificationAction(formData: FormData) {
  const user = await getSessionUser();
  if (!user) throw new Error("Unauthorized");
  const deliveryId = String(formData.get("deliveryId") ?? "");
  if (!deliveryId) throw new Error("Missing delivery");
  const d = await prisma.delivery.findUnique({ where: { id: deliveryId } });
  if (!d) throw new Error("Not found");
  if (!canOnSite(user.memberships, d.siteId, "delivery.write")) throw new Error("Forbidden");
  if (d.status !== "IN_PROGRESS") throw new Error("Zero check only while in progress");
  const drift = formData.get("zeroDriftKgPerHr");
  await prisma.delivery.update({
    where: { id: deliveryId },
    data: {
      zeroVerificationPassedAt: new Date(),
      zeroDriftKgPerHr:
        drift != null && String(drift).trim() !== "" ? new Prisma.Decimal(String(drift)) : null,
    },
  });
  const zeroDef = FUELTRACE_PREFLIGHT_ITEMS.find((it) => it.key === "zero_flow_verified");
  if (zeroDef) {
    await prisma.deliveryPreFlightItem.upsert({
      where: { deliveryId_key: { deliveryId, key: zeroDef.key } },
      create: {
        deliveryId,
        key: zeroDef.key,
        label: zeroDef.label,
        required: zeroDef.required,
        completedAt: new Date(),
      },
      update: { completedAt: new Date() },
    });
  }
  await audit(user.id, "delivery.zero_verify", "Delivery", deliveryId, {});
  revalidatePath(`/deliveries/${deliveryId}`);
}

import { createHash, timingSafeEqual } from "crypto";
import { prisma } from "./prisma";

export function hashApiKey(key: string) {
  return createHash("sha256").update(key, "utf8").digest("hex");
}

export async function authenticateEdgeDevice(apiKey: string | undefined) {
  if (!apiKey) return null;
  const digest = hashApiKey(apiKey);
  const devices = await prisma.edgeDevice.findMany();
  for (const d of devices) {
    const a = Buffer.from(digest, "hex");
    const b = Buffer.from(d.apiKeyHash, "hex");
    if (a.length === b.length && timingSafeEqual(a, b)) {
      await prisma.edgeDevice.update({
        where: { id: d.id },
        data: { lastSeenAt: new Date() },
      });
      return d;
    }
  }
  return null;
}

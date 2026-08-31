import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { authenticateEdgeDevice } from "@/lib/edge-auth";
import { allow } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/client-ip";
import { MBP } from "@/lib/errors/codes";
import { AppError } from "@/lib/errors/app-error";
import { jsonFromAppError, jsonSuccess } from "@/lib/errors/http-response";
import { persistApplicationError } from "@/lib/errors/persist";
import { logJson } from "@/lib/logger";
import { ingestEdgeReading } from "@/lib/server/edge-ingest";
import { CORRELATION_HEADER } from "@/lib/correlation";

const EDGE_WINDOW_MS = 60_000;
const EDGE_MAX = 600;

/** v2: forward-compatible mirror of v1 (same body). */
export async function POST(req: Request) {
  const t0 = Date.now();
  const correlationId = req.headers.get(CORRELATION_HEADER) ?? randomUUID();
  const apiKey = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const idempotencyKey = req.headers.get("idempotency-key") ?? req.headers.get("x-idempotency-key");
  let deviceCtx: { id: string; siteId: string; name: string } | null = null;

  try {
    const device = await authenticateEdgeDevice(apiKey);
    if (!device) throw new AppError(MBP.edge.authInvalidKey);
    deviceCtx = { id: device.id, siteId: device.siteId, name: device.name };

    const ip = getClientIp(req.headers);
    if (!allow(`edge:${device.id}:${ip}`, EDGE_MAX, EDGE_WINDOW_MS)) {
      throw new AppError(MBP.edge.rateLimited);
    }

    const json = await req.json().catch(() => null);
    const result = await ingestEdgeReading(prisma, {
      body: json,
      device: deviceCtx,
      correlationId,
      apiVersion: "v2",
      idempotencyKey,
    });

    logJson({
      level: "info",
      msg: "edge_ingest",
      code: result.duplicate ? "edge.duplicate" : "edge.ok",
      correlationId,
      siteId: device.siteId,
      edgeDeviceId: device.id,
      durationMs: Date.now() - t0,
      apiVersion: "v2",
    });

    if (result.duplicate) {
      return Response.json({ ok: true, duplicate: true, correlationId, apiVersion: "v2" });
    }
    return jsonSuccess(correlationId, { duplicate: false, apiVersion: "v2" });
  } catch (e) {
    const err = e instanceof AppError ? e : new AppError(MBP.common.internal, e instanceof Error ? e.message : String(e));
    logJson({
      level: "error",
      msg: "edge_ingest_failed",
      code: err.code,
      correlationId,
      durationMs: Date.now() - t0,
      apiVersion: "v2",
    });
    await persistApplicationError(prisma, {
      correlationId,
      code: err.code,
      siteId: deviceCtx?.siteId ?? null,
      stationId: null,
      deliveryId: null,
      edgeDeviceId: deviceCtx?.id ?? null,
      httpStatus: err.httpStatus,
      message: err.message,
      details: err.details,
    }).catch(() => {});
    return jsonFromAppError(correlationId, err);
  }
}

import { randomUUID } from "crypto";
import { request } from "undici";
import { loadConfig } from "./config.js";
import { appendOutboxLine, deliverNextOutboxLine } from "./outbox.js";

async function postReading(
  cfg: ReturnType<typeof loadConfig>,
  body: Record<string, unknown>,
  idempotencyKey: string,
) {
  const url = new URL("/api/edge/v1/readings", cfg.CLOUD_BASE_URL).toString();
  const res = await request(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${cfg.EDGE_API_KEY}`,
      "idempotency-key": idempotencyKey,
    },
    body: JSON.stringify(body),
  });
  const text = await res.body.text();
  if (res.statusCode >= 400) {
    throw new Error(`edge post failed ${res.statusCode}: ${text}`);
  }
}

async function main() {
  const cfg = loadConfig();
  // eslint-disable-next-line no-console
  console.log(`edge-gateway online → ${cfg.CLOUD_BASE_URL} (site ${cfg.SITE_ID})`);

  let cumulativeMassKg = 0;
  const rateKgs = 8500;

  setInterval(async () => {
    cumulativeMassKg += (rateKgs * cfg.AGGREGATE_MS) / 1000;
    const payload = {
      siteId: cfg.SITE_ID,
      berthLineId: cfg.BERTH_LINE_ID,
      deliveryId: cfg.DELIVERY_ID,
      observedAt: new Date().toISOString(),
      cumulativeMassKg: cumulativeMassKg.toFixed(3),
      massRateKgs: rateKgs.toFixed(3),
      tempC: "22.5",
      densityKgM3: "945.0",
      rawPayload: { demo: true },
    };
    const idem = randomUUID();
    try {
      await postReading(cfg, payload, idem);
    } catch (e) {
      await appendOutboxLine(cfg.OUTBOX_LOG_PATH, { ...payload, _outboxIdempotencyKey: idem });
    }
  }, cfg.AGGREGATE_MS);

  setInterval(async () => {
    try {
      for (let i = 0; i < 50; i++) {
        const more = await deliverNextOutboxLine(cfg.OUTBOX_LOG_PATH, cfg.outboxCursorPath, async (raw) => {
          const obj = raw as Record<string, unknown>;
          const idem = (obj._outboxIdempotencyKey as string) ?? randomUUID();
          const { _outboxIdempotencyKey: _, ...body } = obj;
          await postReading(cfg, body, idem);
        });
        if (!more) break;
      }
    } catch (e) {
      console.error("outbox flush failed", e);
    }
  }, 5000);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

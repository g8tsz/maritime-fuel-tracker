# Edge gateway (metering integration template)

This service is the **per-site edge** described in the platform plan: it isolates industrial networks from the public cloud, tolerates outages, and forwards custody-grade snapshots.

## Responsibilities

- **Ingest** high-rate field data (today: a deterministic simulator; tomorrow: Modbus TCP / OPC-UA mapped to `integrationJson` on `MeterProfile`).
- **Aggregate** to bounded cloud write rates (default **1000 ms** windows; tune down to 100–250 ms if your WAN and cloud API limits allow).
- **Durable outbox**: append-only `OUTBOX_LOG_PATH` plus `outboxCursorPath` byte checkpoint — acknowledged lines are never rewritten, reducing data loss on crash compared to rewriting a single queue file.
- **Authenticate** with `Authorization: Bearer <EDGE_API_KEY>` against `POST /api/edge/v1/readings`.
- **Idempotency**: each POST should include a fresh `Idempotency-Key` header (UUID). Retries reuse the same key so the cloud does not double-apply readings.

## Environment

Copy `env.example` to `.env` and fill values from your seeded cloud database (`npm run db:seed` prints an API key).

| Variable | Purpose |
| --- | --- |
| `CLOUD_BASE_URL` | Base URL of the web app, e.g. `http://localhost:3000` |
| `EDGE_API_KEY` | Bearer token hashed into `EdgeDevice.apiKeyHash` |
| `SITE_ID` | Prisma `Site.id` |
| `BERTH_LINE_ID` | Prisma `BerthLine.id` |
| `DELIVERY_ID` | Active `Delivery.id` in `IN_PROGRESS` |
| `AGGREGATE_MS` | Snapshot interval (ms) |
| `OUTBOX_LOG_PATH` | Append-only JSONL log |
| `OUTBOX_CURSOR_PATH` | Optional; defaults to `OUTBOX_LOG_PATH` + `.cursor` |

## Payload contract (cloud)

Prefer **`cumulativeMassKg`** / **`cumulativeVolumeM3`** (totalizer readings). The cloud arms `meterStart*` on the first cumulative sample after `IN_PROGRESS`, then stores **net** `rawMassKg` / `rawVolumeM3` as `current − start`.

Legacy **`massKg`** / **`volumeM3`** without cumulative fields are treated as **net snapshots** (e.g. handheld gauge).

## Production hardening (next steps)

- Run as a Windows service or Linux systemd unit with restart policy.
- Add **NTP** discipline and stamp `observedAt` from GPS-disciplined clock where available.
- Replace the simulator with a **vendor-specific driver** (Coriolis mass totals preferred for custody).
- Switch transport to **mTLS** + device identity beyond a single API key.

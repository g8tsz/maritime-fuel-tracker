# Maritime Bunker Platform (MBP)

Custody-aware **ship fuel station** software for large commercial vessels: nominations, high-flow metering integration (via edge gateway), commercial rounding, BDN PDF generation, invoicing, and reconciliation workflows.

The **primary application stack is Python** (FastAPI + SQLAlchemy). The original Next.js + Prisma monorepo is preserved under [`_legacy/`](_legacy/) for reference and gradual parity work.

## Python quick start

Requirements: **Python 3.11+**.

```bash
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate

pip install -e ".[dev]"
cp .env.example .env
# Edit .env if needed (DATABASE_URL, SESSION_SECRET).

python scripts/seed.py
uvicorn maritime_fuel_tracker.main:app --reload --port 8000
```

- Health: `GET http://localhost:8000/health`
- Edge ingest: `POST http://localhost:8000/api/edge/v2/readings` (Bearer API key from seed output)

Alternatively, after install: `mft-serve` (same as `uvicorn maritime_fuel_tracker.main:app`).

### Tests

```bash
python -m pytest
```

### Project layout

- [`src/maritime_fuel_tracker/`](src/maritime_fuel_tracker/) — FastAPI app, models, edge ingest, anomaly scoring.
- [`scripts/seed.py`](scripts/seed.py) — demo org, site, berth, users, edge device, in-progress delivery.
- [`tests/`](tests/) — automated checks.
- [`data/`](data/) — default SQLite file path (`./data/dev.db` per `.env.example`).

### Edge API smoke test

1. Run `python scripts/seed.py` and note the printed **edge API key**, **delivery id**, **site id**, and **berth line id**.
2. Send a JSON body aligned with the edge schema (cumulative totalizer or net snapshots; see `schemas/edge.py` and `services/edge_ingest.py`).
3. Use header `Authorization: Bearer <api_key>`. Optionally send `Idempotency-Key` and `X-Correlation-Id` for tracing and deduplication.

### Postgres (optional)

For production or multi-instance deployments, point `DATABASE_URL` at Postgres (for example `postgresql+psycopg://user:pass@host:5432/mbp`). You can start a local database with:

```bash
docker compose up -d
```

Then set `DATABASE_URL` to match [`docker-compose.yml`](docker-compose.yml) credentials, recreate schema (for example by running `scripts/seed.py` against the new URL after adjusting models/migrations strategy for your environment).

## Legacy Node stack

The previous **Next.js operator UI**, Prisma schema, and **Node edge-gateway** template live in [`_legacy/`](_legacy/). See [`_legacy/README.md`](_legacy/README.md) for how to run that stack if you need the full UI and APIs that are not yet ported to Python.

## Product parity (Python)

The Python service currently exposes **health checks** and **edge ingestion** (`/api/edge/v1/readings`, `/api/edge/v2/readings`). Operator login, session cookies, BDN PDF download, invoices, admin pages, and background job drain are **not** reimplemented here yet; use `_legacy/` or extend this package as needed.

## Multi-site RBAC model (domain)

- **Single-tenant, multi-site** via `Organization` → many `Site`.
- `Membership` binds `User` + optional `Site` + `Role`.
- `ORG_ADMIN`, `OPERATOR`, `FINANCE`, and related roles are represented in the data model; enforcement in the Python API will follow as routes are added.

## Custody and billing rules (legacy implementation)

The `_legacy` web app implemented raw vs commercial rounding, BDN PDFs, invoices, estimates, and reconciliation. Porting those behaviors should reuse the same business rules against the SQLAlchemy models in this tree.

## Security notes

- Set a strong `SESSION_SECRET` before any network exposure.
- Edge ingest uses per-device API keys and in-memory rate limiting; for multiple app instances, move limits and idempotency to a shared store (Redis) and use Postgres.
- **mTLS / device identity / WAF** are still recommended for hostile pier networks; API keys alone are not sufficient on the open internet.

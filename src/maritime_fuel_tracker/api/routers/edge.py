from __future__ import annotations

import uuid
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, Header, Request
from sqlalchemy.orm import Session

from maritime_fuel_tracker.db.session import get_session
from maritime_fuel_tracker.errors import AppError, resolve_error
from maritime_fuel_tracker.rate_limit import edge_limiter
from maritime_fuel_tracker.services.edge_auth import authenticate_edge_device
from maritime_fuel_tracker.services.edge_ingest import ingest_edge_reading

router = APIRouter(tags=["edge"])

CORRELATION_HEADER = "x-correlation-id"
EDGE_WINDOW_SEC = 60.0
EDGE_MAX = 600


def _client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


async def _edge_post(
    request: Request,
    session: Session,
    api_version: Literal["v1", "v2"],
    authorization: str | None,
    idempotency_key: str | None,
    correlation_id: str | None,
) -> dict[str, Any]:
    cid = correlation_id or str(uuid.uuid4())
    api_key = None
    if authorization and authorization.lower().startswith("bearer "):
        api_key = authorization[7:].strip()

    device = authenticate_edge_device(session, api_key)
    if not device:
        code = "MBP.edge.auth.invalid_key"
        st, msg = resolve_error(code)
        raise AppError(code, msg, st)

    ip = _client_ip(request)
    if not edge_limiter.allow(f"edge:{device.id}:{ip}", EDGE_MAX, EDGE_WINDOW_SEC):
        code = "MBP.edge.rate_limited"
        st, msg = resolve_error(code)
        raise AppError(code, msg, st)

    try:
        body = await request.json()
    except Exception:
        body = {}
    if not isinstance(body, dict):
        body = {}

    try:
        result = ingest_edge_reading(
            session,
            body_raw=body,
            device=device,
            api_version=api_version,
            idempotency_key=idempotency_key,
        )
        session.commit()
    except AppError:
        session.rollback()
        raise
    except Exception as e:
        session.rollback()
        code = "MBP.common.internal"
        st, msg = resolve_error(code)
        raise AppError(code, str(e), st) from e

    return {"ok": True, "correlationId": cid, **result}


@router.post("/v1/readings")
async def edge_v1(
    request: Request,
    session: Annotated[Session, Depends(get_session)],
    authorization: Annotated[str | None, Header()] = None,
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
    x_idempotency_key: Annotated[str | None, Header(alias="x-idempotency-key")] = None,
    correlation_id: Annotated[str | None, Header(alias=CORRELATION_HEADER)] = None,
) -> dict[str, Any]:
    idem = idempotency_key or x_idempotency_key
    return await _edge_post(request, session, "v1", authorization, idem, correlation_id)


@router.post("/v2/readings")
async def edge_v2(
    request: Request,
    session: Annotated[Session, Depends(get_session)],
    authorization: Annotated[str | None, Header()] = None,
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
    x_idempotency_key: Annotated[str | None, Header(alias="x-idempotency-key")] = None,
    correlation_id: Annotated[str | None, Header(alias=CORRELATION_HEADER)] = None,
) -> dict[str, Any]:
    idem = idempotency_key or x_idempotency_key
    return await _edge_post(request, session, "v2", authorization, idem, correlation_id)

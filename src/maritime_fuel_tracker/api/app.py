from contextlib import asynccontextmanager
import uuid

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from maritime_fuel_tracker.api.routers import edge, health
from maritime_fuel_tracker.db.session import init_engine
from maritime_fuel_tracker.errors import AppError
from maritime_fuel_tracker.api.routers.edge import CORRELATION_HEADER


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_engine()
    yield


def create_app() -> FastAPI:
    app = FastAPI(title="Maritime Fuel Tracker", version="0.2.0", lifespan=lifespan)

    @app.exception_handler(AppError)
    async def _app_error(_request: Request, exc: AppError) -> JSONResponse:
        cid = _request.headers.get(CORRELATION_HEADER) or str(uuid.uuid4())
        body: dict = {
            "ok": False,
            "code": exc.code,
            "message": exc.message,
            "correlationId": cid,
        }
        if exc.details is not None:
            body["details"] = exc.details
        return JSONResponse(status_code=exc.http_status, content=body)

    app.include_router(health.router)
    app.include_router(edge.router, prefix="/api/edge")
    return app

from collections.abc import Generator
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from maritime_fuel_tracker.config import get_settings
from maritime_fuel_tracker.db.base import Base

_engine = None
SessionLocal: sessionmaker[Session] | None = None


def init_engine() -> None:
    global _engine, SessionLocal
    if _engine is not None:
        return
    settings = get_settings()
    url = settings.database_url
    connect_args = {}
    if url.startswith("sqlite"):
        connect_args["check_same_thread"] = False
        raw = url.removeprefix("sqlite:///").split("?")[0]
        Path(raw).expanduser().resolve().parent.mkdir(parents=True, exist_ok=True)
    _engine = create_engine(url, echo=False, connect_args=connect_args)
    SessionLocal = sessionmaker(bind=_engine, autoflush=False, autocommit=False, expire_on_commit=False)
    Base.metadata.create_all(bind=_engine)


def get_engine():
    """Return the SQLAlchemy engine after ``init_engine()``."""
    if _engine is None:
        raise RuntimeError("Database not initialized; call init_engine() first.")
    return _engine


def get_session() -> Generator[Session, None, None]:
    if SessionLocal is None:
        raise RuntimeError("Database not initialized; call init_engine() first.")
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()

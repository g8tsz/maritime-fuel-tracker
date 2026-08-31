import hashlib
import hmac
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from maritime_fuel_tracker.db.models import EdgeDevice


def hash_api_key(key: str) -> str:
    return hashlib.sha256(key.encode("utf-8")).hexdigest()


def authenticate_edge_device(session: Session, api_key: str | None) -> Optional[EdgeDevice]:
    if not api_key:
        return None
    digest = hash_api_key(api_key)
    devices = session.scalars(select(EdgeDevice)).all()
    for d in devices:
        try:
            a = bytes.fromhex(digest)
            b = bytes.fromhex(d.api_key_hash)
        except ValueError:
            continue
        if len(a) == len(b) and hmac.compare_digest(a, b):
            d.last_seen_at = datetime.now(timezone.utc)
            session.flush()
            return d
    return None

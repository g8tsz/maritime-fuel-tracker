from dataclasses import dataclass
from typing import Any, Optional


@dataclass
class AppError(Exception):
    code: str
    message: str
    http_status: int = 400
    details: Optional[Any] = None


ERROR_CATALOG: dict[str, tuple[int, str]] = {
    "MBP.common.validation": (400, "Request validation failed."),
    "MBP.common.internal": (500, "Something went wrong. Please try again."),
    "MBP.edge.auth.invalid_key": (401, "Invalid or missing edge device credentials."),
    "MBP.edge.rate_limited": (429, "Too many requests from this device or network."),
    "MBP.edge.site_mismatch": (403, "Device is not authorized for this site."),
    "MBP.edge.delivery.not_found": (404, "Delivery not found for this berth."),
    "MBP.edge.delivery.not_in_progress": (409, "Delivery is not accepting live meter data."),
    "MBP.edge.ingest.no_measurements": (400, "No mass or volume measurements were provided."),
}


def resolve_error(code: str) -> tuple[int, str]:
    return ERROR_CATALOG.get(code, (500, ERROR_CATALOG["MBP.common.internal"][1]))


def app_error(code: str, *, message: str | None = None, details: Any | None = None) -> AppError:
    status, msg = resolve_error(code)
    return AppError(code, message or msg, status, details)


class MBP:
    common_validation = "MBP.common.validation"
    common_internal = "MBP.common.internal"
    edge_auth_invalid_key = "MBP.edge.auth.invalid_key"
    edge_rate_limited = "MBP.edge.rate_limited"
    edge_site_mismatch = "MBP.edge.site_mismatch"
    edge_delivery_not_found = "MBP.edge.delivery.not_found"
    edge_delivery_not_in_progress = "MBP.edge.delivery.not_in_progress"
    edge_ingest_no_measurements = "MBP.edge.ingest.no_measurements"

"""ASGI entrypoint: `uvicorn maritime_fuel_tracker.main:app` or `mft-serve`."""

from maritime_fuel_tracker.api.app import create_app

app = create_app()


def run() -> None:
    import uvicorn

    uvicorn.run("maritime_fuel_tracker.main:app", host="0.0.0.0", port=8000, reload=True)

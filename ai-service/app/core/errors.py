from __future__ import annotations

import logging
from typing import Any

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)


class ServiceError(Exception):
    def __init__(self, message: str, status_code: int = 500, details: Any | None = None):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.details = details


async def service_error_handler(_request: Request, exc: ServiceError) -> JSONResponse:
    payload: dict[str, Any] = {"error": exc.message}
    if exc.details is not None:
        payload["details"] = exc.details
    return JSONResponse(status_code=exc.status_code, content=payload)


async def unhandled_error_handler(_request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled exception", exc_info=exc)
    return JSONResponse(status_code=500, content={"error": "Internal Server Error"})


def add_exception_handlers(app: FastAPI) -> None:
    app.add_exception_handler(ServiceError, service_error_handler)
    app.add_exception_handler(Exception, unhandled_error_handler)

"""Domain exception hierarchy.

Per ``.claude/rules/code-hygiene.md``: services raise typed
``ToposError`` subclasses; the global handler in ``main.py`` maps them
to HTTP status codes. Routers stay thin; they catch nothing.
"""


class ToposError(Exception):
    """Base for domain errors. Each subclass pins its HTTP status."""

    status_code: int = 500

    def __init__(self, detail: str):
        self.detail = detail
        super().__init__(detail)


class NotFoundError(ToposError):
    """Resource lookup miss (-> HTTP 404)."""

    status_code = 404


class ValidationError(ToposError):
    """Domain validation failed (-> HTTP 400)."""

    status_code = 400


class ConflictError(ToposError):
    """Resource already exists or state conflict (-> HTTP 409)."""

    status_code = 409


class PayloadTooLargeError(ToposError):
    """Upload exceeds size cap (-> HTTP 413)."""

    status_code = 413


class ExternalServiceError(ToposError):
    """External dependency unreachable or returned an error (-> HTTP 502)."""

    status_code = 502

    def __init__(self, service: str, detail: str):
        self.service = service
        super().__init__(f"{service}: {detail}")

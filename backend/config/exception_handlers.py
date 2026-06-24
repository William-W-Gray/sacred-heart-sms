import logging

from django.db import IntegrityError
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exception_handler

logger = logging.getLogger(__name__)


def api_exception_handler(exc, context):
    """Ensures every API error reaches the frontend as parseable JSON with an
    actionable message, instead of Django's opaque HTML 500 page for anything
    DRF doesn't already know how to handle (e.g. an IntegrityError from a
    race on a unique constraint, or a bug like a renamed model field that's
    still referenced somewhere) — see getApiErrorMessage on the frontend,
    which surfaces `detail` directly to the user.
    """
    response = drf_exception_handler(exc, context)
    if response is not None:
        return response

    view = context.get("view")
    logger.exception("Unhandled exception in %s", view.__class__.__name__ if view else "API view")

    if isinstance(exc, IntegrityError):
        return Response(
            {"detail": "This conflicts with an existing record (e.g. a duplicate email or ID). "
                       "Please check the values and try again."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    return Response(
        {"detail": "Something went wrong while processing this request. "
                   "Please try again, and contact an administrator if the problem continues."},
        status=status.HTTP_500_INTERNAL_SERVER_ERROR,
    )

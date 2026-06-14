import logging
import time

from django.db import connection
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

logger = logging.getLogger(__name__)


@api_view(["GET"])
@permission_classes([AllowAny])
def health_check(request):
    """Ping the database (Neon) and report connectivity + latency."""
    db_status = "ok"
    db_latency_ms = None
    try:
        start = time.monotonic()
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
        db_latency_ms = round((time.monotonic() - start) * 1000, 2)
    except Exception:
        db_status = "error"
        logger.exception("Health check: database connection failed")

    overall = "ok" if db_status == "ok" else "error"
    return Response(
        {"status": overall, "database": {"status": db_status, "latency_ms": db_latency_ms}},
        status=200 if overall == "ok" else 503,
    )

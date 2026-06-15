FROM python:3.12-slim-bookworm

WORKDIR /app

# System deps: libpq for psycopg2, curl for the Docker healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev gcc curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# STATIC_ROOT lives outside /app: in docker-compose, ./backend is bind-mounted
# over /app (owned by the host user), so collectstatic (run as appuser below)
# couldn't write to /app/staticfiles.
ENV STATIC_ROOT=/staticfiles

# Non-root user for security
RUN useradd -m -u 1001 appuser && chown -R appuser:appuser /app \
    && mkdir -p /staticfiles && chown appuser:appuser /staticfiles
USER appuser

EXPOSE 8000

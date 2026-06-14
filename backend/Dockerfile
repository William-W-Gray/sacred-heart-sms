FROM python:3.12-slim-bookworm

WORKDIR /app

# System deps: libpq for psycopg2, wkhtmltopdf for PDF generation
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev gcc wkhtmltopdf curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Non-root user for security
RUN useradd -m -u 1001 appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

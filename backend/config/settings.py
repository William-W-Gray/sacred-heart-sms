import os
import dj_database_url
from pathlib import Path
from datetime import timedelta

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.environ["DJANGO_SECRET_KEY"]
DEBUG      = os.environ.get("DEBUG", "False") == "True"
ALLOWED_HOSTS = os.environ.get("ALLOWED_HOSTS", "localhost,127.0.0.1").split(",")

AUTH_USER_MODEL = "users.User"

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # Third-party
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
    "django_filters",
    # Internal apps
    "apps.users",
    "apps.students",
    "apps.teachers",
    "apps.attendance",
    "apps.marks",
    "apps.conduct",
    "apps.finance",
    "apps.reports",
    "apps.notifications",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ]
        },
    }
]

# ── Database ────────────────────────────────────────────────────
# If DATABASE_URL is set (Neon or any other Postgres connection string),
# use it. Otherwise fall back to discrete DB_* vars (local docker-compose
# Postgres).
DATABASE_URL = os.environ.get("DATABASE_URL")

if DATABASE_URL:
    DATABASES = {
        "default": dj_database_url.config(
            default=DATABASE_URL,
            conn_max_age=int(os.environ.get("DB_CONN_MAX_AGE", 300)),
            conn_health_checks=True,
            ssl_require=True,
        )
    }
    # Neon's pooled connection runs PgBouncer in transaction mode, which
    # doesn't support server-side cursors held across statements.
    DATABASES["default"]["DISABLE_SERVER_SIDE_CURSORS"] = True
else:
    DATABASES = {
        "default": {
            "ENGINE":   "django.db.backends.postgresql",
            "NAME":     os.environ.get("DB_NAME", "sacred_heart_sms"),
            "USER":     os.environ.get("DB_USER", "sms_user"),
            "PASSWORD": os.environ["DB_PASSWORD"],
            "HOST":     os.environ.get("DB_HOST", "db"),
            "PORT":     os.environ.get("DB_PORT", "5432"),
            "CONN_MAX_AGE": 60,
        }
    }

# ── REST Framework ──────────────────────────────────────────────
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 25,
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
}

# ── JWT ─────────────────────────────────────────────────────────
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME":  timedelta(hours=8),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=30),
    "ROTATE_REFRESH_TOKENS":  True,
    "BLACKLIST_AFTER_ROTATION": True,
    "AUTH_HEADER_TYPES": ("Bearer",),
    "TOKEN_OBTAIN_SERIALIZER": "apps.users.views.SMSTokenSerializer",
}

# ── CORS ────────────────────────────────────────────────────────
CORS_ALLOWED_ORIGINS = os.environ.get(
    "CORS_ALLOWED_ORIGINS", "http://localhost:3000"
).split(",")
# Comma-separated regexes, e.g. for Vercel preview deployments:
# ^https://sacred-heart-sms-.*\.vercel\.app$
CORS_ALLOWED_ORIGIN_REGEXES = [
    r for r in os.environ.get("CORS_ALLOWED_ORIGIN_REGEXES", "").split(",") if r
]
CORS_ALLOW_CREDENTIALS = True

# ── Security (production / reverse proxy) ────────────────────────
# Render (and most PaaS) terminate TLS at the edge and proxy plain HTTP
# with X-Forwarded-Proto — without this, request.is_secure() is always
# False behind the proxy, breaking CSRF/secure-cookie checks.
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

CSRF_TRUSTED_ORIGINS = [
    o for o in os.environ.get("CSRF_TRUSTED_ORIGINS", "").split(",") if o
]

SESSION_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_SECURE = not DEBUG

# Render's edge already redirects HTTP -> HTTPS, so SECURE_SSL_REDIRECT is
# left off here — enabling it in Django would also redirect Render's direct
# (non-proxied) health-check probe and any local docker-compose traffic
# (DEBUG=False locally too), breaking /api/health/ and all frontend API calls.
# HSTS is just a response header (only sent when request.is_secure() is True
# via SECURE_PROXY_SSL_HEADER above), so it's safe to enable unconditionally.
SECURE_HSTS_SECONDS = 31536000 if not DEBUG else 0
SECURE_HSTS_INCLUDE_SUBDOMAINS = not DEBUG
SECURE_HSTS_PRELOAD = not DEBUG

# ── Celery ──────────────────────────────────────────────────────
CELERY_BROKER_URL    = os.environ.get("REDIS_URL", "redis://redis:6379/0")
CELERY_RESULT_BACKEND = CELERY_BROKER_URL
CELERY_TASK_SERIALIZER = "json"

# ── Email ───────────────────────────────────────────────────────
EMAIL_BACKEND       = "django.core.mail.backends.smtp.EmailBackend"
EMAIL_HOST          = os.environ.get("EMAIL_HOST", "smtp.gmail.com")
EMAIL_PORT          = int(os.environ.get("EMAIL_PORT", 587))
EMAIL_USE_TLS       = True
EMAIL_HOST_USER     = os.environ.get("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = os.environ.get("EMAIL_HOST_PASSWORD", "")
DEFAULT_FROM_EMAIL  = "Sacred Heart SMS <noreply@sacredheart.edu.lr>"

# ── Static / Media ──────────────────────────────────────────────
STATIC_URL  = "/static/"
STATIC_ROOT = Path(os.environ.get("STATIC_ROOT", BASE_DIR / "staticfiles"))
MEDIA_URL   = "/media/"
MEDIA_ROOT  = BASE_DIR / "media"

STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
    },
}

# Media storage (Cloudflare R2 / any S3-compatible bucket). If
# AWS_STORAGE_BUCKET_NAME is unset, uploads stay on local disk
# (MEDIA_ROOT above) — fine for local dev, but ephemeral on Render.
AWS_STORAGE_BUCKET_NAME = os.environ.get("AWS_STORAGE_BUCKET_NAME")
if AWS_STORAGE_BUCKET_NAME:
    STORAGES["default"] = {"BACKEND": "storages.backends.s3.S3Storage"}
    AWS_ACCESS_KEY_ID     = os.environ["AWS_ACCESS_KEY_ID"]
    AWS_SECRET_ACCESS_KEY = os.environ["AWS_SECRET_ACCESS_KEY"]
    AWS_S3_ENDPOINT_URL   = os.environ["AWS_S3_ENDPOINT_URL"]
    AWS_S3_REGION_NAME    = os.environ.get("AWS_S3_REGION_NAME", "auto")
    AWS_S3_CUSTOM_DOMAIN  = os.environ.get("AWS_S3_CUSTOM_DOMAIN") or None
    AWS_DEFAULT_ACL       = None
    AWS_QUERYSTRING_AUTH  = False
    AWS_S3_FILE_OVERWRITE = False

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
LANGUAGE_CODE = "en-us"
TIME_ZONE     = "Africa/Monrovia"
USE_I18N = True
USE_TZ   = True

# ── Logging ─────────────────────────────────────────────────────
# Always logs to stdout (captured by `docker logs`), independent of DEBUG —
# Django's default config silences the console handler when DEBUG=False, which
# would otherwise hide DB connection errors (e.g. Neon cold-start timeouts).
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {
            "format": "{asctime} {levelname} {name} {message}",
            "style": "{",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "verbose",
        },
    },
    "root": {
        "handlers": ["console"],
        "level": "INFO",
    },
    "loggers": {
        "django": {
            "handlers": ["console"],
            "level": "INFO",
            "propagate": False,
        },
        # Set DB_LOG_LEVEL=DEBUG to log every SQL statement (incl. duration)
        # when diagnosing Neon latency/connection issues.
        "django.db.backends": {
            "handlers": ["console"],
            "level": os.environ.get("DB_LOG_LEVEL", "WARNING"),
            "propagate": False,
        },
    },
}

# Django only emits per-query logs (django.db.backends, above) when DEBUG=True.
# This makes DB_LOG_LEVEL=DEBUG work in production too, without a redeploy.
if os.environ.get("DB_LOG_LEVEL", "").upper() == "DEBUG":
    from django.db.backends.signals import connection_created

    def _enable_query_logging(sender, connection, **kwargs):
        connection.force_debug_cursor = True

    connection_created.connect(_enable_query_logging)

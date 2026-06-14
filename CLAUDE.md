# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Sacred Heart SMS is a full-stack School Management System for a Catholic High School in Monrovia, Liberia.

**Stack:** Django 5 (DRF + SimpleJWT) · PostgreSQL · Redis/Celery · Next.js 15 (App Router, TypeScript) · TanStack Query · Zustand · Tailwind CSS · Docker

Repo layout: `backend/` (Django project) and `frontend/` (Next.js app), tied together by `docker-compose.yml`.

## Commands

### Docker (whole stack)
```bash
cp .env.example .env   # set DJANGO_SECRET_KEY, DATABASE_URL (Neon)
docker compose up --build
# frontend → http://localhost:3000, backend → http://localhost:8000
```
The `backend` container runs `migrate`, `seed_data`, then `gunicorn` on every start. A `celery` worker container runs `apps.notifications` tasks. There is no `db` service — Postgres is Neon, reached via `DATABASE_URL`.

### Backend (local)
```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
export DJANGO_SECRET_KEY=dev DATABASE_URL=postgresql://...neon.tech/neondb?sslmode=require DEBUG=True
python manage.py migrate
python manage.py seed_data        # idempotent demo data (academic year, subjects, grading scale, users)
python manage.py runserver        # http://localhost:8000
```
`SECRET_KEY` is read directly from `os.environ[...]` in `config/settings.py` — required or Django fails at import time.

There is no automated test suite (`backend/apps/*/tests.py` don't exist) and no linter config (no flake8/pyproject). Don't assume `pytest`/`manage.py test` will find anything.

### Frontend (local)
```bash
cd frontend
npm install
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local
npm run dev          # http://localhost:3000
npm run build
npm run lint          # next lint
npm run type-check    # tsc --noEmit
```

### Demo credentials
| Role | Email | Password |
|---|---|---|
| Administrator | admin@sacredheart.edu.lr | admin123 |
| Teacher | s.johnson@sacredheart.edu.lr | teacher123 |

## Architecture

### Database (Neon Postgres)

`config/settings.py` builds `DATABASES["default"]` from `DATABASE_URL` via `dj_database_url` when that env var is set (Neon's **pooled** connection string — hostname contains `-pooler`, PgBouncer in transaction mode). This sets `CONN_MAX_AGE=300`, `CONN_HEALTH_CHECKS=True` (so a connection that went stale during Neon's autosuspend is transparently reconnected), `sslmode=require`, and `DISABLE_SERVER_SIDE_CURSORS=True` (required for PgBouncer transaction pooling — don't use `.iterator()` on large querysets against this connection). If `DATABASE_URL` is unset, it falls back to discrete `DB_NAME`/`DB_USER`/`DB_PASSWORD`/`DB_HOST`/`DB_PORT` vars for a local Postgres. `DATABASE_URL_UNPOOLED` (direct, non-PgBouncer connection) is documented in `.env.example` for `dbshell`/long-running scripts but isn't wired into `settings.py`.

#### Monitoring & logging
- `GET /api/health/` (`config/views.py::health_check`, no auth required) runs `SELECT 1` and returns `{"status": "ok", "database": {"status": "ok", "latency_ms": ...}}` (503 if the query fails) — point uptime monitoring here to track Neon reachability/latency. Each gunicorn worker pays a one-time ~0.5–3s cold-start hit on its first query after Neon's compute autosuspends or the worker (re)connects; steady-state latency is the real signal.
- `docker-compose.yml`'s `backend` service has a `healthcheck` that curls `/api/health/` every 30s (`docker ps` shows `(healthy)`/`(unhealthy)`) — uses `127.0.0.1` not `localhost`, since the container's `/etc/hosts` resolves `localhost` to `::1` first and gunicorn only binds `0.0.0.0` (IPv4), so `localhost` fails instantly. Once the app has a public URL, add an external uptime monitor (e.g. UptimeRobot) pointed at `https://<domain>/api/health/`.
- `LOGGING` in `config/settings.py` always logs to stdout (`docker logs`) regardless of `DEBUG` — Django's default config silences the console handler when `DEBUG=False`, which would otherwise hide `django.request` tracebacks (incl. DB `OperationalError`/`InterfaceError` from dropped Neon connections). Set `DB_LOG_LEVEL=DEBUG` to additionally log every SQL statement with timing (via a `connection_created` signal that sets `force_debug_cursor`, since Django normally only does this when `DEBUG=True`) — useful for diagnosing slow queries against Neon, but noisy, so leave unset normally.

### Backend — Django apps (`backend/apps/`)

All API routes are registered on a single `DefaultRouter` in `config/urls.py` and mounted under `/api/`. Auth endpoints (`/api/auth/login|refresh|logout/`) use SimpleJWT directly.

- **`users`** — custom `User` model (`AUTH_USER_MODEL`), role-based (`admin`/`teacher`/`student`/`guardian`), `Notification` model + viewset. `SMSTokenSerializer` (in `users/views.py`, wired via `SIMPLE_JWT["TOKEN_OBTAIN_SERIALIZER"]`) embeds `email`/`role` into the JWT payload — the frontend decodes this to get the role without an extra API call. `IsAdminUser` permission class also lives here and is imported by other apps.
- **`students`** — the core academic structure: `AcademicYear`, `Semester`, `Subject`, `Class`, `Guardian`, `Student`, `StudentGuardian` (M2M through table with `relationship`/`is_primary`). `Student.student_id` is a manually-entered custom ID (e.g. `CHS-2026-001`), never auto-generated.
- **`teachers`** — `Teacher` (1:1 with `User`) and `TeacherAssignment` (teacher × class × subject × academic_year). `Teacher.can_record_for(class, subject)` is the canonical check for "is this teacher allowed to touch this class/subject".
- **`attendance`** — `AttendanceRecord` (per student/subject/date) and `AttendanceSummary` (precomputed per-semester aggregates, refreshed by a management command/Celery, not on every write).
- **`marks`** — the busiest app. Holds `Mark` (test/exam scores, `semester_average` is a computed property), `GradingScale` (DB-driven grade-letter lookup via `GradingScale.letter_for()` — **never hardcode grade boundaries**), `ConductCategory`/`ConductRating` (14 rating categories, 1–6 scale), and `PromotionDecision`. **`marks/services.py`** is framework-agnostic (no request/response objects) and is the single source of truth for grade math: `compute_student_year_average`, `compute_class_ranking`, `build_report_card_data`.
- **`finance`** — `Invoice` (auto-numbered via `Invoice.generate_number()` → `INV-{year}-{seq}`), `Payment` (saving a payment calls `invoice.refresh_status()` to recompute paid/partial/overdue), `Receipt`.
- **`notifications`** — Celery tasks only (`dispatch_email`). `Notification.send(...)` (in `users/models.py`) is the entry point; passing `channel=EMAIL` enqueues `dispatch_email.delay()`. WhatsApp channel exists in the model but has no dispatch task yet.
- **`conduct`** and **`reports`** — listed in `INSTALLED_APPS` but contain **no models/views**, just empty scaffolding (`__init__.py` + empty management dirs). Conduct logic actually lives in `apps.marks` (`ConductCategory`/`ConductRating`); report-card assembly lives in `apps.marks.services.build_report_card_data`, exposed via `StudentViewSet.report_card` (`GET /api/students/{id}/report_card/`). Don't go looking for conduct/report code in these two apps.

#### RBAC pattern
Every viewset sets `permission_classes = [IsAuthenticated]`; row-level scoping is done via `get_queryset()` checking `request.user.role`. The reference implementation is `StudentViewSet.get_queryset()` (`students/views.py`): students see only their own record, guardians see linked students (`guardians__user=user`), teachers see students in classes they're assigned to (via `teacher.assignments.filter(is_active=True)`), admins see everything. `GuardianViewSet` follows the same pattern. **Most other viewsets (marks, attendance, finance, teachers, etc.) do not yet apply role-based queryset filtering** — if you're adding RBAC to a new endpoint, follow the `StudentViewSet` pattern.

#### "Bulk" endpoints
`POST /api/marks/bulk/`, `POST /api/attendance/bulk/`, and `POST /api/conduct-ratings/bulk/` are `@action(detail=False, methods=["post"], url_path="bulk")` handlers on `MarkViewSet`, `AttendanceRecordViewSet`, and `ConductRatingViewSet`. Each accepts `{"records": [...]}` and upserts every record inside one `transaction.atomic()` block, keyed on the model's natural unique constraint (`student`+`subject`+`semester` for marks, `student`+`subject`+`date` for attendance, `student`+`category`+`semester` for conduct ratings), stamping `recorded_by`/`rated_by` from `request.user.teacher_profile` when present. `MarkViewSet.bulk` skips (never overwrites) any existing `Mark` with `is_locked=True`.

Note: `backend/scripts/seed_data.py` is a stale copy of `backend/apps/students/management/commands/seed_data.py` (the actual `manage.py seed_data` command) that predates a fix to teacher `employee_id` seeding and has since diverged. Edit the management command version — the `scripts/` copy isn't wired to anything.

### Frontend (`frontend/src/`)

- **App Router route groups**: `(auth)/login` is the public login page; `(dashboard)/*` are protected pages sharing `(dashboard)/layout.tsx` (sidebar nav + topbar). The layout redirects to `/login` client-side if `useAuthStore().isAuthenticated` is false — there's no middleware-based route protection.
- **API layer**: `lib/api/client.ts` is an Axios instance that attaches the JWT from cookies (`sms_access`) and, on a 401, transparently refreshes via `/api/auth/refresh/` (queuing concurrent requests while refreshing) before retrying. `lib/api/services.ts` wraps every backend endpoint in a typed function grouped by resource (`studentsApi`, `marksApi`, `financeApi`, …) — **always go through this layer**, don't call `api.get/post` directly from components.
- **Data fetching**: `hooks/useApi.ts` wraps `services.ts` in TanStack Query hooks. `QK` is the central query-key factory — mutations invalidate via these same keys, so new mutations must invalidate the matching `QK.*` entry or the UI goes stale.
- **Auth state**: `store/auth.store.ts` is a Zustand store (persisted to localStorage as `sms-auth`, partialized to `user`/`role`/`isAuthenticated`). `login()` calls `authApi.login` then `authApi.me` to populate the user; the JWT's decoded `role` claim is stored separately from the `/users/me/` profile.
- **Types**: `types/index.ts` is intended to mirror every Django model 1:1. When you add/rename a model field on the backend, update the corresponding interface here — nothing generates this automatically.
- Forms use `react-hook-form` + `zod` (see `components/forms/StudentModal.tsx`, `TeacherModal.tsx` for the pattern: modal + RHF + zod schema + the matching `useCreate*`/`useUpdate*` mutation hook).
- Path alias `@/*` → `frontend/src/*` (configured in `tsconfig.json`).

## Key Design Decisions

- **Grading scale is DB-driven** — edit via `/api/grading-scales/` (Settings → Grading Scale in the UI), never hardcode letter/score boundaries.
- **Student IDs are manual** — admin enters them (e.g. `CHS-2026-001`); there's no auto-generation, unlike invoice numbers which *are* auto-generated.
- **JWT with silent refresh** — access tokens auto-refresh via the Axios interceptor in `lib/api/client.ts`; no user-facing re-login on expiry.
- **Report cards pull live data** — marks, conduct, attendance, ranking, and promotion decisions are all computed on-demand from `apps.marks.services.build_report_card_data`, not cached/precomputed (except `AttendanceSummary`, which is precomputed).
- **TanStack Query throughout** — server state is cached and invalidated on mutation; avoid component-local copies of server data.
- Designed with a target scale of 5,000–10,000 students without architectural changes.

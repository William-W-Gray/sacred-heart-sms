# Deployment Guide — Sacred Heart SMS

Target architecture:

| Layer    | Provider                      | Notes |
|----------|--------------------------------|-------|
| Database | **Neon** (Postgres)             | Already provisioned — `DATABASE_URL` in `.env` |
| Backend  | **Render** (Docker web service + worker) | Django/DRF + Celery |
| Cache/Broker | **Upstash** (Redis)        | Free tier, TLS (`rediss://`) |
| Media storage | **Cloudflare R2**         | Student/teacher photos, receipts |
| Frontend | **Vercel**                     | Next.js 15 |

This is a two-pass deploy: the backend needs to exist before the
frontend can point at it, and CORS/CSRF on the backend need the
frontend's final URL. Steps are ordered to minimize back-and-forth, but
**Step 6 (round-trip)** is unavoidable.

---

## 1. Cloudflare R2 (media storage)

1. Cloudflare dashboard → **R2 Object Storage** → **Create bucket**.
   - Name: `sacred-heart-sms-media` (or your choice).
   - Location: Automatic.
2. Bucket → **Settings** → **Public access** → enable the `r2.dev`
   public bucket URL (or attach a custom domain). Copy this URL — it's
   `AWS_S3_CUSTOM_DOMAIN` (just the hostname, no `https://`, e.g.
   `pub-xxxxxxxxxxxx.r2.dev`).
3. Cloudflare dashboard → **R2** → **Manage API tokens** → **Create API
   token** → permission "Object Read & Write", scoped to the bucket
   above. Copy the **Access Key ID** and **Secret Access Key** (shown
   once).
4. Note your Cloudflare **Account ID** (R2 → right sidebar). The S3
   endpoint is `https://<account_id>.r2.cloudflarestorage.com`.

You'll set these as Render env vars in Step 4:
```
AWS_STORAGE_BUCKET_NAME=sacred-heart-sms-media
AWS_ACCESS_KEY_ID=<access key id>
AWS_SECRET_ACCESS_KEY=<secret access key>
AWS_S3_ENDPOINT_URL=https://<account_id>.r2.cloudflarestorage.com
AWS_S3_REGION_NAME=auto
AWS_S3_CUSTOM_DOMAIN=pub-xxxxxxxxxxxx.r2.dev
```

If these are left unset, the app falls back to local disk storage
(fine for testing, but files are lost on every Render redeploy).

---

## 2. Upstash (Redis for Celery)

1. [upstash.com](https://upstash.com) → sign up/sign in → **Create
   database**.
   - Name: `sacred-heart-sms`.
   - Type: Regional (pick a region close to your Render region).
   - Enable TLS (default).
2. On the database details page, copy the **`rediss://...`** connection
   string (TLS). This is `REDIS_URL` in Step 4.

---

## 3. Render — backend + Celery worker

The repo includes `render.yaml`, which defines two services from
`backend/Dockerfile`:
- `sacred-heart-backend` (web) — runs migrations, `seed_essentials`
  (reference data only — academic year, subjects, grading scale,
  conduct categories; **no demo accounts**), then `gunicorn`. Health
  check: `/api/health/`.
- `sacred-heart-celery` (worker) — runs the Celery worker for
  notification emails.

Both are on the `starter` plan (background workers require a paid
plan; `starter` is the cheapest tier that supports them).

### Steps
1. Render dashboard → **New** → **Blueprint** → connect the
   `William-W-Gray/sacred-heart-sms` GitHub repo → Render detects
   `render.yaml` and proposes both services.
2. Before the first deploy, fill in the env vars marked `sync: false`
   for **`sacred-heart-backend`**:

   | Key | Value |
   |---|---|
   | `DJANGO_SECRET_KEY` | generate a new 50-char random string (don't reuse the dev one) |
   | `DATABASE_URL` | Neon **pooled** connection string (from `.env`) |
   | `REDIS_URL` | Upstash `rediss://...` URL from Step 2 |
   | `ALLOWED_HOSTS` | `sacred-heart-backend.onrender.com` (your actual Render hostname — shown after first deploy; you can update it after) |
   | `CORS_ALLOWED_ORIGINS` | `http://localhost:3000` for now — update in Step 6 |
   | `CORS_ALLOWED_ORIGIN_REGEXES` | `^https://sacred-heart-sms-.*\.vercel\.app$` (matches Vercel preview URLs) |
   | `CSRF_TRUSTED_ORIGINS` | `https://sacred-heart-backend.onrender.com` (your actual Render hostname) |
   | `EMAIL_HOST_USER` / `EMAIL_HOST_PASSWORD` | Gmail SMTP app password (or leave blank to disable email) |
   | `AWS_STORAGE_BUCKET_NAME`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_ENDPOINT_URL`, `AWS_S3_CUSTOM_DOMAIN` | from Step 1 |

3. For **`sacred-heart-celery`**, fill in the same `DJANGO_SECRET_KEY`,
   `DATABASE_URL`, `REDIS_URL`, `EMAIL_HOST_USER`,
   `EMAIL_HOST_PASSWORD` (Render blueprints don't auto-share `sync:
   false` values between services — copy the same values you used
   above).
4. Deploy. Watch the build logs — first boot runs
   `migrate && seed_essentials && gunicorn`.
5. Once live, note the backend URL, e.g.
   `https://sacred-heart-backend.onrender.com`. If it differs from what
   you guessed in step 2, update `ALLOWED_HOSTS` and
   `CSRF_TRUSTED_ORIGINS` to match and let it redeploy.
6. Verify: `curl https://sacred-heart-backend.onrender.com/api/health/`
   → `{"status":"ok","database":{"status":"ok",...}}`.

---

## 4. Vercel — frontend

1. Vercel dashboard → **Add New** → **Project** → import
   `William-W-Gray/sacred-heart-sms`.
2. **Root Directory**: `frontend`.
3. Framework preset: Next.js (auto-detected).
4. Environment variable:
   ```
   NEXT_PUBLIC_API_URL=https://sacred-heart-backend.onrender.com
   ```
   (the Render backend URL from Step 3).
5. Deploy. Note the resulting URL, e.g.
   `https://sacred-heart-sms.vercel.app`.

---

## 5. Round-trip: update backend CORS/CSRF with the real frontend URL

Back on Render, edit `sacred-heart-backend`'s env vars:
- `CORS_ALLOWED_ORIGINS=https://sacred-heart-sms.vercel.app`
- (Keep `CORS_ALLOWED_ORIGIN_REGEXES` as set in Step 3 — covers Vercel
  preview deployments like `https://sacred-heart-sms-<hash>.vercel.app`.)

Save → Render redeploys automatically.

---

## 6. Post-deploy: create the real admin account

`seed_essentials` (run automatically on every deploy) creates **no
user accounts** — it's safe for a real school's data. Create the
actual administrator account once, via Render Shell:

```bash
# Render dashboard → sacred-heart-backend → Shell
python manage.py createsuperuser
# enter the school's real admin email + a strong password + role=admin
```

(`role` defaults correctly to `admin` for superusers —
`UserManager.create_superuser` sets it automatically.)

---

## Troubleshooting

- **502/503 right after deploy**: Render's free/starter plans cold-start;
  the `start_period`-style grace is handled by `healthCheckPath`. Check
  the Logs tab for migration errors (most likely cause: `DATABASE_URL`
  not set or pointing at the wrong Neon branch).
- **Admin login fails with "CSRF verification failed"**: `CSRF_TRUSTED_ORIGINS`
  must include the exact `https://<backend>.onrender.com` origin.
- **CORS errors in the browser console**: confirm `CORS_ALLOWED_ORIGINS`
  has the exact Vercel URL (no trailing slash) and matches the scheme
  (`https://`).
- **Uploaded photos disappear after a redeploy**: R2 env vars
  (`AWS_STORAGE_BUCKET_NAME` etc.) aren't set or are incorrect — check
  Render logs for S3 connection errors on upload.
- **`/api/health/` reports `database.status: "error"`**: Neon project
  may be paused/unreachable, or `DATABASE_URL` is the unpooled
  connection string under load — use the **pooled** (`-pooler`)
  connection string for `DATABASE_URL`.

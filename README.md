# Sacred Heart Catholic High School — School Management System

> Full-stack School Management System for a Catholic High School in Monrovia, Liberia.  
> **Stack:** Django 5 (DRF + JWT) · PostgreSQL · Redis · Next.js 15 (App Router, TypeScript) · TanStack Query · Zustand · Tailwind CSS · Docker

---

## Quick Start (Docker — recommended)

```bash
# 1. Clone and configure
cp .env.example .env
# Edit .env — set DJANGO_SECRET_KEY, DB_PASSWORD

# 2. Start everything
docker compose up --build

# 3. Open the app
open http://localhost:3000

# Login: admin@sacredheart.edu.lr / admin123
```

---

## Local Development (without Docker)

### Backend

```bash
cd backend

python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate

pip install -r requirements.txt

# Set required env vars (or create a .env and use python-decouple)
export DJANGO_SECRET_KEY="dev-secret-key-change-in-prod"
export DB_PASSWORD="your-db-password"
export DEBUG=True

python manage.py migrate
python manage.py seed_data        # Seeds demo data
python manage.py runserver        # http://localhost:8000
```

### Frontend

```bash
cd frontend
npm install

# Create .env.local
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local

npm run dev                       # http://localhost:3000
```

> **Testing on a phone?** `localhost` in `NEXT_PUBLIC_API_URL` only works on the machine running `npm run dev` — on a phone it resolves to the phone itself, causing a network error on login. Set it to your computer's LAN IP instead (e.g. `http://192.168.x.x:8000`), and add that IP to the backend's `ALLOWED_HOSTS` and `CORS_ALLOWED_ORIGINS`.

---

## Project Structure

```
sacred-heart-sms/
├── backend/
│   ├── apps/
│   │   ├── users/          # User model, JWT auth, RBAC, notifications
│   │   ├── students/       # Student, Guardian, Class, Subject, AcademicYear, Semester
│   │   ├── teachers/       # Teacher, TeacherAssignment
│   │   ├── attendance/     # AttendanceRecord, AttendanceSummary
│   │   ├── marks/          # Mark, GradingScale (DB-driven), Conduct, Promotion
│   │   ├── finance/        # Invoice, Payment, Receipt
│   │   ├── reports/        # Report card PDF generation
│   │   └── notifications/  # Celery tasks for email / WhatsApp
│   ├── config/
│   │   ├── settings.py
│   │   └── urls.py         # All API routes
│   ├── scripts/
│   │   └── seed_data.py    # Demo data management command
│   ├── Dockerfile
│   └── requirements.txt
│
├── frontend/
│   └── src/
│       ├── app/
│       │   ├── (auth)/login/       # Login page
│       │   └── (dashboard)/        # Protected routes
│       │       ├── layout.tsx      # Sidebar + topbar
│       │       ├── dashboard/      # Live stats dashboard
│       │       ├── students/       # Full CRUD + search + pagination
│       │       ├── teachers/       # Full CRUD + subject assignment
│       │       ├── guardians/      # Full CRUD + student links
│       │       ├── attendance/     # Per-subject bulk attendance
│       │       ├── marks/          # Live-calculation marks entry
│       │       ├── conduct/        # 14-category star ratings
│       │       ├── promotion/      # Year-end bulk decisions
│       │       ├── report-cards/   # Full PDF-ready report card
│       │       ├── finance/        # Invoices, payments, receipts
│       │       ├── classes/        # Classes + subjects management
│       │       └── settings/       # School info + grading scale editor
│       ├── components/
│       │   ├── forms/              # StudentModal, TeacherModal
│       │   ├── shared/             # StatusBadge, GradeCell
│       │   └── ui/                 # Toaster
│       ├── hooks/useApi.ts         # All TanStack Query hooks
│       ├── lib/
│       │   ├── api/client.ts       # Axios + JWT auto-refresh interceptor
│       │   └── api/services.ts     # Typed API service layer
│       ├── store/auth.store.ts     # Zustand auth store
│       └── types/index.ts          # TypeScript types (mirrors all Django models)
│
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## API Endpoints

All routes are under `/api/`. Authentication via `Authorization: Bearer <token>`.

| Resource              | Endpoint                      |
|-----------------------|-------------------------------|
| Login                 | `POST /api/auth/login/`       |
| Refresh token         | `POST /api/auth/refresh/`     |
| Logout                | `POST /api/auth/logout/`      |
| Students              | `/api/students/`              |
| Report card           | `GET /api/students/{id}/report_card/` |
| Guardians             | `/api/guardians/`             |
| Teachers              | `/api/teachers/`              |
| Teacher assignments   | `/api/teacher-assignments/`   |
| Classes               | `/api/classes/`               |
| Subjects              | `/api/subjects/`              |
| Academic years        | `/api/academic-years/`        |
| Semesters             | `/api/semesters/`             |
| Attendance            | `/api/attendance/`            |
| Attendance summary    | `/api/attendance-summary/`    |
| Marks                 | `/api/marks/`                 |
| Marks bulk save       | `POST /api/marks/bulk/`       |
| Grading scales        | `/api/grading-scales/`        |
| Conduct categories    | `/api/conduct-categories/`    |
| Conduct ratings       | `/api/conduct-ratings/`       |
| Promotions            | `/api/promotions/`            |
| Invoices              | `/api/invoices/`              |
| Payments              | `/api/payments/`              |
| Notifications         | `/api/notifications/`         |

---

## Demo Credentials

| Role          | Email                            | Password     |
|---------------|----------------------------------|--------------|
| Administrator | admin@sacredheart.edu.lr         | admin123     |
| Teacher       | s.johnson@sacredheart.edu.lr     | teacher123   |

---

## Key Design Decisions

- **Grading scale is DB-driven** — never hardcoded. Edit in Settings → Grading Scale.
- **Student IDs are custom** — admin enters manually (e.g. `CHS-2026-001`). No auto-generation.
- **RBAC enforced at API level** — teachers only see their assigned classes; guardians only see their linked students.
- **JWT with silent refresh** — access tokens auto-refresh via Axios interceptor. No user interruption.
- **Report card pulls live data** — marks, conduct, attendance, ranking and promotion decision all from the database.
- **TanStack Query throughout** — all server state cached, invalidated on mutations.
- **WhatsApp infrastructure ready** — notification model has `channel=whatsapp`, Celery task scaffolded. Wire up Business API when approved.
- **Scalable architecture** — designed for 5,000–10,000 students without architectural changes.

---

## Next Steps (Post-Contract)

- [ ] PDF report card generation (WeasyPrint on backend)
- [ ] WhatsApp notification integration
- [ ] Bulk attendance import (CSV)
- [ ] Parent portal (guardian role full UI)
- [ ] Student portal (self-service results view)
- [ ] Fee receipt PDF generation
- [ ] Analytics dashboard (Recharts charts)
- [ ] Multi-school support (white-label)
- [ ] Mobile app (React Native / Expo)

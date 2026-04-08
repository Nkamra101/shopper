# Shopper Scheduler

A fullstack scheduling app inspired by the Cal.com assignment brief.

- **Frontend:** React + Vite + React Router (light/dark theme, toasts, skeleton loading, accessible forms)
- **Backend:** FastAPI + SQLAlchemy 2 (PostgreSQL preferred, SQLite fallback)
- **Features:** event types, weekly availability with timezone, public booking page with slot generation, double-booking prevention (DB-level partial unique index on Postgres), bookings dashboard with upcoming/past filtering, reschedule and cancellation, transactional emails for booking lifecycle, and email OTP verification before booking

## Project Structure

```
backend/      FastAPI application
frontend/     React application
```

## Local Setup

### 1. Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows
pip install -r requirements.txt
copy .env.example .env          # edit DATABASE_URL inside
uvicorn app.main:app --reload
```

The API runs at `http://127.0.0.1:8000` with Swagger UI at `/docs` and a health check at `/health`.

With no `DATABASE_URL` set, a local SQLite file is used automatically so the app boots with zero config.

### 2. Frontend

```bash
cd frontend
npm install
copy .env.example .env          # set VITE_API_URL if needed
npm run dev
```

Runs at `http://localhost:5173`. Point the frontend at your local backend by setting in `frontend/.env`:

```env
VITE_API_URL=http://127.0.0.1:8000
```

## Configuration (Backend)

All runtime configuration is environment-driven (see `backend/.env.example`):

| Variable           | Purpose                                                                   | Default                |
| ------------------ | ------------------------------------------------------------------------- | ---------------------- |
| `APP_ENV`          | `development` or `production`                                             | `development`          |
| `DEBUG`            | Enables verbose logging & FastAPI debug mode                              | `false`                |
| `DATABASE_URL`     | SQLAlchemy URL. Supports `postgresql://`, `postgres://`, `sqlite:///...`  | local SQLite           |
| `CORS_ORIGINS`     | Comma-separated list of allowed frontend origins                          | `localhost:5173` (dev) |
| `SEED_ON_STARTUP`  | Whether to seed demo data on first boot (safe: skips if data exists)      | `true`                 |
| `DEFAULT_TIMEZONE` | IANA timezone used for availability / slot generation                     | `Asia/Kolkata`         |

Legacy `postgres://` URLs from providers (Render, Railway, Heroku) are automatically normalised to `postgresql://`.

### Email (SMTP) configuration

The app sends two kinds of emails:

1. **OTP verification codes** to bookers, before they're allowed to confirm a booking (synchronous; the booker is waiting on it).
2. **Booking lifecycle notifications** — confirmed / rescheduled / cancelled — sent in the background.

Configure SMTP via these env vars (Gmail with an App Password is the recommended path):

| Variable               | Purpose                                          | Example                       |
| ---------------------- | ------------------------------------------------ | ----------------------------- |
| `SMTP_HOST`            | SMTP server hostname                             | `smtp.gmail.com`              |
| `SMTP_PORT`            | `587` for STARTTLS, `465` for SSL                | `587`                         |
| `SMTP_USER`            | SMTP username                                    | `you@gmail.com`               |
| `SMTP_PASS`            | SMTP password / app password                     | `<16-char app password>`      |
| `SMTP_FROM`            | From address (defaults to `SMTP_USER` if unset)  | `you@gmail.com`               |
| `SMTP_FROM_NAME`       | Display name on outgoing mail                    | `Shopper Scheduler`           |
| `SMTP_TIMEOUT_SECONDS` | Per-attempt SMTP timeout                         | `10`                          |
| `SMTP_RETRY_COUNT`     | Extra retries on top of the first attempt        | `1`                           |

**Gmail setup:** turn on 2-Step Verification on the Google account, generate an App Password (Google Account → Security → App passwords), and use that 16-character value as `SMTP_PASS`. Regular account passwords will not work.

If `SMTP_HOST`/`SMTP_USER`/`SMTP_PASS` are missing the app boots fine but every email send is logged and skipped — and the OTP `/request` endpoint returns 503, so booking is effectively disabled until SMTP is configured.

### OTP / verification token tuning

| Variable                          | Purpose                                                                | Default |
| --------------------------------- | ---------------------------------------------------------------------- | ------- |
| `OTP_TTL_SECONDS`                 | How long an issued code stays valid                                    | `600`   |
| `OTP_RATE_LIMIT_SECONDS`          | Minimum gap between code requests for the same email                   | `60`    |
| `OTP_MAX_ATTEMPTS`                | Wrong-code attempts allowed before the code is burned                  | `5`     |
| `VERIFICATION_TOKEN_TTL_SECONDS`  | Lifetime of the bearer token issued after successful verification      | `900`   |

## Deployment

### Backend on Koyeb + Neon (recommended free stack)

Both Koyeb (Eco plan) and Neon (free tier) require **no credit card** and keep the backend always-on. A `koyeb.yaml` is included at `backend/koyeb.yaml` for reference.

**1. Create the Postgres database on Neon**

1. Sign up at https://neon.tech (GitHub login)
2. Create a project, pick a region close to you (e.g. `aws-ap-south-1`)
3. Copy the connection string — it looks like `postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require`
4. Save it for the next step. The app's `database.py` automatically normalises legacy `postgres://` URLs and uses `pool_pre_ping=True`, so it handles Neon's idle-sleep reconnects cleanly.

**2. Deploy the backend on Koyeb**

1. Sign up at https://koyeb.com (GitHub login)
2. **Create Service → GitHub** → select this repo
3. Configure:
   - **Work directory:** `backend`
   - **Build command:** `pip install -r requirements.txt`
   - **Run command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - **Instance type:** Free (Eco)
   - **Port:** `8000` HTTP
   - **Health check:** HTTP `/health` on port `8000`
4. **Environment variables:**
   - `APP_ENV=production`
   - `DEBUG=false`
   - `DATABASE_URL=<Neon connection string>` (mark as Secret)
   - `CORS_ORIGINS=https://<your-frontend-domain>` (comma-separated for multiple)
   - `SEED_ON_STARTUP=false`
   - `DEFAULT_TIMEZONE=Asia/Kolkata`
   - SMTP vars (`SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, …) — see the SMTP section above
5. Deploy. Once live, test `https://<service>.koyeb.app/health` and `https://<service>.koyeb.app/docs`.

### Backend on Render

A `render.yaml` is included at `backend/render.yaml` for infrastructure-as-code deployments. Or set it up via the dashboard:

1. **New → Web Service**, connect the repo, pick the `backend` directory as the root
2. **Runtime:** Python
3. **Build command:** `pip install -r requirements.txt`
4. **Start command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
5. **Health check path:** `/health`
6. **Environment variables:**
   - `APP_ENV=production`
   - `DEBUG=false`
   - `DATABASE_URL=<your Postgres URL>` (create a Render Postgres or paste a Neon/Supabase URL)
   - `CORS_ORIGINS=https://<your-frontend-domain>` (comma-separated for multiple)
   - `SEED_ON_STARTUP=true` (set to `false` on subsequent deploys if you do not want demo data)

### Backend on Railway

1. **New Project → Deploy from GitHub repo**
2. **Root directory:** `backend`
3. Railway auto-detects Python and reads `backend/Procfile`:
   ```
   web: uvicorn app.main:app --host 0.0.0.0 --port $PORT
   ```
4. Add a **PostgreSQL** plugin; Railway will inject `DATABASE_URL` automatically
5. Add variables: `APP_ENV=production`, `CORS_ORIGINS=https://<frontend-domain>`

### Frontend on Netlify / Vercel

1. **Root directory:** `frontend`
2. **Build command:** `npm run build`
3. **Output / publish directory:** `dist`
4. **Environment variable:** `VITE_API_URL=https://<your-backend-domain>`
5. After deploying the frontend, add its domain to the backend's `CORS_ORIGINS`

## API Overview

| Method | Path                                             | Description                               |
| ------ | ------------------------------------------------ | ----------------------------------------- |
| GET    | `/health`                                        | Liveness + DB connectivity probe          |
| GET    | `/api/summary`                                   | Dashboard counts                          |
| GET    | `/api/event-types`                               | List event types                          |
| POST   | `/api/event-types`                               | Create event type                         |
| PUT    | `/api/event-types/{id}`                          | Update event type                         |
| DELETE | `/api/event-types/{id}`                          | Delete event type (cascades to bookings)  |
| GET    | `/api/availability`                              | Get weekly availability                   |
| PUT    | `/api/availability`                              | Replace weekly availability               |
| GET    | `/api/bookings?scope=upcoming\|past\|all`        | List bookings                             |
| POST   | `/api/bookings/{id}/cancel`                      | Cancel a booking                          |
| POST   | `/api/bookings/{id}/reschedule`                  | Reschedule a confirmed booking            |
| GET    | `/api/public/event-types/{slug}`                 | Public event metadata                     |
| GET    | `/api/public/event-types/{slug}/slots?date=...`  | Available slots for a date                |
| POST   | `/api/public/otp/request`                        | Email a 6-digit verification code         |
| POST   | `/api/public/otp/verify`                         | Verify code, receive verification token   |
| POST   | `/api/public/event-types/{slug}/book`            | Create a booking (requires verification token) |
| GET    | `/api/public/bookings/{id}`                      | Public booking details (confirmation)     |

Interactive docs at `http://<host>/docs`.

## Datetime Convention

- All datetime columns store **naive UTC** values.
- The public-facing display timezone comes from `AvailabilitySetting.timezone`.
- Incoming booking timestamps are normalised to UTC before storage.
- Slot generation converts the working-hour window to UTC before querying the DB, so the app is correct near midnight and across DST transitions.

## Notes / Assumptions

- Single default admin user (no auth).
- One global weekly availability schedule applies to all event types.
- Deleting an event type cascades to its bookings.
- On Postgres, a partial unique index on `(event_type_id, start_time) WHERE status='confirmed'` prevents double-booking at the DB level. On SQLite (local dev), this degrades to a regular index — production should use Postgres.
- Schema is created via `Base.metadata.create_all()` on startup, plus a small idempotent column patcher in `main.py` for additive changes (e.g. `bookings.meeting_url`). For future structural changes, migrate to Alembic.
- Every booking requires a fresh email OTP — the booker requests a code, verifies it, and the resulting short-lived bearer token is consumed by `/book`. Tokens are stored server-side (no JWT dependency) and burned on use.
- Booking lifecycle emails (confirmed / rescheduled / cancelled) are sent via `BackgroundTasks` so they never block the API response. Failures are logged with retries.

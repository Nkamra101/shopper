# Shopper Scheduler

A fullstack scheduling app inspired by the Cal.com assignment brief.

- **Frontend:** React + Vite + React Router (light/dark theme, toasts, skeleton loading, accessible forms)
- **Backend:** FastAPI + SQLAlchemy 2 (PostgreSQL preferred, SQLite fallback)
- **Features:** event types, weekly availability with timezone, public booking page with slot generation, double-booking prevention (DB-level partial unique index on Postgres), bookings dashboard with upcoming/past filtering and cancellation

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
# source .venv/bin/activate     # macOS / Linux
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

## Deployment

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
| GET    | `/api/public/event-types/{slug}`                 | Public event metadata                     |
| GET    | `/api/public/event-types/{slug}/slots?date=...`  | Available slots for a date                |
| POST   | `/api/public/event-types/{slug}/book`            | Create a booking                          |
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
- Schema is created via `Base.metadata.create_all()` on startup. For future schema changes, migrate to Alembic.
- Email notifications and rescheduling are out of scope for this version.

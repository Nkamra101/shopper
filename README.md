# Shopper

A scheduling and booking platform in the vein of Calendly or Cal.com. Hosts
publish booking pages, invitees pick a slot and verify their email, and the
whole booking lifecycle — confirmation, reminders, reschedules, cancellations —
runs itself.

- **Frontend**: React 19 + Vite, deployed on Netlify
- **Backend**: FastAPI + MongoDB, deployed on Render
- **Database**: MongoDB Atlas

---

## 1. Features

### For the host
- **Event types** — multiple meeting templates with their own duration, slug,
  buffer, minimum notice and booking horizon.
- **Custom booking questions** — up to ten per event type (short text, long
  text, dropdown, checkbox, phone), required or optional. Answers are stored
  with the booking and included in the CSV export and calendar feed.
- **Availability with multiple windows per day** — a lunch break or split
  shift is just two windows on the same weekday. Overlaps are rejected.
- **Date-range blockouts** — block a single day or a holiday spanning weeks.
- **Bookings** — search, filter by scope (upcoming / past / cancelled), edit
  notes, reschedule, cancel in bulk, and export the current view to CSV.
- **Workflows** — automated email or webhook on booking created / cancelled /
  rescheduled, plus **time-based reminders** ("24 hours before") driven by a
  background scheduler.
- **Private calendar feed** — a token-addressed iCal URL to subscribe from
  Google Calendar, Apple Calendar or Outlook. Rotatable.
- **Integrations** — Slack, Discord, Teams and generic webhooks.
- **Analytics** — booking volume, popular slots, conversion.
- **API keys** — `sk_live_…` bearer tokens for the same endpoints as the UI.

### For the invitee
- **Public booking page** at `/book/<slug>` with a live calendar; days with no
  availability are greyed out before they click.
- **Timezone picker** — slots render in whatever timezone the invitee chooses,
  defaulting to their browser's. Booking is stored in UTC either way.
- **Email verification** — a 6-digit OTP before a booking is confirmed.
- **Self-service management** at `/manage/<token>` — reschedule or cancel from
  a link in the confirmation email, with no account and no email to the host.

---

## 2. Architecture

### Multi-tenancy
Every account is a tenant. `event_types`, `availability_settings`,
`availability_rules`, `blockout_dates`, `bookings`, `workflows` and
`integrations` all carry an `owner_id`, and every admin endpoint is scoped to
the authenticated user. Requests for another tenant's document return 404
rather than 403, so ids can't be probed.

Event-type slugs are **globally** unique, which keeps public links at
`/book/<slug>` without a username segment.

### Authentication
- `POST /api/auth/login` issues a JWT (HS256).
- API keys (`sk_live_…`) are accepted on the same `Authorization: Bearer`
  header; only a SHA-256 hash is stored.
- `app/security.py` is the single source of truth — routers depend on
  `require_user` / `require_owner_id` rather than parsing headers themselves.

### Datetime convention
MongoDB stores **naive UTC**. The host's timezone (from their availability
settings) is what working hours are interpreted in. Slots are returned with an
unambiguous `start_utc` so the browser can render them in any timezone, and
bookings are normalised back to UTC on the way in.

### Reminder scheduler
`app/services/scheduler.py` polls every 60 seconds for bookings entering a
workflow's reminder window. Delivery is at-most-once per (booking, workflow),
enforced by a unique index on `reminder_log` — the insert *is* the lock, so
overlapping polls or a second instance cannot double-send. Catch-up is bounded
to two hours so a service that was asleep doesn't flood old reminders.

### Layout
```
backend/app/
  main.py           app wiring, CORS, security headers, lifespan
  config.py         env-driven settings + production validation
  security.py       password hashing, JWT, auth dependencies
  database.py       Mongo client and index management
  migrations.py     idempotent startup migrations
  serializers.py    document -> API shape helpers
  schemas.py        Pydantic request/response models
  routers/          auth, event_types, availability, bookings, blockouts,
                    public, otp, integrations, calendar, workflows
  services/         booking_service (slots), email, otp, webhooks,
                    workflows, scheduler, rate_limit
  scripts/          smoke_test.py
frontend/src/
  pages/            route-level components
  components/       Toast, Skeleton, ThemeToggle, AuthContext…
  services/api.js   API client
  utils/date.js     timezone-aware formatting
  index.css         design tokens + component styles
```

---

## 3. Running locally

**Prerequisites**: Python 3.11+, Node 18+, MongoDB (local or Atlas).

**Backend**
```bash
cd backend
python -m venv .venv
.venv/Scripts/activate        # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # then edit
uvicorn app.main:app --reload
```

**Frontend**
```bash
cd frontend
npm install
cp .env.example .env          # VITE_API_URL=http://127.0.0.1:8000
npm run dev
```

Leave `SMTP_*` blank in development: emails are written to the server log, and
the booking OTP is shown in the UI so you can complete a booking end to end.

Interactive API docs are at `/docs` — disabled automatically in production.

---

## 4. Tests

```bash
docker run -d -p 27099:27017 --name shopper-test-mongo mongo:7
cd backend && python scripts/smoke_test.py
```

82 checks covering tenant isolation, auth enforcement, slot generation with
lunch breaks, the OTP and booking flow, custom questions, invitee
reschedule/cancel, blockouts, CSV export, the reminder scheduler and the iCal
feed. It drops its target database on every run, so never point
`SMOKE_MONGODB_URI` at real data.

---

## 5. Deployment

### 5.1 Database — MongoDB Atlas
1. Create a free **M0** cluster.
2. Database Access → add a user with *Read and write to any database*.
3. Network Access → allow `0.0.0.0/0` (Render's egress IPs are dynamic).
4. Copy the `mongodb+srv://…` connection string.

### 5.2 Backend — Render
Deploy from `backend/render.yaml`, then fill in the secrets marked
`sync: false` in the dashboard:

| Variable | Value |
| :-- | :-- |
| `MONGODB_URI` | the Atlas connection string |
| `SECRET_KEY` | `python -c "import secrets; print(secrets.token_urlsafe(48))"` |
| `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | Gmail address + **App Password** |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | optional |

Then set these to your real URLs (no trailing slash):
`FRONTEND_URL`, `API_PUBLIC_URL`, `CORS_ORIGINS`.

The app **refuses to start in production** if `SECRET_KEY` is missing, default
or under 32 characters, if `MONGODB_URI` points at localhost, or if
`CORS_ORIGINS` is empty or `*`. A boot failure here is the app telling you a
secret is missing — check the logs rather than relaxing the check.

### 5.3 Frontend — Netlify
`netlify.toml` is committed, so Netlify picks up base, build command, publish
directory and the SPA redirect automatically. Set one environment variable:

```
VITE_API_URL = https://<your-backend>.onrender.com
```

Vite inlines this at build time, so **changing it requires a redeploy**, not
just a restart.

### 5.4 Keeping the free backend awake
Render's free tier suspends a service after ~15 minutes idle, and waking it
costs the next visitor ~50 seconds. `.github/workflows/keep-alive.yml` pings
`/health` every 14 minutes to prevent that.

The free tier allows 750 instance-hours per month against a ~730-hour month,
so one always-on service fits — but there is no room for a second free service
in the same account. Set the repo variable `BACKEND_URL` if your URL differs.
GitHub disables scheduled workflows on repositories with no activity for 60
days; if cold starts return, check the workflow is still enabled.

### 5.5 First deploy checklist
1. Register the first account immediately — on a database that already holds
   data, the oldest account inherits it.
2. Set a booking username in **Profile**.
3. Set availability, then create an event type.
4. Open `/book/<slug>` in a private window and book a slot to confirm SMTP
   works end to end.
5. Check the confirmation email contains a working reschedule/cancel link —
   if the link points at `localhost`, `FRONTEND_URL` is wrong.

---

## 6. Upgrading an existing deployment

`app/migrations.py` runs automatically at startup and is idempotent:

- assigns pre-existing global data to the oldest account
- renames `integrations.user_id` → `owner_id`
- converts single-day blockouts to date ranges
- backfills `manage_token` on existing bookings so old bookings get
  self-service links
- clears blank `booking_username` values that would collide under the new
  unique index
- drops the legacy indexes that conflict with per-tenant uniqueness

Take an Atlas snapshot before the first deploy of this version. Set
`RUN_MIGRATIONS_ON_STARTUP=false` afterwards if you prefer to run them
deliberately.

---

## 7. Security notes

- All admin endpoints require a bearer token; there are no unauthenticated
  reads of booking data.
- CORS is restricted to `CORS_ORIGINS`; credentials are not accepted, since
  auth travels in the `Authorization` header.
- Public booking, reschedule, OTP request/verify, login and registration are
  rate limited per IP, backed by Mongo with a TTL index.
- The iCal feed is addressed by an unguessable rotatable token and returns
  only that host's bookings.
- Invitee manage links are unguessable per-booking tokens that grant nothing
  beyond viewing, rescheduling or cancelling that one booking.
- `/docs` and `/openapi.json` are disabled when `APP_ENV=production`.

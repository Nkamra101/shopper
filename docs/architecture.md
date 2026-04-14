# Architecture

## Tech stack

### Frontend

| Technology | Version | Role |
|---|---|---|
| React | 19.1.1 | UI library |
| React Router DOM | 7.8.2 | Client-side routing |
| Vite | 7.1.3 | Build tool and dev server |
| CSS (vanilla) | — | Styling with CSS custom properties |

No Redux, no Zustand, no CSS-in-JS library. State is managed with React's built-in hooks and Context API.

### Backend

| Technology | Version | Role |
|---|---|---|
| Python | 3.x | Runtime |
| FastAPI | 0.135.2 | Web framework |
| SQLAlchemy | 2.0.48 | ORM |
| Pydantic | 2.12.5 | Request / response validation |
| Uvicorn | — | ASGI server |
| PostgreSQL | — | Primary database (production) |
| SQLite | — | Fallback database (local dev) |
| tzdata | — | IANA timezone database |
| python-dotenv | — | `.env` file loading |

---

## Repository layout

```
shopper/
├── docs/                         ← You are here
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py               ← FastAPI app, CORS, startup lifecycle
│   │   ├── config.py             ← Environment-driven settings object
│   │   ├── database.py           ← SQLAlchemy engine and session factory
│   │   ├── models.py             ← ORM table definitions
│   │   ├── schemas.py            ← Pydantic request / response models
│   │   ├── seed.py               ← Demo data seeder
│   │   ├── routers/
│   │   │   ├── event_types.py    ← Admin event type CRUD + summary
│   │   │   ├── availability.py   ← Admin weekly schedule management
│   │   │   ├── bookings.py       ← Admin bookings list, cancel, reschedule
│   │   │   ├── public.py         ← Public event details, slots, booking creation
│   │   │   ├── otp.py            ← OTP request and verify
│   │   │   └── blockouts.py      ← Admin blockout date CRUD
│   │   └── services/
│   │       ├── email_service.py  ← SMTP delivery, email templates
│   │       ├── otp_service.py    ← OTP generation, verification, token lifecycle
│   │       └── booking_service.py← Slot generation, timezone handling
│   ├── requirements.txt
│   ├── .env                      ← Local config (not committed)
│   ├── .env.example              ← Template for .env
│   ├── Procfile                  ← Heroku / Railway start command
│   ├── koyeb.yaml                ← Koyeb deployment config
│   ├── render.yaml               ← Render deployment config
│   └── runtime.txt               ← Python version pinning
└── frontend/
    ├── src/
    │   ├── main.jsx              ← React entry point, context providers
    │   ├── App.jsx               ← Router, AdminLayout, cold-start detection
    │   ├── index.css             ← Global styles, CSS custom properties
    │   ├── pages/
    │   │   ├── DashboardPage.jsx
    │   │   ├── AvailabilityPage.jsx
    │   │   ├── BookingsPage.jsx
    │   │   ├── PublicBookingPage.jsx
    │   │   └── ConfirmationPage.jsx
    │   ├── components/
    │   │   ├── ThemeContext.jsx
    │   │   ├── ThemeToggle.jsx
    │   │   ├── Toast.jsx
    │   │   ├── SectionCard.jsx
    │   │   ├── EmptyState.jsx
    │   │   └── Skeleton.jsx
    │   ├── services/
    │   │   └── api.js            ← Fetch wrapper and all API call functions
    │   └── utils/
    │       └── date.js           ← Date formatting helpers
    ├── index.html
    ├── vite.config.js
    └── package.json
```

---

## Routing map

### Admin routes (use AdminLayout — sidebar + header)

| URL | Page | Purpose |
|---|---|---|
| `/` | DashboardPage | Create / edit / delete event types; view stats |
| `/availability` | AvailabilityPage | Set weekly hours, timezone, blockout dates |
| `/bookings` | BookingsPage | View, reschedule, or cancel bookings |

### Public routes (no sidebar)

| URL | Page | Purpose |
|---|---|---|
| `/book/:slug` | PublicBookingPage | Visitor picks a date, time, fills form, verifies email |
| `/book/:slug/confirmed/:bookingId` | ConfirmationPage | Post-booking success page with video call link |

---

## Key architectural decisions

### Single global availability schedule

All event types share one weekly availability schedule and one timezone setting. There is no per-event-type availability override. This is a conscious simplification — if the admin needs different hours for different event types, they would need separate admin accounts in a more advanced implementation.

### No authentication

The admin section (`/`, `/availability`, `/bookings`) is unprotected. A header pill reads "Default user is signed in" to communicate this is a demo. In a production scenario, a login flow would wrap the admin routes.

### Email OTP instead of JWT

Rather than issuing a JWT, the backend stores a `VerificationToken` row in the database. This approach:

- Avoids a JWT library dependency.
- Gives the server full control over token invalidation (the token is "consumed" on first use).
- Prevents replay attacks — a token used for one booking cannot be reused for another.

### Naive UTC storage

All `DateTime` columns store **naive UTC** (no timezone offset in the value itself). Timezone-aware display is handled at the application layer using `AvailabilitySetting.timezone`. Slot generation builds windows in local time and converts to UTC before querying the database.

### PostgreSQL partial unique index

The `bookings` table has a partial unique index on `(event_type_id, start_time)` filtered to `status = 'confirmed'`. This means:

- Two confirmed bookings cannot occupy the same slot for the same event type (enforced at the DB level on PostgreSQL).
- Cancelled bookings are ignored by the index, so the slot can be rebooked after a cancellation.
- On SQLite (local dev), this degrades to a regular unique index with no partial filter — the constraint is not enforced, which is acceptable for development but not for production.

### Cold-start toast

The frontend `api.js` wrapper starts a 4-second timer on every request. If no response arrives within 4 seconds, a `"api-slow"` custom event is dispatched on `window`. `App.jsx` listens for this and shows a persistent toast: "Waking up the server, this might take up to a minute...". When the response eventually arrives, an `"api-fast"` event is dispatched, the toast is dismissed, and a success toast is shown. This improves perceived performance when the backend is on a free-tier host with cold starts.

### Background email delivery

Booking lifecycle emails (confirmed, rescheduled, cancelled) are sent via FastAPI's `BackgroundTasks`. The API response returns immediately; the email is delivered asynchronously. OTP emails are sent synchronously because the user is actively waiting for the code.

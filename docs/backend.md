# Backend

The backend is a FastAPI application with a SQLAlchemy ORM layer, Pydantic v2 validation, and a small set of service modules for email, OTP, and slot generation.

---

## Application entry point

### `app/main.py`

Creates and configures the FastAPI application instance.

**CORS middleware** — `CORSMiddleware` is added with the origins from `settings.CORS_ORIGINS`. During development this includes `localhost:5173` and `127.0.0.1:5173`. In production, set this to the exact frontend domain.

**Global exception handler** — A catch-all handler on `Exception` logs the traceback and returns a generic 500 response. This prevents stack traces leaking to clients.

**Lifespan context manager** — Runs on startup and shutdown:

1. Calls `Base.metadata.create_all(bind=engine)` to create any missing tables.
2. Runs an idempotent column patcher (adds `bookings.meeting_url` if it does not exist — handles databases created before this column was added).
3. If `settings.SEED_ON_STARTUP` is `True`, calls `seed_demo_data()`.

**Routers included:**

| Router module | URL prefix |
|---|---|
| `event_types` | `/api` |
| `availability` | `/api` |
| `bookings` | `/api` |
| `blockouts` | `/api` |
| `public` | `/api/public` |
| `otp` | `/api/public` |

**Utility endpoints:**

- `GET /health` — Returns `{ "status": "ok", "db": "ok" }`. The DB check runs a `SELECT 1` query. Returns 503 if the DB is unreachable.
- `GET /` — Returns `{ "app": "...", "version": "1.0.0", "docs": "/docs" }`.

---

## Configuration

### `app/config.py`

A `Settings` class (Pydantic `BaseSettings`) reads all configuration from environment variables. A single `settings` singleton is imported by all other modules.

See [configuration.md](./configuration.md) for the full variable reference.

---

## Database

### `app/database.py`

Creates the SQLAlchemy engine and a `SessionLocal` factory.

- **PostgreSQL:** uses `pool_pre_ping=True` to handle idle-sleep reconnects (important for Neon's serverless Postgres which suspends after inactivity).
- **SQLite:** uses `connect_args={"check_same_thread": False}` required by SQLite's threading model.
- **Legacy URL normalisation:** automatically converts `postgres://` (deprecated) to `postgresql://`.

**`get_db()` dependency** — A FastAPI dependency that yields a database session and ensures it is closed after each request, even if an exception is raised:

```python
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

---

## Models

### `app/models.py`

All SQLAlchemy ORM table definitions.

---

#### `EventType`

Table: `event_types`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | Integer | PK, index | Auto-increment primary key |
| `title` | String(120) | not null | Display name of the event type |
| `description` | Text | default `""` | Optional longer description |
| `duration` | Integer | not null | Meeting length in minutes |
| `url_slug` | String(120) | unique, not null, index | URL-safe identifier used in booking links |
| `accent_color` | String(30) | default `#0f172a` | Hex colour string for UI accents |
| `created_at` | DateTime | default utcnow | Row creation timestamp (naive UTC) |

**Relationship:** `bookings` — one-to-many to `Booking`, with `cascade="all, delete-orphan"`. Deleting an `EventType` deletes all associated bookings.

---

#### `AvailabilitySetting`

Table: `availability_settings`

A singleton row (always `id=1`) storing the admin's selected timezone.

| Column | Type | Description |
|---|---|---|
| `id` | Integer | Always 1 |
| `timezone` | String(80) | IANA timezone string, e.g. `Asia/Kolkata` |

---

#### `AvailabilityRule`

Table: `availability_rules`

One row per day of the week. There are always 7 rows (one for each day, 0=Monday through 6=Sunday).

| Column | Type | Description |
|---|---|---|
| `id` | Integer | PK |
| `day_of_week` | Integer | 0 (Monday) to 6 (Sunday) |
| `start_time` | Time | Start of working hours on this day |
| `end_time` | Time | End of working hours on this day |
| `is_active` | Boolean | Whether the admin is available on this day |

---

#### `BlockoutDate`

Table: `blockout_dates`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | Integer | PK | Auto-increment |
| `date` | Date | unique, not null, index | The blocked date |
| `reason` | String(120) | default `""` | Human-readable label |
| `created_at` | DateTime | default utcnow | Row creation timestamp |

---

#### `EmailOtp`

Table: `email_otps`

Stores one-time codes sent to bookers before they are allowed to confirm a booking.

| Column | Type | Description |
|---|---|---|
| `id` | Integer | PK |
| `email` | String(120) | The recipient email address |
| `code_hash` | String(128) | SHA-256 hash of the 6-digit code |
| `expires_at` | DateTime | When the code becomes invalid |
| `attempts` | Integer | Number of incorrect verification attempts |
| `used` | Boolean | True once the code has been successfully verified |
| `created_at` | DateTime | Row creation timestamp |

Old, expired, or used rows are not automatically purged — they can be cleaned up with a periodic job if needed.

---

#### `VerificationToken`

Table: `verification_tokens`

A short-lived token issued after successful OTP verification. The booker presents this token to the `/book` endpoint to prove they control the email address.

| Column | Type | Description |
|---|---|---|
| `id` | Integer | PK |
| `token` | String(64) | 64-char hex string (256-bit random, generated with `secrets.token_hex`) |
| `email` | String(120) | The verified email address |
| `expires_at` | DateTime | Token expiry (default 15 minutes after creation) |
| `consumed_at` | DateTime (nullable) | Set when the token is used; `null` if still valid |
| `created_at` | DateTime | Row creation timestamp |

A token is valid if:
- `consumed_at IS NULL`
- `expires_at > now()`

Tokens are burned (set `consumed_at`) on first use — they cannot be replayed.

---

#### `Booking`

Table: `bookings`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | Integer | PK | Auto-increment |
| `event_type_id` | Integer | FK → `event_types.id` (CASCADE) | The event type being booked |
| `booker_name` | String(120) | not null | Visitor's name |
| `booker_email` | String(120) | not null, index | Visitor's email |
| `notes` | Text | default `""` | Optional notes from the visitor |
| `status` | String(20) | default `confirmed`, index | `confirmed` or `cancelled` |
| `meeting_url` | String(255) | default `""` | Auto-generated Jitsi URL |
| `start_time` | DateTime | not null, index | Meeting start (naive UTC) |
| `end_time` | DateTime | not null | Meeting end (naive UTC) |
| `created_at` | DateTime | default utcnow | Row creation timestamp |

**Relationship:** `event_type` — many-to-one back to `EventType`.

**Partial unique index `uq_booking_confirmed_slot`:**

```sql
CREATE UNIQUE INDEX uq_booking_confirmed_slot
ON bookings (event_type_id, start_time)
WHERE status = 'confirmed';
```

This prevents two confirmed bookings from occupying the same slot for the same event type. Cancelled bookings are excluded so the slot can be rebooked. On SQLite (local dev), this degrades to a regular unique index without the `WHERE` clause — the constraint is not enforced locally.

---

## Schemas

### `app/schemas.py`

All Pydantic v2 models for request bodies and response shapes.

---

#### Event type schemas

**`EventTypeCreate`** (request body for POST)

| Field | Type | Validation |
|---|---|---|
| `title` | str | max 120 chars, required |
| `description` | str | optional, default `""` |
| `duration` | int | required |
| `url_slug` | str | must match `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `accent_color` | str | optional, default `#0f172a` |

**`EventTypeUpdate`** (request body for PUT) — same fields as `EventTypeCreate`.

**`EventTypeRead`** (response) — all `EventTypeCreate` fields plus:

| Field | Type |
|---|---|
| `id` | int |
| `created_at` | datetime |

---

#### Availability schemas

**`AvailabilityRuleInput`** (inside the PUT request body)

| Field | Type | Validation |
|---|---|---|
| `day_of_week` | int | 0–6 |
| `start_time` | time | HH:MM |
| `end_time` | time | HH:MM |
| `is_active` | bool | — |

**`AvailabilityUpdate`** (PUT request body)

| Field | Type |
|---|---|
| `timezone` | str |
| `rules` | list of `AvailabilityRuleInput` |

**`AvailabilityRuleRead`** / **`AvailabilityRead`** — response mirrors the input with IDs added.

---

#### Booking schemas

**`BookingRead`** (response)

| Field | Type |
|---|---|
| `id` | int |
| `booker_name` | str |
| `booker_email` | str |
| `notes` | str |
| `status` | str |
| `meeting_url` | str |
| `start_time` | datetime |
| `end_time` | datetime |
| `created_at` | datetime |
| `event_type` | `EventTypeRead` (nested) |

**`BookingCreate`** (POST `/book` request body)

| Field | Type | Notes |
|---|---|---|
| `booker_name` | str | required |
| `booker_email` | EmailStr | validated email format |
| `notes` | str | optional |
| `start_time` | datetime | ISO 8601 |
| `verification_token` | str | required — from OTP verify |

**`RescheduleRequest`** (POST `/reschedule` request body)

| Field | Type |
|---|---|
| `start_time` | datetime |

---

#### Public schemas

**`PublicEventTypeRead`** — same as `EventTypeRead` but also includes:

| Field | Type |
|---|---|
| `timezone` | str |

**`SlotRead`** (element in the slots list response)

| Field | Type | Description |
|---|---|---|
| `start_time` | str | ISO 8601 UTC string |
| `end_time` | str | ISO 8601 UTC string |
| `display_time` | str | 12-hour local time string (e.g. "2:30 PM") |

---

#### OTP schemas

**`OtpRequest`** — `{ "email": "user@example.com" }`

**`OtpRequestResponse`**

| Field | Type | Description |
|---|---|---|
| `detail` | str | Human-readable message |
| `expires_in` | int | Seconds until the code expires |
| `retry_after` | int | Seconds until the user can request another code |

**`OtpVerify`** — `{ "email": "user@example.com", "code": "123456" }`

**`OtpVerifyResponse`**

| Field | Type | Description |
|---|---|---|
| `verification_token` | str | The token to include in the booking request |
| `expires_in` | int | Seconds until the token expires |

---

#### Dashboard schema

**`DashboardSummary`**

| Field | Type |
|---|---|
| `event_types` | int |
| `upcoming_bookings` | int |
| `past_bookings` | int |

---

## Routers

### `app/routers/event_types.py`

Admin CRUD for event types plus the dashboard summary.

| Endpoint | Method | Description |
|---|---|---|
| `GET /api/event-types` | GET | Returns all event types ordered by `created_at` descending |
| `POST /api/event-types` | POST | Creates a new event type; returns 409 if `url_slug` is taken |
| `PUT /api/event-types/{id}` | PUT | Updates an existing event type; returns 404 if not found, 409 on slug conflict |
| `DELETE /api/event-types/{id}` | DELETE | Deletes the event type and all its bookings (cascade); emails bookers of upcoming bookings |
| `GET /api/summary` | GET | Returns `DashboardSummary` with counts |

When an event type is deleted, the router fetches all confirmed upcoming bookings for it, sends each booker a cancellation email in the background, then deletes the event type row (which cascades to the bookings).

---

### `app/routers/availability.py`

| Endpoint | Method | Description |
|---|---|---|
| `GET /api/availability` | GET | Returns the current timezone and all 7 rules |
| `PUT /api/availability` | PUT | Atomically replaces all rules and updates the timezone |

The PUT handler deletes all existing `AvailabilityRule` rows and inserts the new set in a single transaction, ensuring the schedule is never in a partially-updated state.

If no `AvailabilitySetting` row exists yet (fresh database), the GET handler creates one with the default timezone from `settings.DEFAULT_TIMEZONE`.

---

### `app/routers/bookings.py`

| Endpoint | Method | Description |
|---|---|---|
| `GET /api/bookings` | GET | Lists bookings filtered by `scope` query param (`upcoming`, `past`, `all`) |
| `POST /api/bookings/{id}/cancel` | POST | Sets `status = "cancelled"`, emails the booker |
| `POST /api/bookings/{id}/reschedule` | POST | Validates the new slot, updates `start_time` / `end_time`, emails the booker |

The reschedule handler:
1. Looks up the booking and its event type (returns 404 if either is missing).
2. Calls `generate_slots()` to get the available slots for the new date.
3. Checks that the requested `start_time` appears in the generated slots (returns 400 if not).
4. Updates `start_time` and `end_time`.
5. Enqueues a reschedule email in the background.

---

### `app/routers/blockouts.py`

| Endpoint | Method | Description |
|---|---|---|
| `GET /api/blockouts` | GET | Returns all blockout dates ordered by date ascending |
| `POST /api/blockouts` | POST | Creates a blockout date; returns 409 if the date already exists |
| `DELETE /api/blockouts/{date}` | DELETE | Deletes a blockout by date string (`YYYY-MM-DD`); returns 404 if not found |

---

### `app/routers/public.py`

Unauthenticated endpoints used by the public booking page.

| Endpoint | Method | Description |
|---|---|---|
| `GET /api/public/event-types/{slug}` | GET | Returns event type details including timezone; 404 if slug not found |
| `GET /api/public/event-types/{slug}/slots` | GET | Returns available time slots for a `date` query param |
| `POST /api/public/event-types/{slug}/book` | POST | Creates a confirmed booking |
| `GET /api/public/bookings/{id}` | GET | Returns booking details for the confirmation page |

**Slot generation** — Delegates to `booking_service.generate_slots()`.

**Booking creation** flow:
1. Validates the `verification_token` via `otp_service.consume_verification_token()`.
2. Checks the email on the token matches `booker_email` in the request (returns 400 if not).
3. Calls `generate_slots()` to verify the requested `start_time` is still available (returns 400 if not).
4. Generates a Jitsi meeting URL: `https://meet.jit.si/{slug}-{uuid4}`.
5. Inserts the `Booking` row. If PostgreSQL raises an `IntegrityError` (duplicate confirmed slot), returns 409.
6. Enqueues a confirmation email in the background.
7. Returns the created `BookingRead`.

---

### `app/routers/otp.py`

| Endpoint | Method | Description |
|---|---|---|
| `POST /api/public/otp/request` | POST | Generates and emails a 6-digit OTP |
| `POST /api/public/otp/verify` | POST | Verifies the code and returns a `VerificationToken` |

The `/request` endpoint returns 503 if SMTP is not configured (no host/user/pass), since there is no way to deliver the code.

---

## Services

### `app/services/email_service.py`

Handles all email delivery.

**`send_email_now(to, subject, html_body, text_body)`**

Synchronous SMTP delivery. Used for OTP codes (the user is waiting). Steps:

1. Opens an SMTP connection using `SMTP_HOST:SMTP_PORT`.
2. If port is 465, uses `SMTP_SSL`. Otherwise uses plain SMTP with `starttls()`.
3. Logs in with `SMTP_USER` / `SMTP_PASS`.
4. Sends the message.
5. On failure, retries up to `SMTP_RETRY_COUNT` extra times with a 2-second backoff.
6. If SMTP is not configured (any of host/user/pass is empty), logs the email content and returns without error.

**`send_email_background(background_tasks, to, subject, html_body, text_body)`**

Wraps `send_email_now` in a FastAPI `BackgroundTask`. Used for booking lifecycle emails so the API response is not blocked.

**Email templates (inline HTML):**

| Template | Trigger | Content |
|---|---|---|
| OTP email | `otp_service.request_otp()` | 6-digit code, expiry time |
| Booking confirmed | `public.py` book endpoint | Event title, date, time, timezone, video call link |
| Booking rescheduled | `bookings.py` reschedule endpoint | New date and time, video call link |
| Booking cancelled | `bookings.py` cancel endpoint and `event_types.py` delete | Event title and original time |

All emails include both HTML and plain-text parts.

---

### `app/services/otp_service.py`

Manages the full OTP lifecycle.

**`request_otp(db, email)` → `OtpRequestResponse`**

1. Checks rate limiting: if a code was issued for this email within `OTP_RATE_LIMIT_SECONDS` seconds, raises 429 with `retry_after` in the response.
2. Generates a 6-digit random code using `random.randint(100000, 999999)`.
3. SHA-256 hashes the code string (`hashlib.sha256`).
4. Creates an `EmailOtp` row with `expires_at = now + OTP_TTL_SECONDS`.
5. Calls `send_email_now()` to deliver the code.
6. Returns the expiry and retry-after values.

**`verify_otp(db, email, code)` → `OtpVerifyResponse`**

1. Queries for the most recent non-used, non-expired OTP for the email.
2. If none found, raises 400 ("No valid code found. Please request a new one.").
3. Increments `attempts`. If `attempts > OTP_MAX_ATTEMPTS`, marks the code as `used` and raises 400 ("Too many incorrect attempts.").
4. Hashes the submitted code and compares to `code_hash`. If mismatch, saves the incremented attempt count and raises 400 ("Incorrect code.").
5. Marks the OTP row as `used`.
6. Creates a `VerificationToken` with `expires_at = now + VERIFICATION_TOKEN_TTL_SECONDS`.
7. Returns the token string and its expiry.

**`consume_verification_token(db, token, email)` → `VerificationToken`**

Called during booking creation to validate and burn the token.

1. Queries for a token where `token = token` and `consumed_at IS NULL` and `expires_at > now`.
2. If not found, raises 400 ("Verification token is invalid or has expired.").
3. Sets `consumed_at = now`.
4. Returns the row (so the caller can check the `email` field matches the booking email).

---

### `app/services/booking_service.py`

Handles slot generation — the most complex business logic in the app.

**`generate_slots(db, slug, date_str)` → `list[SlotRead]`**

Input: event type slug, date string `YYYY-MM-DD`.

Steps:

1. Fetches the `EventType` by slug (404 if not found).
2. Fetches the `AvailabilitySetting` for the timezone.
3. Determines the day of week for the requested date (0=Monday, 6=Sunday).
4. Fetches the `AvailabilityRule` for that day. If the rule is inactive or does not exist, returns an empty list.
5. Checks if the date is in `blockout_dates`. If so, returns an empty list.
6. Builds the availability window in local time:
   - `window_start` = `rule.start_time` on the requested date, in the admin's timezone.
   - `window_end` = `rule.end_time` on the same date.
   - Converts both to naive UTC for DB queries.
7. Fetches all confirmed bookings for this event type that fall within the UTC window.
8. Iterates through slot-sized increments (slot size = `event_type.duration` minutes):
   - For each potential slot, checks:
     - Is the slot in the past? (slot start < now UTC) → skip.
     - Is the slot occupied by an existing booking? → skip.
   - If neither, includes the slot.
9. Builds `SlotRead` objects with ISO UTC strings for `start_time`/`end_time` and a 12-hour `display_time` in the admin's timezone.

**`normalize_booking_start(start_time, timezone)` → `datetime`**

Takes an incoming booking `start_time` (which may have timezone info) and returns a naive UTC datetime for storage.

**Helper queries:** `get_timezone(db)`, `get_public_event_type(db, slug)`.

---

## Seed data

### `app/seed.py`

Called on startup if `SEED_ON_STARTUP=true`. Idempotent — checks if data already exists before inserting.

Creates:

- 1 `AvailabilitySetting` with timezone `Asia/Kolkata`.
- 5 `AvailabilityRule` rows: Mon–Thu 10:00–17:00, Fri 10:00–15:00. Sat and Sun are inactive.
- 2 `EventType` rows:
  - "Product Discovery Call" — 30 min, slug `product-discovery`, dark blue `#0f172a`.
  - "Frontend Review Session" — 45 min, slug `frontend-review`, dark green `#064e3b`.
- 2 `Booking` rows:
  - An upcoming booking (tomorrow, 2 hours from now) for Aarav Sharma.
  - A past booking (2 days ago) for Neha Verma.

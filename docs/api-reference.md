# API Reference

The base URL for all endpoints is the backend host (e.g. `http://127.0.0.1:8000` locally).  
Interactive Swagger UI is available at `{base_url}/docs`.

All request and response bodies use JSON. All `DateTime` values are ISO 8601 strings representing **naive UTC** (no timezone offset suffix).

---

## Health and meta

### `GET /health`

Checks whether the app is running and the database is reachable.

**Response 200**

```json
{
  "status": "ok",
  "db": "ok"
}
```

**Response 503** — if the database SELECT 1 fails.

```json
{
  "status": "ok",
  "db": "error"
}
```

---

### `GET /`

Returns basic app metadata.

**Response 200**

```json
{
  "app": "Shopper Scheduling API",
  "version": "1.0.0",
  "docs": "/docs"
}
```

---

## Admin — Event Types

### `GET /api/event-types`

Returns all event types ordered by creation date (newest first).

**Response 200**

```json
[
  {
    "id": 1,
    "title": "Product Discovery Call",
    "description": "A 30-minute intro call to discuss your product.",
    "duration": 30,
    "url_slug": "product-discovery",
    "accent_color": "#0f172a",
    "created_at": "2024-06-01T10:00:00"
  }
]
```

---

### `POST /api/event-types`

Creates a new event type.

**Request body**

```json
{
  "title": "Product Discovery Call",
  "description": "A 30-minute intro call.",
  "duration": 30,
  "url_slug": "product-discovery",
  "accent_color": "#0f172a"
}
```

| Field | Required | Notes |
|---|---|---|
| `title` | Yes | Max 120 characters |
| `description` | No | Defaults to `""` |
| `duration` | Yes | Integer, minutes |
| `url_slug` | Yes | Lowercase letters, numbers, hyphens only: `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `accent_color` | No | Hex colour string, defaults to `#0f172a` |

**Response 201** — the created event type object (same shape as GET).

**Response 409** — if `url_slug` is already in use.

```json
{ "detail": "Slug 'product-discovery' is already taken." }
```

**Response 422** — Pydantic validation error (invalid slug pattern, missing required field, etc.)

---

### `PUT /api/event-types/{id}`

Updates an existing event type. All fields are replaced.

**Path parameter:** `id` — integer event type ID.

**Request body** — same shape as POST.

**Response 200** — the updated event type object.

**Response 404** — event type not found.

**Response 409** — slug conflict with a different event type.

---

### `DELETE /api/event-types/{id}`

Deletes an event type and all its bookings. Bookers of upcoming confirmed bookings receive cancellation emails.

**Path parameter:** `id` — integer event type ID.

**Response 204** — no content. Deletion was successful.

**Response 404** — event type not found.

---

### `GET /api/summary`

Returns dashboard statistics.

**Response 200**

```json
{
  "event_types": 2,
  "upcoming_bookings": 5,
  "past_bookings": 12
}
```

`upcoming_bookings` counts confirmed bookings with `start_time >= now`.  
`past_bookings` counts all bookings (any status) with `start_time < now`.

---

## Admin — Availability

### `GET /api/availability`

Returns the current timezone and weekly availability rules.

**Response 200**

```json
{
  "timezone": "Asia/Kolkata",
  "rules": [
    {
      "id": 1,
      "day_of_week": 0,
      "start_time": "10:00:00",
      "end_time": "17:00:00",
      "is_active": true
    },
    {
      "id": 2,
      "day_of_week": 1,
      "start_time": "10:00:00",
      "end_time": "17:00:00",
      "is_active": true
    }
  ]
}
```

`day_of_week`: 0 = Monday, 1 = Tuesday, ... 6 = Sunday.

If no availability has been configured yet (fresh database), an empty rules list and the default timezone are returned.

---

### `PUT /api/availability`

Replaces the entire weekly schedule atomically.

**Request body**

```json
{
  "timezone": "America/New_York",
  "rules": [
    { "day_of_week": 0, "start_time": "09:00", "end_time": "17:00", "is_active": true },
    { "day_of_week": 1, "start_time": "09:00", "end_time": "17:00", "is_active": true },
    { "day_of_week": 2, "start_time": "09:00", "end_time": "17:00", "is_active": true },
    { "day_of_week": 3, "start_time": "09:00", "end_time": "17:00", "is_active": true },
    { "day_of_week": 4, "start_time": "09:00", "end_time": "15:00", "is_active": true },
    { "day_of_week": 5, "start_time": "09:00", "end_time": "12:00", "is_active": false },
    { "day_of_week": 6, "start_time": "09:00", "end_time": "12:00", "is_active": false }
  ]
}
```

All existing rules are deleted and the new set is inserted. It is not required to send all 7 days — only the days you include will be created.

**Response 200** — the full availability object (same shape as GET response).

---

## Admin — Bookings

### `GET /api/bookings`

Returns a list of bookings.

**Query parameters:**

| Parameter | Values | Description |
|---|---|---|
| `scope` | `upcoming` \| `past` \| `all` | Filter by time and status. Default: `all` |

- `upcoming` — confirmed bookings with `start_time >= now(UTC)`.
- `past` — all bookings with `start_time < now(UTC)`.
- `all` — every booking.

**Response 200**

```json
[
  {
    "id": 1,
    "booker_name": "Aarav Sharma",
    "booker_email": "aarav@example.com",
    "notes": "Looking forward to it!",
    "status": "confirmed",
    "meeting_url": "https://meet.jit.si/product-discovery-a1b2c3d4...",
    "start_time": "2024-06-15T08:30:00",
    "end_time": "2024-06-15T09:00:00",
    "created_at": "2024-06-14T12:00:00",
    "event_type": {
      "id": 1,
      "title": "Product Discovery Call",
      "description": "...",
      "duration": 30,
      "url_slug": "product-discovery",
      "accent_color": "#0f172a",
      "created_at": "2024-06-01T10:00:00"
    }
  }
]
```

---

### `POST /api/bookings/{id}/cancel`

Cancels a booking and sends a cancellation email to the booker.

**Path parameter:** `id` — integer booking ID.

**Response 200** — the updated booking object with `status: "cancelled"`.

**Response 404** — booking not found.

---

### `POST /api/bookings/{id}/reschedule`

Rescheduled a confirmed booking to a new time.

**Path parameter:** `id` — integer booking ID.

**Request body**

```json
{
  "start_time": "2024-06-20T10:00:00"
}
```

The `start_time` must correspond to an available slot returned by `GET /api/public/event-types/{slug}/slots`. The endpoint validates this internally.

**Response 200** — the updated booking object with new `start_time` and `end_time`.

**Response 400** — the requested time is not an available slot.

**Response 404** — booking or event type not found.

---

## Admin — Blockout Dates

### `GET /api/blockouts`

Returns all blockout dates ordered by date ascending.

**Response 200**

```json
[
  {
    "id": 1,
    "date": "2024-12-25",
    "reason": "Christmas",
    "created_at": "2024-06-01T10:00:00"
  }
]
```

---

### `POST /api/blockouts`

Adds a blockout date.

**Request body**

```json
{
  "date": "2024-12-25",
  "reason": "Christmas"
}
```

| Field | Required | Notes |
|---|---|---|
| `date` | Yes | `YYYY-MM-DD` format |
| `reason` | No | Defaults to `""` |

**Response 201** — the created blockout object.

**Response 409** — a blockout for this date already exists.

---

### `DELETE /api/blockouts/{date}`

Removes a blockout date.

**Path parameter:** `date` — the date string in `YYYY-MM-DD` format.

**Response 204** — no content. Deletion was successful.

**Response 404** — no blockout found for this date.

---

## Public — Booking flow

### `GET /api/public/event-types/{slug}`

Returns the details of a public event type.

**Path parameter:** `slug` — the event type's `url_slug`.

**Response 200**

```json
{
  "id": 1,
  "title": "Product Discovery Call",
  "description": "A 30-minute intro call.",
  "duration": 30,
  "url_slug": "product-discovery",
  "accent_color": "#0f172a",
  "created_at": "2024-06-01T10:00:00",
  "timezone": "Asia/Kolkata"
}
```

**Response 404** — no event type with this slug.

---

### `GET /api/public/event-types/{slug}/slots`

Returns available time slots for a specific date.

**Path parameter:** `slug` — the event type's `url_slug`.

**Query parameter:** `date` — the date in `YYYY-MM-DD` format.

**Response 200**

```json
[
  {
    "start_time": "2024-06-15T04:30:00",
    "end_time": "2024-06-15T05:00:00",
    "display_time": "10:00 AM"
  },
  {
    "start_time": "2024-06-15T05:00:00",
    "end_time": "2024-06-15T05:30:00",
    "display_time": "10:30 AM"
  }
]
```

`start_time` and `end_time` are naive UTC strings.  
`display_time` is the local time in the admin's timezone (12-hour format).

An empty array is returned when:
- The date falls on an inactive day of the week.
- The date is a blockout date.
- All slots on the date are already booked or in the past.

**Response 404** — event type slug not found.

---

### `POST /api/public/otp/request`

Sends a 6-digit OTP code to the specified email address.

**Request body**

```json
{
  "email": "visitor@example.com"
}
```

**Response 200**

```json
{
  "detail": "Code sent to visitor@example.com",
  "expires_in": 600,
  "retry_after": 60
}
```

`expires_in` — seconds until the code expires (default 600 = 10 minutes).  
`retry_after` — seconds until the user can request another code (default 60).

**Response 429** — rate limited. Another code was requested too recently.

```json
{
  "detail": "Please wait 45 seconds before requesting a new code.",
  "retry_after": 45
}
```

**Response 503** — SMTP is not configured. No code can be delivered.

```json
{
  "detail": "Email service is not configured. Booking is currently unavailable."
}
```

---

### `POST /api/public/otp/verify`

Verifies the OTP code and returns a short-lived verification token.

**Request body**

```json
{
  "email": "visitor@example.com",
  "code": "123456"
}
```

**Response 200**

```json
{
  "verification_token": "a3f9b2c1...(64 hex chars)",
  "expires_in": 900
}
```

`expires_in` — seconds until the token expires (default 900 = 15 minutes).

**Response 400** — invalid code, expired code, or too many wrong attempts.

```json
{ "detail": "Incorrect code. 3 attempts remaining." }
```

```json
{ "detail": "No valid code found. Please request a new one." }
```

```json
{ "detail": "Too many incorrect attempts. Please request a new code." }
```

---

### `POST /api/public/event-types/{slug}/book`

Creates a confirmed booking. Requires a valid verification token obtained from `/otp/verify`.

**Path parameter:** `slug` — the event type's `url_slug`.

**Request body**

```json
{
  "booker_name": "Aarav Sharma",
  "booker_email": "aarav@example.com",
  "notes": "Looking forward to it!",
  "start_time": "2024-06-15T04:30:00",
  "verification_token": "a3f9b2c1..."
}
```

| Field | Required | Notes |
|---|---|---|
| `booker_name` | Yes | — |
| `booker_email` | Yes | Must be a valid email; must match the email used to verify the OTP |
| `notes` | No | Optional extra context |
| `start_time` | Yes | Must match an available slot from `/slots` |
| `verification_token` | Yes | From `/otp/verify`; single-use, expires after 15 min |

**Response 201** — the created booking object.

```json
{
  "id": 42,
  "booker_name": "Aarav Sharma",
  "booker_email": "aarav@example.com",
  "notes": "Looking forward to it!",
  "status": "confirmed",
  "meeting_url": "https://meet.jit.si/product-discovery-a1b2c3d4-e5f6-...",
  "start_time": "2024-06-15T04:30:00",
  "end_time": "2024-06-15T05:00:00",
  "created_at": "2024-06-14T16:00:00",
  "event_type": { ... }
}
```

**Response 400**

- Verification token is invalid or expired.
- Email on token does not match `booker_email`.
- `start_time` is not an available slot.

**Response 404** — event type slug not found.

**Response 409** — another booking was confirmed for this slot between the slot fetch and this request (race condition).

```json
{ "detail": "That slot was just booked. Please pick another time." }
```

---

### `GET /api/public/bookings/{id}`

Returns the details of a booking. Used by the confirmation page.

**Path parameter:** `id` — integer booking ID.

**Response 200** — the booking object (same shape as the admin `BookingRead`).

**Response 404** — booking not found.

---

## Error format

All error responses follow FastAPI's default format:

```json
{
  "detail": "Human-readable error message"
}
```

For Pydantic validation errors (422), the response contains a list of field-level errors:

```json
{
  "detail": [
    {
      "loc": ["body", "url_slug"],
      "msg": "String should match pattern ...",
      "type": "string_pattern_mismatch"
    }
  ]
}
```

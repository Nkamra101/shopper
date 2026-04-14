# User Flows

This document walks through every end-to-end journey in the application, explaining what happens on the frontend, what API calls are made, and what happens on the backend.

---

## Public booking flow

This is the primary flow a visitor goes through to book a meeting.

### Overview

```
/book/:slug
  │
  ├─ 1. Load event details     GET /api/public/event-types/{slug}
  ├─ 2. Pick a date            (client-side, no API call)
  ├─ 3. Pick a time slot       GET /api/public/event-types/{slug}/slots?date=...
  ├─ 4. Fill in name / email / notes
  ├─ 5. Request OTP            POST /api/public/otp/request
  ├─ 6. Enter OTP code         POST /api/public/otp/verify   → verification_token
  └─ 7. Confirm booking        POST /api/public/event-types/{slug}/book
         │
         └─ redirect → /book/:slug/confirmed/:bookingId
```

---

### Step 1 — Load event details

When the `PublicBookingPage` component mounts, it reads `:slug` from the URL and calls `GET /api/public/event-types/{slug}`.

The response includes the event title, description, duration, accent colour, and the admin's timezone. If the slug does not exist, the API returns 404 and the page renders an error message.

---

### Step 2 — Pick a date

A horizontal row of 10 date buttons is rendered, starting from today. These are generated entirely on the client using `getUpcomingDates(10)` from `src/utils/date.js`. No API call is made at this step.

Clicking a date selects it and triggers step 3.

---

### Step 3 — Fetch time slots

With a date selected, the page calls `GET /api/public/event-types/{slug}/slots?date=YYYY-MM-DD`.

The backend's `generate_slots()` function:

1. Looks up the `AvailabilityRule` for the day of week.
2. Returns an empty list if the day is inactive or the date is blocked out.
3. Builds a list of slot windows within the working hours.
4. Filters out past slots and slots already occupied by confirmed bookings.
5. Returns the remaining slots with a `display_time` in the admin's timezone.

The page renders the available slots as a grid of buttons. If the list is empty, a "No slots available" message is shown.

---

### Step 4 — Fill in visitor details

After selecting a slot, the form fields (name, email, notes) appear. Validation runs on blur (when the user leaves a field). The form cannot be submitted unless name and email are filled in and the email is syntactically valid.

---

### Step 5 — Request an OTP

The visitor clicks "Send code". The page calls `POST /api/public/otp/request` with the email address.

The backend:
1. Checks rate limiting — if a code was issued for this email within the last 60 seconds, returns 429 with `retry_after`.
2. Generates a 6-digit number using `random.randint(100000, 999999)`.
3. Hashes it with SHA-256 and stores the hash in `email_otps`.
4. Sends the code via SMTP (synchronously — the user is waiting).
5. Returns `{ expires_in, retry_after }`.

The UI switches to a code input field and shows a 60-second countdown. The "Resend code" button is disabled until the countdown reaches zero.

---

### Step 6 — Verify the OTP

The visitor enters the 6-digit code and clicks "Verify". The page calls `POST /api/public/otp/verify` with the email and code.

The backend:
1. Looks up the most recent active OTP for the email.
2. Increments the attempt counter. If attempts exceed `OTP_MAX_ATTEMPTS` (default 5), burns the code and returns 400.
3. Hashes the submitted code and compares it to the stored hash.
4. If correct: marks the OTP as used, creates a `VerificationToken`, and returns the token string.
5. If incorrect: saves the incremented attempt count, returns 400 with remaining attempts.

The UI shows a green checkmark and the verification token is stored in component state.

---

### Step 7 — Confirm the booking

With the token stored, the visitor clicks "Book". The page calls `POST /api/public/event-types/{slug}/book` with:

```json
{
  "booker_name": "...",
  "booker_email": "...",
  "notes": "...",
  "start_time": "...",
  "verification_token": "..."
}
```

The backend:
1. Calls `consume_verification_token()` — validates the token, marks it consumed. Raises 400 if invalid/expired.
2. Confirms the email on the token matches `booker_email`. Raises 400 if not.
3. Calls `generate_slots()` for the requested date and confirms `start_time` is still available. Raises 400 if the slot is gone.
4. Generates a Jitsi meeting URL: `https://meet.jit.si/{slug}-{uuid4}`.
5. Inserts the `Booking` row. If Postgres raises `IntegrityError` (race condition double-book), returns 409.
6. Queues a confirmation email to the booker (background task).
7. Returns the created booking.

The frontend navigates to `/book/:slug/confirmed/:bookingId`.

---

### Confirmation page

`ConfirmationPage` mounts and calls `GET /api/public/bookings/{id}` to fetch the booking details. It displays:

- Event title, date, time in the admin's timezone, duration.
- A "Join video call" button linking to the Jitsi URL.
- Links to book again or visit the admin dashboard.

---

## Admin — event type management

### Creating an event type

1. Admin fills in the form on the Dashboard page (title, description, duration, slug, colour).
2. Real-time validation runs on blur — the slug field checks the pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$`.
3. On submit, the page calls `POST /api/event-types`.
4. The server validates the payload, checks slug uniqueness, creates the row.
5. On success, the new event type is prepended to the local `eventTypes` array and a success toast is shown.
6. On 409, a "Slug already taken" error appears under the slug field.

### Editing an event type

1. Admin clicks "Edit" on an event type card.
2. The form is populated with the existing values and `editingId` is set.
3. Admin modifies fields and clicks "Save changes".
4. The page calls `PUT /api/event-types/{id}`.
5. On success, the item is updated in the local array and `editingId` is reset.

### Deleting an event type

1. Admin clicks "Delete".
2. A confirmation dialog (browser `confirm()`) is shown.
3. If confirmed, the page calls `DELETE /api/event-types/{id}`.
4. The server: finds upcoming confirmed bookings, enqueues cancellation emails to all bookers, deletes the event type (cascades to bookings).
5. The item is removed from the local array.

---

## Admin — availability management

### Setting weekly hours

1. Admin visits `/availability`.
2. The page fetches `GET /api/availability` and populates 7 day rows.
3. Admin toggles days on/off and adjusts start/end times.
4. Admin selects a timezone from the dropdown.
5. Admin clicks "Save availability".
6. The page calls `PUT /api/availability` with the full schedule.
7. The server deletes all existing rules and inserts the new set atomically.
8. A success toast is shown.

### Adding a blockout date

1. Admin picks a date from the date picker and optionally enters a reason.
2. Clicks "Add blockout date".
3. The page calls `POST /api/blockouts`.
4. The new date is added to the local list.

### Removing a blockout date

1. Admin clicks the delete button next to a date.
2. The page calls `DELETE /api/blockouts/{date}`.
3. The date is removed from the local list.

---

## Admin — bookings management

### Viewing bookings

1. Admin visits `/bookings`.
2. The page loads with `scope=upcoming` by default, calling `GET /api/bookings?scope=upcoming`.
3. Admin can switch to "Past" or "All" tabs, each triggering a new fetch.

### Cancelling a booking

1. Admin clicks "Cancel" on a booking card.
2. The page calls `POST /api/bookings/{id}/cancel`.
3. The server sets `status = "cancelled"` and enqueues a cancellation email.
4. The booking is removed from the list (if on the "upcoming" tab) or updated in place.

### Rescheduling a booking

1. Admin clicks "Reschedule" on a booking card.
2. The `RescheduleModal` opens, showing a date strip and a slot grid.
3. Admin picks a new date — the modal fetches available slots via `GET /api/public/event-types/{slug}/slots?date=...`.
4. Admin picks a slot and clicks "Confirm reschedule".
5. The modal calls `POST /api/bookings/{id}/reschedule` with `{ "start_time": "..." }`.
6. The server re-validates the slot, updates `start_time` and `end_time`, enqueues a reschedule email.
7. The modal closes and the booking is updated in the list.

---

## Email lifecycle

Every email is sent via SMTP. If SMTP is not configured, emails are logged to stdout and skipped.

| Trigger | Recipient | Subject | Delivery |
|---|---|---|---|
| OTP requested | Visitor | "Your verification code" | Synchronous (user is waiting) |
| Booking confirmed | Visitor | "Your booking is confirmed" | Background task |
| Booking rescheduled | Visitor | "Your booking has been rescheduled" | Background task |
| Booking cancelled | Visitor | "Your booking has been cancelled" | Background task |
| Event type deleted | All upcoming bookers | "Your booking has been cancelled" | Background tasks (one per booking) |

---

## Cold-start detection

When the backend is hosted on a free tier (e.g. Render free plan), it may go to sleep after inactivity and take up to 60 seconds to wake up.

The `request()` function in `api.js` starts a 4-second timer on every call. If no response arrives within 4 seconds, it dispatches a `"api-slow"` custom event on `window`. `App.jsx` catches this and shows a persistent toast: "Waking up the server, this might take up to a minute...".

When any response arrives (success or error), the function dispatches `"api-fast"`. `App.jsx` catches this, dismisses the slow toast, and shows a success toast: "Server is awake and ready!".

This means the toast appears on the very first slow request regardless of which page the user is on, and disappears as soon as the server responds.

---

## Double-booking prevention

Two mechanisms work together to prevent two visitors from booking the same slot simultaneously.

**Application layer:** `generate_slots()` queries the database for existing confirmed bookings before generating the slot list. The booking endpoint re-runs `generate_slots()` at booking time to verify the slot is still available.

**Database layer (PostgreSQL only):** A partial unique index on `(event_type_id, start_time) WHERE status = 'confirmed'` means the database will raise an `IntegrityError` if two transactions race to insert the same confirmed slot. The booking endpoint catches this and returns 409 "That slot was just booked."

On SQLite (local dev), only the application-layer check applies. The database constraint is not enforced locally.

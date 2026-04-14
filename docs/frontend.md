# Frontend

The frontend is a React 19 single-page application built with Vite. It has no CSS framework or state management library — everything runs on React hooks, the Context API, and plain CSS with custom properties.

---

## Entry point

### `src/main.jsx`

Mounts the React tree into `#root` in `index.html`. Wraps the whole app in two providers:

- **`ThemeProvider`** — supplies the current theme (`light` or `dark`) and a toggle function to the whole tree via React Context.
- **`ToastProvider`** — supplies the toast queue and `useToast()` hook to the whole tree.

```jsx
// Simplified structure
<ThemeProvider>
  <ToastProvider>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </ToastProvider>
</ThemeProvider>
```

---

## App shell

### `src/App.jsx`

**Responsibilities:**

1. **Defines the route tree** using React Router's `<Routes>` and `<Route>`.
2. **Renders `AdminLayout`** for the three admin pages and bare (layout-less) wrappers for the two public pages.
3. **Cold-start detection** — listens for `"api-slow"` and `"api-fast"` window events dispatched by `api.js`, and shows / dismisses a persistent toast accordingly.

#### `AdminLayout` component (defined inside `App.jsx`)

A presentational layout component that renders the sidebar and the page content area side by side.

Props:

| Prop | Type | Purpose |
|---|---|---|
| `children` | ReactNode | The page content rendered inside the main area |
| `title` | string | Large heading shown in the page header |
| `subtitle` | string | Smaller eyebrow text above the heading |

The sidebar contains:

- **Brand block** — "Let's Book up" title with a 👀 emoji badge.
- **Nav links** — three `<NavLink>` items: Event Types (`/`), Availability (`/availability`), Bookings (`/bookings`). Active link gets an `active` class that highlights it visually.
- **Public demo card** — brief note that booking links come from event type slugs.
- **Sidebar footer** — "Appearance" label and the `<ThemeToggle>` button.

The header area (top of the main content) shows the page title, subtitle, and a "Default user is signed in" pill.

---

## Pages

### `DashboardPage` (`src/pages/DashboardPage.jsx`)

**Route:** `/`

This page has two responsibilities: managing event types and showing dashboard statistics.

#### State

| State variable | Purpose |
|---|---|
| `eventTypes` | Array of event type objects fetched from the API |
| `loading` | True while the initial fetch is in progress |
| `stats` | Object with `{ event_types, upcoming_bookings, past_bookings }` |
| `form` | Object holding the current values of the create/edit form fields |
| `editingId` | `null` when creating; an integer ID when editing an existing event type |
| `submitting` | True while a create or update request is in-flight |
| `deletingId` | The ID of the event type currently being deleted, or `null` |
| `errors` | Object with per-field validation errors |
| `touched` | Object tracking which fields the user has interacted with |

#### Features

**Statistics bar** — Three stat cards at the top of the page:
- Total event types
- Upcoming bookings (today and later)
- Past bookings

**Event type form** — A create/edit form with:
- `title` — free text, max 120 characters, required.
- `description` — textarea, optional.
- `duration` — select with options: 15, 30, 45, 60, 90, 120, 180, 240 minutes.
- `url_slug` — text input. Must match `^[a-z0-9]+(?:-[a-z0-9]+)*$` (lowercase letters, numbers, hyphens). The slug becomes the public URL path. Validated client-side and server-side.
- `accent_color` — a row of 9 colour swatches the user clicks to select. Stored as a hex string.

When `editingId` is set, the form is pre-populated and the submit button reads "Save changes". Clicking "Cancel" resets `editingId` to `null` and clears the form.

**Event type list** — Each event type card shows:
- Accent colour bar on the left edge.
- Title and description.
- Duration badge.
- Public booking link (e.g. `/book/my-meeting`) — clicking it opens the link in a new tab.
- "Edit" and "Delete" buttons.

Deleting sets `deletingId` while the request is in flight, then removes the item from the list on success.

---

### `AvailabilityPage` (`src/pages/AvailabilityPage.jsx`)

**Route:** `/availability`

Manages two separate data sets: the weekly availability schedule and the list of blockout dates.

#### Availability schedule

The schedule is a list of 7 rules — one per day of the week (Monday through Sunday). Each rule has:

| Field | Description |
|---|---|
| `is_active` | Toggle — whether the admin is available on this day |
| `start_time` | Start of working hours (HH:MM) |
| `end_time` | End of working hours (HH:MM) |

A timezone selector at the top of the section lets the admin pick any IANA timezone (e.g. `Asia/Kolkata`, `America/New_York`). The list is populated from the browser's `Intl` API.

Clicking "Save availability" sends a `PUT /api/availability` request with the full schedule (timezone + all 7 rules). The entire schedule is replaced atomically — there is no partial update.

#### Blockout dates

A separate section lists dates on which no bookings can be made (holidays, vacation days, etc.).

- **Add a date:** pick a date from the date picker, optionally add a reason label, click "Add blockout date".
- **Remove a date:** click the delete button next to any entry in the list.

Each blockout date record contains:

| Field | Description |
|---|---|
| `date` | The blocked date in `YYYY-MM-DD` format |
| `reason` | Optional human-readable label (e.g. "National holiday") |

---

### `BookingsPage` (`src/pages/BookingsPage.jsx`)

**Route:** `/bookings`

Displays all bookings and lets the admin reschedule or cancel them.

#### Filters

Three tab-style buttons at the top filter the list:

| Scope | What is shown |
|---|---|
| `upcoming` | Bookings with `start_time >= now`, `status = confirmed` |
| `past` | Bookings with `start_time < now` |
| `all` | Every booking regardless of time or status |

Changing the scope sends a new `GET /api/bookings?scope=...` request.

#### Booking card

Each booking shows:

- Accent colour bar (from the associated event type).
- Booker name and email.
- Event type title.
- Formatted start time (day, date, time in the admin's timezone).
- Duration.
- Status badge (`confirmed` or `cancelled`).
- Video call link button (opens the Jitsi URL in a new tab).
- "Reschedule" and "Cancel" action buttons (only shown for confirmed bookings).

#### Reschedule modal

Clicking "Reschedule" opens a modal that reuses the same date + time slot UI as the public booking page:

1. The admin picks a new date from a 10-day date strip.
2. The available slots for that date are fetched from `/api/public/event-types/{slug}/slots?date=...`.
3. The admin picks a slot and clicks "Confirm reschedule".
4. A `POST /api/bookings/{id}/reschedule` request is sent with the new `start_time`.
5. A reschedule notification email is sent to the booker in the background.

#### Cancel action

Clicking "Cancel" sends `POST /api/bookings/{id}/cancel`. The booking's `status` is set to `cancelled` and a cancellation email is sent to the booker.

---

### `PublicBookingPage` (`src/pages/PublicBookingPage.jsx`)

**Route:** `/book/:slug`

The page a visitor uses to book a meeting. No authentication required.

#### Loading phase

When the page mounts, it fetches the event type details for `:slug` via `GET /api/public/event-types/{slug}`. If the slug does not exist, the API returns 404 and the page shows an error state.

#### Step 1 — Date selection

A horizontal strip of 10 upcoming dates is displayed. Today is the first option. Clicking a date:

1. Marks it as selected.
2. Fetches available time slots for that date via `GET /api/public/event-types/{slug}/slots?date=YYYY-MM-DD`.

#### Step 2 — Time slot selection

The fetched slots appear as a grid of time buttons. Each slot shows a 12-hour display time (e.g. `2:30 PM`). Clicking a slot marks it as selected.

#### Step 3 — Visitor details form

A form collects:

| Field | Validation |
|---|---|
| Name | Required |
| Email | Required, must be a valid email address |
| Notes | Optional — any additional context the visitor wants to share |

#### Step 4 — OTP email verification

Once the form is filled, the visitor clicks "Send code". This:

1. Calls `POST /api/public/otp/request` with the email address.
2. The server generates a 6-digit code, stores a hash in the `email_otps` table, and emails the code.
3. The UI switches to a code input field and a "Verify" button.
4. A resend countdown timer counts down from 60 seconds (matching `OTP_RATE_LIMIT_SECONDS`).

The visitor enters the 6-digit code and clicks "Verify". This calls `POST /api/public/otp/verify`, which returns a `verification_token` on success.

#### Step 5 — Booking creation

With the verification token in hand, the page calls `POST /api/public/event-types/{slug}/book` with:

```json
{
  "booker_name": "...",
  "booker_email": "...",
  "notes": "...",
  "start_time": "2024-06-15T14:30:00",
  "verification_token": "abc123..."
}
```

On success the visitor is navigated to `/book/:slug/confirmed/:bookingId`.

#### OTP state machine

The OTP UI has three states:

| State | Description |
|---|---|
| `idle` | "Send code" button visible |
| `sent` | Code input and "Verify" button visible; resend countdown active |
| `verified` | Green checkmark shown; verification token stored in component state |

---

### `ConfirmationPage` (`src/pages/ConfirmationPage.jsx`)

**Route:** `/book/:slug/confirmed/:bookingId`

Fetches the booking details via `GET /api/public/bookings/:bookingId` and displays:

- Large success icon.
- Booking details: event type title, date, time, timezone, duration.
- Booker name.
- A "Join video call" button that opens the Jitsi meeting URL.
- A "Book another" link back to the event page.
- A "Go to dashboard" link (back to `/`).

---

## Components

### `ThemeContext` (`src/components/ThemeContext.jsx`)

A React Context that provides theme state to the whole application.

**Context value:**

| Property | Type | Description |
|---|---|---|
| `theme` | `"light"` \| `"dark"` | Current theme name |
| `toggleTheme` | function | Switches between light and dark |

**Implementation details:**

- Initial theme is read from `localStorage.getItem("theme")`, defaulting to `"light"` if not set.
- On every theme change, the value is persisted to `localStorage`.
- The `data-theme` attribute on `<html>` is set to the current theme string, which CSS custom properties use to switch colour palettes.

**Usage:**

```jsx
import { useTheme } from "./components/ThemeContext";

function MyComponent() {
  const { theme, toggleTheme } = useTheme();
}
```

---

### `ThemeToggle` (`src/components/ThemeToggle.jsx`)

A button that calls `toggleTheme()` from `ThemeContext`. Renders a sun icon in dark mode and a moon icon in light mode (or similar — exact icons are emoji/SVG in the source). Appears in the admin sidebar footer and on the public booking page.

---

### `Toast` (`src/components/Toast.jsx`)

A context-based notification system. Provides a queue of toast messages rendered in a fixed overlay at the bottom of the screen.

**`ToastProvider`** — Wrap the app with this to enable toasts everywhere.

**`useToast()` hook** — Returns an object with:

| Method | Signature | Description |
|---|---|---|
| `success` | `(message, options?) => id` | Show a green success toast |
| `error` | `(message, options?) => id` | Show a red error toast |
| `info` | `(message, options?) => id` | Show a neutral info toast |
| `dismiss` | `(id) => void` | Dismiss a specific toast by ID |

**Options:**

| Option | Type | Default | Description |
|---|---|---|---|
| `duration` | number (ms) | 4000 | Auto-dismiss after this many milliseconds. Pass a large value (e.g. 60000) for a persistent toast. |

Each toast has an `×` button for manual dismissal.

---

### `SectionCard` (`src/components/SectionCard.jsx`)

A simple presentational wrapper that renders a white (or dark-mode-equivalent) card with a title and optional subtitle. Used by admin pages to visually separate distinct sections on the same page.

Props:

| Prop | Type | Description |
|---|---|---|
| `title` | string | Section heading |
| `subtitle` | string (optional) | Descriptive text below the heading |
| `children` | ReactNode | Section content |

---

### `EmptyState` (`src/components/EmptyState.jsx`)

A centered placeholder displayed when a list has no items. Shows an icon, a heading, and a supporting description.

Props:

| Prop | Type | Description |
|---|---|---|
| `icon` | string | Emoji or character to display large |
| `title` | string | Short heading (e.g. "No bookings yet") |
| `description` | string | Supporting text |

---

### `Skeleton` (`src/components/Skeleton.jsx`)

Loading placeholder components that appear while data is being fetched. Prevents layout shift and communicates that content is loading.

Exported components:

| Component | Usage |
|---|---|
| `SkeletonList` | Renders N skeleton rows (suitable for a list of items) |
| `SkeletonCard` | Renders a single card-shaped skeleton |
| `SkeletonStats` | Renders 3 side-by-side skeleton stat blocks |

All skeletons use a CSS shimmer animation defined in `index.css`.

---

## Services

### `src/services/api.js`

All HTTP communication with the backend lives here. It exports a single `api` object whose methods map one-to-one to backend endpoints.

#### `request(path, options)` (internal)

The base fetch wrapper used by all API methods.

- Prepends `API_BASE` (`VITE_API_URL` env var, defaulting to the production backend URL) to `path`.
- Sets `Content-Type: application/json` on every request.
- Starts a 4-second timeout. If no response arrives, dispatches `window.dispatchEvent(new CustomEvent("api-slow"))` to trigger the "Waking up server" toast in `App.jsx`.
- On any response (success or error), clears the timeout and dispatches `"api-fast"`.
- Throws an `Error` with the `detail` field from the JSON body if the response status is not OK.
- Returns `null` for 204 No Content responses.
- Otherwise returns the parsed JSON body.

#### `api` object methods

| Method | HTTP call | Description |
|---|---|---|
| `getSummary()` | `GET /api/summary` | Dashboard stats |
| `getEventTypes()` | `GET /api/event-types` | List all event types |
| `createEventType(payload)` | `POST /api/event-types` | Create a new event type |
| `updateEventType(id, payload)` | `PUT /api/event-types/{id}` | Update an event type |
| `deleteEventType(id)` | `DELETE /api/event-types/{id}` | Delete an event type |
| `getAvailability()` | `GET /api/availability` | Get weekly schedule |
| `updateAvailability(payload)` | `PUT /api/availability` | Replace weekly schedule |
| `getBookings(scope)` | `GET /api/bookings?scope={scope}` | List bookings by scope |
| `cancelBooking(id)` | `POST /api/bookings/{id}/cancel` | Cancel a booking |
| `rescheduleBooking(id, payload)` | `POST /api/bookings/{id}/reschedule` | Reschedule a booking |
| `getBlockouts()` | `GET /api/blockouts` | List blockout dates |
| `createBlockout(payload)` | `POST /api/blockouts` | Add a blockout date |
| `deleteBlockout(date)` | `DELETE /api/blockouts/{date}` | Remove a blockout date |
| `getPublicEventType(slug)` | `GET /api/public/event-types/{slug}` | Public event details |
| `getSlots(slug, date)` | `GET /api/public/event-types/{slug}/slots?date={date}` | Available slots for a date |
| `createBooking(slug, payload)` | `POST /api/public/event-types/{slug}/book` | Create a booking |
| `getPublicBooking(id)` | `GET /api/public/bookings/{id}` | Booking details for confirmation page |
| `requestOtp(email)` | `POST /api/public/otp/request` | Send OTP to email |
| `verifyOtp(email, code)` | `POST /api/public/otp/verify` | Verify OTP code |

---

## Utilities

### `src/utils/date.js`

Helper functions for date/time formatting used across multiple pages.

| Function | Description |
|---|---|
| `formatDate(isoString, timezone)` | Formats a UTC ISO string into a human-readable date in the given timezone (e.g. "Monday, 15 June 2024") |
| `formatTime(isoString, timezone)` | Formats a UTC ISO string into a 12-hour time string in the given timezone (e.g. "2:30 PM") |
| `formatDateTime(isoString, timezone)` | Combines date and time into a single string |
| `getTodayDateString()` | Returns today's date as `YYYY-MM-DD` in local time |
| `getUpcomingDates(n)` | Returns an array of `n` date strings starting from today |

---

## Styling

### `src/index.css`

The single global stylesheet. Uses CSS custom properties (variables) to implement the light and dark themes. Theme switching works by setting `data-theme="dark"` on the `<html>` element — the CSS selects `:root[data-theme="dark"]` to override the variables.

Key variable groups:

| Variable group | Purpose |
|---|---|
| `--color-bg-*` | Page and card background colours |
| `--color-text-*` | Primary, secondary, and muted text colours |
| `--color-border` | Border colour for cards and inputs |
| `--color-accent` | Primary brand accent (used for buttons and links) |
| `--color-success / error / info` | Toast and status badge colours |
| `--radius-*` | Border radius values for cards, buttons, badges |
| `--shadow-*` | Box shadow definitions |

Layout is built with CSS Grid and Flexbox. The `.app-shell` is a two-column grid (`sidebar` + `.page-area`). Each page area uses vertical flexbox stacking of `SectionCard` components.

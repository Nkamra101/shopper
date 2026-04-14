# Shopper Scheduler — Documentation

Shopper Scheduler is a full-stack scheduling application similar to Cal.com. It lets an admin define event types and weekly availability, and lets anyone on the internet book a meeting through a public link — verified via email OTP — with video call links generated automatically.

---

## Documentation Index

| File | What it covers |
|---|---|
| [architecture.md](./architecture.md) | Tech stack, folder structure, design decisions |
| [frontend.md](./frontend.md) | Every page, component, hook, and utility in the React app |
| [backend.md](./backend.md) | Database models, Pydantic schemas, routers, and service layer |
| [api-reference.md](./api-reference.md) | Every endpoint — method, path, request body, response shape, errors |
| [flows.md](./flows.md) | End-to-end user journeys: booking flow, admin flows, email lifecycle |
| [configuration.md](./configuration.md) | Every environment variable for both frontend and backend |
| [deployment.md](./deployment.md) | Step-by-step guides for Koyeb, Render, Railway, Netlify, and Vercel |

---

## Quick-start (local development)

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate          # Linux / macOS
.venv\Scripts\activate             # Windows
pip install -r requirements.txt
cp .env.example .env               # edit as needed
uvicorn app.main:app --reload
```

The API runs at `http://127.0.0.1:8000`.  
Interactive Swagger UI: `http://127.0.0.1:8000/docs`  
Health check: `http://127.0.0.1:8000/health`

No `DATABASE_URL` → SQLite file created automatically (`backend/shopper.db`).  
No SMTP vars → emails are logged to stdout; OTP requests return 503.

### Frontend

```bash
cd frontend
npm install
cp .env.example .env               # set VITE_API_URL=http://127.0.0.1:8000
npm run dev
```

App runs at `http://localhost:5173`.

### Testing the public booking page

Once both servers are running:

1. Go to `http://localhost:5173` and create an event type with any slug, e.g. `my-meeting`.
2. Open `http://localhost:5173/book/my-meeting` in a new tab.
3. Pick a date, pick a time, fill in your details, and complete the OTP flow.

---

## High-level feature summary

| Feature | Admin or Public | Notes |
|---|---|---|
| Create / edit / delete event types | Admin | Title, description, duration, slug, accent color |
| Weekly availability rules | Admin | Per-day start/end times; enable/disable per day |
| Timezone selection | Admin | Single global timezone used for all slots |
| Blockout dates | Admin | Vacation / holidays; blocks all slots on a date |
| Bookings dashboard | Admin | Upcoming / past / all; reschedule or cancel any booking |
| Public event page | Public | Accessible at `/book/:slug` |
| Date + time slot picker | Public | Respects availability, blockouts, existing bookings |
| Email OTP verification | Public | 6-digit code emailed; required before confirming |
| Booking confirmation | Public | Confirmation page with Jitsi video call link |
| Transactional emails | System | Sent for OTP, confirmed, rescheduled, cancelled events |
| Light / dark theme | Both | Persisted to localStorage |
| Cold-start detection | Both | Toast notification if API takes > 4 s to respond |

# Shopper: Complete System Documentation

**Shopper** is a full-stack, comprehensive scheduling and booking platform. Designed as a modern alternative to tools like Calendly or Cal.com, it provides a unified interface for professionals to manage their availability, offer public booking pages, and automate the booking lifecycle.

---

## 1. System Overview

Shopper is split into two primary decoupled applications:
1. **Frontend (React + Vite)**: A highly interactive Single Page Application (SPA) offering an administrative dashboard and public-facing booking flows.
2. **Backend (FastAPI + MongoDB)**: A high-performance, asynchronous REST API handling business logic, data persistence, email transactions, and 3rd-party integrations.

---

## 2. Core Features & Capabilities

- **Event Type Management**: Create multiple meeting types (e.g., 15m Sync, 45m Interview) with custom durations, unique URL slugs, and specific configurations.
- **Dynamic Availability**: Define weekly working hours and timezone rules. The system automatically computes available slots dynamically.
- **Blockouts**: Manually block off specific dates or time ranges where bookings should be restricted.
- **Public Booking Portal**: A clean, public-facing interface where invitees can select time slots based on the host's real-time availability.
- **Booking Lifecycle**: Dashboard for hosts to view, reschedule, or cancel upcoming and past bookings.
- **OTP Verification**: Built-in email One-Time Password (OTP) verification for invitees to prevent spam and verify identity before confirming a booking.
- **Transactional Emails**: Automated background tasks to send confirmation, rescheduling, and cancellation emails.
- **Workflows & Automations**: Configure automated reminders and follow-up notifications.
- **Integrations**: Supports connecting to 3rd-party services (like Google Calendar) via OAuth.
- **Analytics**: Visual dashboard showing booking performance, conversion metrics, and popular time slots.

---

## 3. System Architecture

### Frontend Architecture
- **Framework**: React 19 + Vite
- **Routing**: `react-router-dom` (v7) for client-side routing.
- **State Management**: React Context (`AuthContext` for user state) and local component state.
- **Styling**: Custom CSS architecture (`index.css`) utilizing CSS variables for robust Dark/Light theme switching.
- **Structure**: 
  - `/pages`: Contains all route-level components.
  - `/components`: Reusable UI elements (Toasts, Navigation, Theme toggles).
  - `/services`: API wrapper functions handling JWT tokens and requests.

### Backend Architecture
- **Framework**: FastAPI (Python)
- **Database**: MongoDB (via `motor` asynchronous driver)
- **Authentication**: JWT-based authentication combined with Google OAuth capabilities.
- **Task Queue**: FastAPI's `BackgroundTasks` for asynchronous email delivery to ensure low-latency API responses.
- **Structure**:
  - `/app/routers`: Modularized endpoints (`auth`, `bookings`, `event_types`, `public`, `otp`, `integrations`, `workflows`, `calendar`, `availability`, `blockouts`).
  - `/app/models`: MongoDB schema definitions and Pydantic validation models.
  - `/app/config.py`: Centralized environment-based configuration.
  - `/app/seed.py`: Automated database seeding for fresh deployments.

---

## 4. Domain Model & Key Entities

- **Users (`users`)**: The hosts using the platform. Contains profile info, timezone preferences, and auth credentials.
- **Event Types (`event_types`)**: Templates for meetings. Contains title, description, duration (in minutes), and a unique URL `slug`.
- **Availability (`availability`)**: The weekly schedule template (e.g., Mon-Fri, 9AM-5PM).
- **Blockouts (`blockouts`)**: Specific date/time exceptions that override standard availability.
- **Bookings (`bookings`)**: The actual scheduled events. Contains references to the event type, invitee details, start/end times in naive UTC, and current `status` (confirmed, canceled, rescheduled).
- **Workflows (`workflows`)**: Rules for automated actions (e.g., "Send email 24h before meeting").
- **Integrations (`integrations`)**: Stored OAuth tokens and metadata for connected services.

---

## 5. Core Application Workflows

### The Booking Flow
1. **Slot Generation**: When an invitee visits a public booking page (`/book/:slug`), the frontend requests available slots for a specific month/date. The backend calculates slots by overlaying the `event_types` duration onto the host's `availability`, subtracting existing `bookings` and `blockouts`, and converting everything relative to the host's timezone.
2. **OTP Request**: Before finalizing the booking, the invitee submits their email. The backend generates a 6-digit OTP, saves it with a TTL (Time-To-Live) in the database, and emails it asynchronously via SMTP.
3. **OTP Verification**: Invitee enters the OTP. If valid, the backend issues a short-lived `verification_token`.
4. **Confirmation**: The frontend submits the final booking payload alongside the `verification_token`. A `booking` record is created, and confirmation emails are dispatched to both the host and the invitee.

### Authentication Flow
- **Standard Login**: Email/password exchange for a JWT access token.
- **Google OAuth**: Users can sign in via Google. The backend handles the OAuth callback, provisions a user account if necessary, and issues a JWT.

---

## 6. Directory Map (Frontend Pages)

| Page Component | Route | Description |
| :--- | :--- | :--- |
| `LandingPage` | `/` | Marketing/Splash page for unauthenticated users. |
| `LoginPage` | `/login` | Email/Password and OAuth login interface. |
| `DashboardPage` | `/dashboard` | Main admin view; lists and manages Event Types. |
| `AvailabilityPage` | `/availability` | Interactive weekly schedule configuration. |
| `BookingsPage` | `/bookings` | Timeline of upcoming, past, and canceled meetings. |
| `AnalyticsPage` | `/analytics` | Charts and data insights on booking frequency. |
| `IntegrationsPage` | `/integrations` | UI for connecting 3rd-party calendars and tools. |
| `WorkflowsPage` | `/workflows` | Manage automated reminders and notifications. |
| `ProfilePage` | `/profile` | User settings, branding, and account management. |
| `PublicBookingPage` | `/book/:slug` | The public-facing interface where invitees pick slots. |
| `ConfirmationPage`| `/book/:slug/confirmed/:id`| Success screen after a booking is finalized. |

---

## 7. Setup & Configuration

### Prerequisites
- Python 3.10+
- Node.js 18+
- MongoDB (Local instance or MongoDB Atlas cluster)

### Environment Variables (Backend)
Create a `.env` file in the `backend/` directory:

```ini
APP_ENV=development
DEBUG=true
MONGODB_URI=mongodb://localhost:27017
CORS_ORIGINS=http://localhost:5173
DEFAULT_TIMEZONE=Asia/Kolkata
SEED_ON_STARTUP=true

# Email Settings (Required for OTP & Notifications)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM_NAME="Shopper Scheduler"

# JWT Authentication
SECRET_KEY=generate_a_secure_random_string
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# Google OAuth (Optional)
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
FRONTEND_URL=http://localhost:5173
```

### Running Locally

**Terminal 1 (Backend):**
```bash
cd backend
python -m venv .venv
.venv\Scripts\activate on Windows
pip install -r requirements.txt
uvicorn app.main:app --reload
```

**Terminal 2 (Frontend):**
```bash
cd frontend
npm install
# Ensure .env contains VITE_API_URL=http://127.0.0.1:8000
npm run dev
```

---

## 8. Deployment Strategy

### Database
Provision a **MongoDB Atlas M0 Free Cluster**. Ensure the Network Access IP whitelist is set to `0.0.0.0/0` if deploying on dynamic platforms like Koyeb or Render.

### Backend (Koyeb / Render / Railway)
The backend is stateless (aside from the DB) and can be deployed easily via Docker or Native Python environments.
- **Build Command**: `pip install -r requirements.txt`
- **Run Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- **Secrets**: Provide `MONGODB_URI`, `SECRET_KEY`, and `SMTP_*` variables in the deployment dashboard.

### Frontend (Vercel / Netlify)
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Variables**: Set `VITE_API_URL` to the public URL of your deployed backend.

*Note: After deploying the frontend, make sure to add the frontend's public URL to the backend's `CORS_ORIGINS` variable.*

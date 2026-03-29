# Shopper Scheduler

A beginner-to-moderate fullstack scheduling app inspired by the Cal.com assignment brief. It includes:

- React frontend for event types, availability, bookings dashboard, public booking, and confirmation
- FastAPI backend with REST endpoints
- SQLAlchemy models with MySQL-ready configuration
- Seeded sample event types and bookings

## Tech Stack

- Frontend: React + Vite + React Router
- Backend: Python + FastAPI + SQLAlchemy
- Database: MySQL preferred through `DATABASE_URL`, with SQLite fallback for quick local setup

## Project Structure

- `frontend` - React application
- `backend` - FastAPI application

## Setup

### 1. Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload
```

By default, the app can run with SQLite if `DATABASE_URL` is not set. For MySQL, update `.env`:

```env
DATABASE_URL=mysql+pymysql://root:password@localhost:3306/shopper_clone
```

### 2. Frontend

```bash
cd frontend
npm install
copy .env.example .env
npm run dev
```

## Default URLs

- Frontend: `http://localhost:5173`
- Backend: `http://127.0.0.1:8000`
- API docs: `http://127.0.0.1:8000/docs`

## Features Covered

- Create, edit, delete, and list event types
- Weekly availability with timezone selection
- Public booking page with date and slot selection
- Double-booking prevention
- Booking confirmation page
- Upcoming/past bookings dashboard
- Cancel a booking
- Seeded demo data
- Responsive layout for desktop and mobile

## Assumptions

- There is one default logged-in admin user, as mentioned in the assignment
- Event duration also controls slot interval length
- One main weekly availability schedule is enough for the required version
- Email notifications and rescheduling are not included in this first version

## Notes

- The visual style is inspired by Cal.com patterns, but intentionally kept simpler so it feels achievable for an intern-level assignment.
- If you want to deploy with MySQL, create the database first and point `DATABASE_URL` to it.


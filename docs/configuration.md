# Configuration

---

## Frontend

Frontend configuration is set via environment variables in `frontend/.env`. Vite exposes variables prefixed with `VITE_` to the browser bundle.

### `frontend/.env`

```env
VITE_API_URL=http://127.0.0.1:8000
```

| Variable | Default | Description |
|---|---|---|
| `VITE_API_URL` | `https://shopper-backend-2n4n.onrender.com` | The base URL of the backend API. In development, set this to your local backend. In production, set this to your deployed backend URL. If not set, the app falls back to the production backend URL hardcoded in `api.js`. |

---

## Backend

All backend configuration is read from environment variables at startup. In local development, variables are loaded from `backend/.env` via `python-dotenv`.

Copy `backend/.env.example` to `backend/.env` and edit the values before running the server.

---

### Application

| Variable | Default | Description |
|---|---|---|
| `APP_NAME` | `Shopper Scheduling API` | Display name returned by the root endpoint and used in email subject lines. |
| `APP_ENV` | `development` | Set to `production` when deployed. Affects FastAPI's debug mode and logging verbosity. |
| `DEBUG` | `false` | When `true`, enables FastAPI's debug mode (detailed error pages) and more verbose backend logging. Never enable in production. |

---

### Database

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `sqlite:///./shopper.db` | SQLAlchemy connection string. Supported formats: `postgresql://user:pass@host/db`, `postgres://...` (auto-converted), `sqlite:///./path.db`. If unset, a local SQLite file is created at `backend/shopper.db`. |

**PostgreSQL example:**

```
DATABASE_URL=postgresql://user:password@localhost:5432/shopper
```

**Neon (serverless PostgreSQL) example:**

```
DATABASE_URL=postgresql://user:password@ep-xxx.neon.tech/neondb?sslmode=require
```

The backend automatically handles:
- Renaming `postgres://` to `postgresql://` (required by SQLAlchemy 2).
- `pool_pre_ping=True` to reconnect after Neon's idle-sleep disconnect.

---

### CORS

| Variable | Default | Description |
|---|---|---|
| `CORS_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173,https://shoppernk.netlify.app` | Comma-separated list of frontend origins allowed to call the API. In production, set this to the exact URL of your deployed frontend (no trailing slash). Multiple origins: `https://myapp.netlify.app,https://www.myapp.com`. |

---

### Seeding

| Variable | Default | Description |
|---|---|---|
| `SEED_ON_STARTUP` | `false` | When `true`, the app seeds demo data on startup if the database is empty. Safe to leave on for the first deploy. Set to `false` on subsequent deploys to avoid re-seeding. |

---

### Timezone

| Variable | Default | Description |
|---|---|---|
| `DEFAULT_TIMEZONE` | `Asia/Kolkata` | IANA timezone used for availability and slot display when no timezone has been saved yet. Once the admin saves an availability schedule, the stored timezone takes over. Any valid IANA string works (e.g. `America/New_York`, `Europe/London`, `Asia/Tokyo`). |

---

### SMTP (email)

The app uses plain SMTP to send emails. Gmail with an App Password is the easiest setup.

| Variable | Default | Description |
|---|---|---|
| `SMTP_HOST` | `""` | SMTP server hostname. Example: `smtp.gmail.com`. If empty, all emails are skipped (logged to stdout instead). |
| `SMTP_PORT` | `587` | SMTP port. Use `587` for STARTTLS (recommended for Gmail). Use `465` for SMTPS/SSL. |
| `SMTP_USER` | `""` | SMTP login username, typically your full email address. |
| `SMTP_PASS` | `""` | SMTP password. For Gmail, generate a 16-character **App Password** (not your regular account password). |
| `SMTP_FROM` | `""` | The `From` address in outgoing emails. Defaults to `SMTP_USER` if not set. |
| `SMTP_FROM_NAME` | `Shopper Scheduler` | The display name in the `From` header. Visible to recipients as "Shopper Scheduler <you@gmail.com>". |
| `SMTP_TIMEOUT_SECONDS` | `10` | Timeout for each SMTP connection attempt in seconds. |
| `SMTP_RETRY_COUNT` | `1` | Number of additional retry attempts after an initial SMTP failure. Total attempts = `1 + SMTP_RETRY_COUNT`. |

**Behaviour when SMTP is not configured:**

- `POST /api/public/otp/request` returns **503** ("Email service is not configured") — booking is effectively disabled.
- All other email sends (confirmed, rescheduled, cancelled) are silently skipped and logged.

**Gmail App Password setup:**

1. Enable 2-Step Verification on your Google account.
2. Go to Google Account → Security → App passwords.
3. Create a new app password for "Mail" on "Windows Computer" (or any device label).
4. Copy the 16-character password and use it as `SMTP_PASS`.

---

### OTP and verification token tuning

| Variable | Default | Description |
|---|---|---|
| `OTP_TTL_SECONDS` | `600` | How long a 6-digit code stays valid after being issued. 600 = 10 minutes. The code becomes unusable after this time regardless of how many attempts have been made. |
| `OTP_RATE_LIMIT_SECONDS` | `60` | Minimum gap (in seconds) between OTP requests for the same email address. Prevents spam by ensuring a visitor must wait at least 60 seconds before requesting a new code. |
| `OTP_MAX_ATTEMPTS` | `5` | Number of incorrect code entries allowed before the code is burned (marked used). If the visitor exceeds this, they must request a new code. |
| `VERIFICATION_TOKEN_TTL_SECONDS` | `900` | Lifetime of the token issued after a successful OTP verification. 900 = 15 minutes. The token must be used to create a booking within this window. |

---

## Example `.env` files

### `backend/.env` — minimal local development

```env
APP_ENV=development
DEBUG=true
# No DATABASE_URL → SQLite
# No SMTP → emails logged, OTP disabled
SEED_ON_STARTUP=true
```

### `backend/.env` — local development with email

```env
APP_ENV=development
DEBUG=true
SEED_ON_STARTUP=true
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=you@gmail.com
SMTP_PASS=abcd efgh ijkl mnop
SMTP_FROM=you@gmail.com
SMTP_FROM_NAME=Shopper Local
```

### `backend/.env` — production

```env
APP_ENV=production
DEBUG=false
DATABASE_URL=postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require
CORS_ORIGINS=https://your-frontend.netlify.app
SEED_ON_STARTUP=false
DEFAULT_TIMEZONE=Asia/Kolkata
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=you@gmail.com
SMTP_PASS=abcd efgh ijkl mnop
SMTP_FROM=you@gmail.com
SMTP_FROM_NAME=Shopper Scheduler
OTP_TTL_SECONDS=600
OTP_RATE_LIMIT_SECONDS=60
OTP_MAX_ATTEMPTS=5
VERIFICATION_TOKEN_TTL_SECONDS=900
```

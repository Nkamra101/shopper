# Deployment

The app is split into two independently deployed services:

- **Backend** — FastAPI on any ASGI-compatible host.
- **Frontend** — static React build served by any CDN or static host.

The recommended free-tier stack is **Koyeb + Neon** (backend) and **Netlify** (frontend). No credit card is required for any of these.

---

## General checklist

Before deploying, make sure you have:

- [ ] A PostgreSQL database URL (Neon, Supabase, Render Postgres, Railway Postgres, etc.)
- [ ] SMTP credentials for email delivery (Gmail App Password recommended)
- [ ] The backend URL you will deploy to (needed for `CORS_ORIGINS` and the frontend `VITE_API_URL`)
- [ ] The frontend URL you will deploy to (needed for the backend's `CORS_ORIGINS`)

---

## Backend on Koyeb + Neon (recommended)

Both services have always-on free tiers with no credit card required.

### 1. Create a Neon database

1. Sign up at [neon.tech](https://neon.tech) (GitHub login).
2. Create a new project and choose a region near your users.
3. Copy the connection string from the dashboard. It looks like:
   ```
   postgresql://user:password@ep-xxx.neon.tech/neondb?sslmode=require
   ```
4. Save it — you will need it as `DATABASE_URL`.

### 2. Deploy the backend on Koyeb

1. Sign up at [koyeb.com](https://koyeb.com) (GitHub login).
2. Click **Create Service → GitHub**.
3. Select this repository.
4. Configure the service:

   | Setting | Value |
   |---|---|
   | Work directory | `backend` |
   | Build command | `pip install -r requirements.txt` |
   | Run command | `uvicorn app.main:app --host 0.0.0.0 --port $PORT` |
   | Instance type | Free (Eco) |
   | Port | `8000` HTTP |
   | Health check path | `/health` |

5. Add environment variables:

   | Variable | Value |
   |---|---|
   | `APP_ENV` | `production` |
   | `DEBUG` | `false` |
   | `DATABASE_URL` | Your Neon connection string (mark as Secret) |
   | `CORS_ORIGINS` | `https://your-frontend.netlify.app` |
   | `SEED_ON_STARTUP` | `true` (set to `false` after first deploy) |
   | `DEFAULT_TIMEZONE` | `Asia/Kolkata` (or your timezone) |
   | `SMTP_HOST` | `smtp.gmail.com` |
   | `SMTP_PORT` | `587` |
   | `SMTP_USER` | Your Gmail address |
   | `SMTP_PASS` | Your 16-char App Password (mark as Secret) |
   | `SMTP_FROM` | Your Gmail address |
   | `SMTP_FROM_NAME` | `Shopper Scheduler` |

6. Click **Deploy**.

7. Once live, test the backend:
   - `https://<service>.koyeb.app/health` → `{"status":"ok","db":"ok"}`
   - `https://<service>.koyeb.app/docs` → Swagger UI

---

## Backend on Render

A `render.yaml` file in `backend/` enables infrastructure-as-code deployment. Or set it up manually:

1. Create a **New Web Service** on Render.
2. Connect the repository, set the **Root Directory** to `backend`.
3. Configure:

   | Setting | Value |
   |---|---|
   | Runtime | Python |
   | Build command | `pip install -r requirements.txt` |
   | Start command | `uvicorn app.main:app --host 0.0.0.0 --port $PORT` |
   | Health check path | `/health` |

4. Add environment variables (same as the Koyeb table above).

5. For the database, either:
   - Create a **Render PostgreSQL** instance and use its internal connection string.
   - Paste a Neon or Supabase `DATABASE_URL`.

**Note:** Render's free web service tier sleeps after 15 minutes of inactivity, causing cold starts of up to 60 seconds. The frontend's cold-start toast handles this gracefully. If you need always-on, use Koyeb Eco or upgrade to Render's paid tier.

---

## Backend on Railway

A `Procfile` in `backend/` provides the start command.

1. Create a **New Project → Deploy from GitHub repo**.
2. Set the **Root directory** to `backend`.
3. Railway auto-detects Python and reads the `Procfile`:
   ```
   web: uvicorn app.main:app --host 0.0.0.0 --port $PORT
   ```
4. Add a **PostgreSQL** plugin. Railway injects `DATABASE_URL` automatically.
5. Add the remaining environment variables:
   - `APP_ENV=production`
   - `CORS_ORIGINS=https://your-frontend-domain`
   - SMTP variables.

---

## Frontend on Netlify

1. Connect your GitHub repository to Netlify (or drag-and-drop the `frontend/dist` folder).
2. Configure the build:

   | Setting | Value |
   |---|---|
   | Base directory | `frontend` |
   | Build command | `npm run build` |
   | Publish directory | `frontend/dist` |

3. Add an environment variable:

   | Variable | Value |
   |---|---|
   | `VITE_API_URL` | `https://your-backend.koyeb.app` |

4. Deploy.

5. After deployment, copy the Netlify URL (e.g. `https://your-app.netlify.app`) and add it to the backend's `CORS_ORIGINS` environment variable.

**SPA redirect rule:** React Router uses client-side routing. You need to tell Netlify to serve `index.html` for all paths. Create `frontend/public/_redirects` with:

```
/*  /index.html  200
```

This file is copied to `dist/` by Vite during build.

---

## Frontend on Vercel

1. Import the repository on Vercel.
2. Configure:

   | Setting | Value |
   |---|---|
   | Root directory | `frontend` |
   | Build command | `npm run build` |
   | Output directory | `dist` |

3. Add an environment variable:

   | Variable | Value |
   |---|---|
   | `VITE_API_URL` | `https://your-backend.koyeb.app` |

4. Deploy.

Vercel automatically handles SPA routing (serves `index.html` for unknown paths) when the output is a Vite React app.

---

## Post-deployment steps

1. **Test the health check:** `GET https://your-backend/health` should return `{"status":"ok","db":"ok"}`.
2. **Test the Swagger UI:** `GET https://your-backend/docs` should show the interactive API docs.
3. **Create an event type** on the admin dashboard.
4. **Test a full booking** end-to-end on the public booking page using a real email address.
5. **Disable seeding:** Set `SEED_ON_STARTUP=false` after the first deploy if you do not want demo data on subsequent restarts.

---

## Environment variable summary

| Variable | Backend | Frontend | Required |
|---|---|---|---|
| `APP_ENV` | Yes | — | Recommended |
| `DEBUG` | Yes | — | No |
| `DATABASE_URL` | Yes | — | Yes (production) |
| `CORS_ORIGINS` | Yes | — | Yes (production) |
| `SEED_ON_STARTUP` | Yes | — | No |
| `DEFAULT_TIMEZONE` | Yes | — | No |
| `SMTP_HOST` | Yes | — | Yes (for email) |
| `SMTP_PORT` | Yes | — | No (default 587) |
| `SMTP_USER` | Yes | — | Yes (for email) |
| `SMTP_PASS` | Yes | — | Yes (for email) |
| `SMTP_FROM` | Yes | — | No (defaults to SMTP_USER) |
| `SMTP_FROM_NAME` | Yes | — | No |
| `SMTP_TIMEOUT_SECONDS` | Yes | — | No |
| `SMTP_RETRY_COUNT` | Yes | — | No |
| `OTP_TTL_SECONDS` | Yes | — | No |
| `OTP_RATE_LIMIT_SECONDS` | Yes | — | No |
| `OTP_MAX_ATTEMPTS` | Yes | — | No |
| `VERIFICATION_TOKEN_TTL_SECONDS` | Yes | — | No |
| `VITE_API_URL` | — | Yes | Yes (production) |

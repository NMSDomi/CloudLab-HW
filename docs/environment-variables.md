# Environment Variables

This document describes all environment variables used in the project, where they are defined, and how they flow through each deployment scenario.

---

## Variable Reference

| Variable | Used by | Description |
|---|---|---|
| `POSTGRES_HOST` | Backend | Database host |
| `POSTGRES_PORT` | Backend | Database port (default `5432`) |
| `POSTGRES_USER` | Backend, Compose DB | Database username |
| `POSTGRES_PASSWORD` | Backend, Compose DB | Database password |
| `POSTGRES_DB` | Backend | Database name |
| `JWT_ISSUER` | Backend | JWT token issuer |
| `JWT_AUDIANCE` | Backend | JWT token audience |
| `JWT_KEY` | Backend | JWT signing secret |
| `ADMIN_EMAIL` | Backend | Seed admin account email |
| `ADMIN_PASSWORD` | Backend | Seed admin account password |
| `ADMIN_NAME` | Backend | Seed admin display name |
| `FRONTEND_URL` | Backend | Allowed CORS origin |
| `ASPNETCORE_AllowedHosts` | Backend | Host-header allowlist (e.g. `your-api.appspot.com`) |
| `BACKEND_URL` | Frontend | API base URL used by the browser |
| `SMTP_HOST` | Backend | SMTP server host (leave empty to log emails to console) |
| `SMTP_PORT` | Backend | SMTP server port (default `587`) |
| `SMTP_USER` | Backend | SMTP username |
| `SMTP_PASSWORD` | Backend | SMTP password |
| `SMTP_FROM` | Backend | From address for outgoing emails |
| `PGADMIN_DEFAULT_EMAIL` | pgAdmin | pgAdmin login email |
| `PGADMIN_DEFAULT_PASSWORD` | pgAdmin | pgAdmin login password |
| `GCP_SA_KEY` | CI/CD | Google Cloud service account JSON key |
| `GCP_PROJECT_ID` | CI/CD | Google Cloud project ID |
| `GCP_CLOUDSQL_CONNECTION_NAME` | Backend (GCP) | Cloud SQL instance connection name |

---

## Local Development (no Docker)

Both services are run directly on the host machine.

### Backend

Variables are defined in `cloudhw-BE/Properties/launchSettings.json` under the `https` profile.

```
cloudhw-BE/Properties/launchSettings.json
  └─ profiles.https.environmentVariables  ← all backend vars hardcoded here
```

The .NET tooling (`dotnet run`, VS Code, Visual Studio) reads this file automatically and injects the values as process environment variables before the app starts. No manual `export` is needed.

At startup, `SystemContext` calls `Environment.GetEnvironmentVariable()` for each variable and throws if any required one is missing.

### Frontend

Variables are defined in two places:

```
cloudhw-FE/src/assets/env.js          ← BACKEND_URL hardcoded to '/'
cloudhw-FE/proxy.conf.json            ← proxies /api → https://localhost:7174
```

`env.js` is loaded at runtime by `index.html` via `<script src="assets/env.js">` and sets `window.env.BACKEND_URL`. Because `ng serve` uses the proxy, the browser only needs `BACKEND_URL = '/'` — Angular's dev server forwards all `/api` calls to the local backend automatically.

---

## Docker (local, `docker-compose.cloudhw.yml`)

All services run as containers. Variables come from the `.env` file in the project root.

```
.env                                  ← source of truth for local Docker
  └─ docker-compose.cloudhw.yml      ← reads .env automatically, substitutes ${VAR}
       ├─ cloudhw-be  environment:   ← passed as container env vars → SystemContext
       ├─ cloudhw-fe  environment:   ← BACKEND_URL passed to container
       ├─ cloudhw-db  environment:   ← POSTGRES_USER / POSTGRES_PASSWORD
       └─ cloudhw-pgadmin environment: ← PGADMIN_DEFAULT_EMAIL / PASSWORD
```

**Frontend at runtime:** The FE `Dockerfile` runs `envsubst` at container start:
```
env.template.js  (contains ${BACKEND_URL})
    │
    ▼  envsubst (reads BACKEND_URL from container env)
    │
env.js           (served to browser with the real URL)
```

**Setup:**
1. Copy `.env.example` → `.env`
2. Fill in your values
3. `docker compose -f docker-compose.cloudhw.yml up --build`

**Stopping (without auto-restart on Docker launch):**
```bash
docker compose -f docker-compose.cloudhw.yml stop
```
All services use `restart: unless-stopped` — they restart on crash but stay stopped after an explicit `stop`.

---

## Cloud Deployment (Google App Engine)

Triggered automatically on push to the `release` branch via `.github/workflows/release.yml`.

Variables are stored as **GitHub repository secrets** (Settings → Secrets and variables → Actions).

```
GitHub Repository Secrets
  └─ .github/workflows/release.yml   ← reads secrets, sets them as workflow env vars
       ├─ envsubst < cloudhw-BE/app.yaml > app.rendered.yaml
       │     └─ cloudhw-BE/app.yaml  ← contains ${VAR} placeholders → filled at deploy time
       └─ envsubst < cloudhw-FE/app.yaml > app.rendered.yaml
             └─ cloudhw-FE/app.yaml  ← contains ${BACKEND_URL} placeholder
```

The rendered `app.rendered.yaml` files are passed to `gcloud app deploy` and never committed to the repository.

### Required GitHub Secrets

| Secret | Notes |
|---|---|
| `POSTGRES_HOST` | Cloud SQL private IP or proxy host |
| `POSTGRES_USER` | |
| `POSTGRES_PASSWORD` | |
| `POSTGRES_DB` | |
| `JWT_ISSUER` | |
| `JWT_AUDIANCE` | |
| `JWT_KEY` | Use a long random string in production |
| `ADMIN_EMAIL` | |
| `ADMIN_PASSWORD` | |
| `ADMIN_NAME` | |
| `FRONTEND_URL` | e.g. `https://yourdomain.com` |
| `ASPNETCORE_AllowedHosts` | e.g. `your-api.appspot.com` — the App Engine hostname(s) that will send requests to the BE |
| `BACKEND_URL` | e.g. `https://api.yourdomain.com/` |
| `GCP_SA_KEY` | Full service account JSON (base64 not needed, raw JSON) |
| `GCP_PROJECT_ID` | |
| `GCP_CLOUDSQL_CONNECTION_NAME` | e.g. `project:region:instance` |
| `SMTP_HOST` | Optional — leave empty to log emails to console |
| `SMTP_PORT` | Optional |
| `SMTP_USER` | Optional |
| `SMTP_PASSWORD` | Optional |
| `SMTP_FROM` | Optional |

---

## Summary

| | Backend source | Frontend source |
|---|---|---|
| **Local dev** | `launchSettings.json` | `env.js` (hardcoded) + `proxy.conf.json` |
| **Docker** | `.env` → compose → container env | `.env` → compose → `envsubst` → `env.js` at runtime |
| **Cloud (GCP)** | GitHub secrets → `app.yaml` → App Engine env | GitHub secrets → `app.yaml` → App Engine env → `envsubst` → `env.js` at runtime |

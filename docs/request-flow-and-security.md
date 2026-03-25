# Request Flow & Security

This document traces a request from the browser through the full stack and details every security layer it passes through.

---

## Table of Contents

- [Request Journey](#request-journey)
  - [Production](#production-path)
  - [Local Development](#local-development-path)
- [Security Layers](#security-layers)
- [Authentication & Session Flow](#authentication--session-flow)

---

## Request Journey

### Production path

```
Browser (HTTPS)
    │
    │  Every request is HTTPS. The browser never speaks plain HTTP
    │  to the outside world.
    ▼
GCP Load Balancer  ←─── TLS is terminated here
    │
    │  The LB strips TLS and forwards plain HTTP internally.
    │  It routes by subdomain:
    │    project-....appspot.com        → FE service (default)
    │    api-dot-project-....appspot.com → BE service (api)
    │
    ▼
┌─────────────────────────────────────────────────────────┐
│  FE Service — App Engine Flex instance                  │
│  nginx container  (port 8080)                           │
│                                                         │
│  Static requests (/assets, JS, CSS, HTML)               │
│    → served directly from /usr/share/nginx/html         │
│                                                         │
│  API requests (/api/*)                                  │
│    → proxy_pass to BACKEND_URL (the BE service URL)     │
│    → Host header set to $proxy_host (BE service host)   │
│       so App Engine's LB routes it to the correct svc   │
└─────────────────────────────────────────────────────────┘
    │
    │  proxy_pass https://api-dot-....appspot.com/api/...
    │  (goes back through the GCP LB with the correct Host)
    │
    ▼
GCP Load Balancer  (routes to BE service by Host header)
    │
    ▼
┌─────────────────────────────────────────────────────────┐
│  BE Service — App Engine Flex instance                  │
│  .NET 8 container  (port 8080, HTTP only)               │
│                                                         │
│  Middleware pipeline (in order):                        │
│    1. CORS policy                                       │
│    2. Rate limiter                                      │
│    3. Security response headers                         │
│    4. Authentication (JWT validation)                   │
│    5. Authorization (role/policy checks)                │
│    6. Controller → Service → Repository                 │
└─────────────────────────────────────────────────────────┘
    │
    ▼
Google Cloud SQL  (PostgreSQL, private IP via Cloud SQL proxy)
    │
    ▼
Response travels back through the same chain
```

### Local development path

**Native (infra in Docker, app runs natively):**

```
Browser (http://localhost:4200)
    │
    ▼
Angular dev server  (ng serve — with proxy.conf.json)
    │  /api/* → http://localhost:5062/api/*
    ▼
.NET 8 backend  (dotnet run, https://localhost:7174 or http://localhost:5062)
    │
    ▼
PostgreSQL  (Docker container, port 5435)
```

**Full Docker Compose stack** (`docker-compose.cloudhw.yml`):

```
Browser (http://localhost:82)
    │
    ▼
nginx container  (port 82 → 8080)
    │  /api/* → http://cloudhw-be:8080/api/*  (internal Docker network)
    ▼
.NET 8 container  (port 8080)
    │
    ▼
PostgreSQL container  (cloudhw-db, Docker network — not exposed externally)
```

---

## Security Layers

Security is applied at every layer independently. A request must pass all of them.

### 1 — Transport (GCP Load Balancer)
- All external traffic is **HTTPS only**. The LB refuses plain HTTP from the internet.
- TLS is terminated at the LB; internal service-to-service traffic is plain HTTP within GCP's private network.
- The backend container does **not** run `UseHttpsRedirection` — that would conflict with LB-terminated TLS and cause 502s.

### 2 — Frontend / nginx
- nginx is the only public entry point for the frontend.
- API calls from the browser always go to a relative path (`/api/...`) — the actual backend URL is never exposed to the browser.
- nginx sets these security headers on every response:
  - `X-Frame-Options: DENY` — blocks clickjacking
  - `X-Content-Type-Options: nosniff` — blocks MIME sniffing
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()`
  - `Content-Security-Policy` — restricts resource origins, blocks inline scripts

### 3 — CORS (Backend)
- Only the `FRONTEND_URL` origin (set via environment variable) is allowed in production.
- In Development, localhost origins are additionally allowed.
- Allowed methods: `GET POST PUT DELETE OPTIONS` only.
- `AllowCredentials()` is set (required for HttpOnly cookie refresh tokens).
- Any request from an unlisted origin is rejected at the CORS preflight stage — controllers are never reached.

### 4 — Rate limiting (Backend)
Two fixed-window policies are configured globally (`auth`, `general`).
Currently, the `auth` policy is explicitly applied at controller level via `[EnableRateLimiting]` on sensitive auth endpoints:

| Policy | Limit | Window | Applied to |
|---|---|---|---|
| `auth` | 10 requests | 1 minute / IP | Login, register, forgot/reset password, resend confirmation |
| `general` | 300 requests | 1 minute / IP | Configured, but not yet explicitly applied on controllers |

Exceeding the limit returns `429 Too Many Requests`.

### 5 — Security response headers (Backend)
The backend middleware pipeline adds the same set of security headers as nginx:
- `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, `Content-Security-Policy`

These are set regardless of which path served the response (direct BE access or through the FE proxy).

### 6 — Authentication (JWT)
- All protected endpoints require a valid JWT Bearer token.
- Tokens are signed with HMAC-SHA256 using `JWT_KEY` (secret, never committed).
- Validated against `JWT_ISSUER` and `JWT_AUDIANCE`.
- Access token lifetime: **15 minutes**.
- No valid token → `401 Unauthorized`.

### 7 — Swagger (dev-only)
- Swagger UI and the `/swagger` endpoint are only enabled when `ASPNETCORE_ENVIRONMENT=Development`.
- In production, the endpoint does not exist — `GET /swagger` returns 404.

### 8 — Authorization (Roles)
- Two roles: `Admin` and `Editor` (default on registration).
- Role is embedded in the JWT claims.
- Admin-only endpoints (`GET /api/user/all`, role changes) return `403 Forbidden` for non-admins.

### 9 — Business logic access control
- Album/picture ownership is verified *inside* the service layer on every operation.
- `HasAccessAsync` checks: owner OR album is public OR explicitly shared with user.
- Unauthorized reads return `404 Not Found` (not 403) to avoid leaking resource existence.
- Write/delete operations require the caller to be the **owner** — not just any authenticated user.

### 10 — Account protection
- **Password hashing**: bcrypt via ASP.NET Identity — plain-text passwords are never stored.
- **Lockout**: 5 consecutive failed logins → 5-minute lockout.
- **Email confirmation**: accounts cannot log in until the registration email is confirmed.
- **User enumeration prevention**: `forgot-password` and `resend-confirmation` always return `200 OK` regardless of whether the email exists.
- **Password reset tokens expire in 5 minutes**.

---

## Authentication & Session Flow

### Registration
```
POST /api/user/register  { email, password, name }
  → User created (role: Editor, EmailConfirmed: false)
  → Confirmation email sent via SMTP
  → Cannot log in until email is confirmed
```

### Email Confirmation
```
GET /api/user/confirm-email?userId=...&token=...
  → Sets EmailConfirmed = true
  → Account is now active
```

### Login
```
POST /api/user/login  { email, password, rememberMe }
  → Credentials validated
  → Lockout checked
  → Email confirmation checked
  → JWT access token returned in response body  (15 min)
  → Refresh token set as HttpOnly cookie:
      - session cookie if rememberMe = false
      - persistent cookie (30 days) if rememberMe = true
  → Server-side refresh-token validity: 1 day / 30 days if rememberMe
```

### Token storage (frontend)

| Token | Storage | Reason |
|---|---|---|
| Access token | **In-memory only** (JS variable) | Never written to localStorage — lost on page refresh (intentional) |
| Refresh token | **HttpOnly cookie** | JavaScript cannot read it — XSS-proof |

On every page load the frontend silently calls `POST /api/user/refresh-token`. The browser sends the cookie automatically. If valid, a new access token is returned and the user is seamlessly re-authenticated without any interaction.

### Token Refresh
```
POST /api/user/refresh-token  (cookie sent automatically by browser)
  → Refresh token validated and rotated (old one invalidated)
  → New access token in response body
  → New refresh token in HttpOnly cookie
```

### Logout
```
POST /api/user/logout
  → Refresh token deleted from DB
  → Cookie cleared
  → Frontend clears in-memory access token
```

### Password Reset
```
POST /api/user/forgot-password  { email }
  → Always returns 200 (prevents user enumeration)
  → Sends reset link if account exists and email is confirmed
  → Token expires in 5 minutes

POST /api/user/reset-password  { email, token, newPassword }
  → Validates token
  → Rejects if new password matches current password
  → Updates password hash via UserManager
```

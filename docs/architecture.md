# Architecture

This document describes the overall structure and design of the backend and frontend.

---

## Project Layout

```
CloudLab-HW/
  cloudhw-BE/          ← .NET 8 Web API
  cloudhw-FE/          ← Angular 17+ SPA
  docker-compose.cloudhw.yml    ← full stack (production-like)
  docker-compose.development.yml ← infra only (DB + pgAdmin)
  .env.example         ← environment variable template
  docs/                ← documentation
```

---

## Backend

### Layer Structure

```
cloudhw-BE/
  01_Controllers/      ← HTTP layer — routing, auth, request/response shaping
  02_BLL/              ← Business Logic Layer — services, rules, orchestration
    Services/
    Interfaces/
    Seed/
  03_DAL/              ← Data Access Layer — models, repositories, DB context
    Models/
    Repositories/
    Interfaces/
    Context/
  08_Migrations/       ← EF Core migrations
  09_Setup/            ← Startup configuration extensions
  Program.cs           ← Entry point
```

### Request Flow

```
HTTP Request
    │
    ▼
Controller (01_Controllers)
    │  extracts user ID from JWT claims
    │  validates input shape
    ▼
Service (02_BLL/Services)
    │  enforces business rules (ownership, access control)
    │  orchestrates multiple repositories
    ▼
Repository (03_DAL/Repositories)
    │  single DB table operations
    ▼
DataContext (EF Core + PostgreSQL)
```

Controllers never call repositories directly. Services never call other services' repositories directly — they call the owning service if cross-domain access checks are needed (e.g. `PictureService` calls `AlbumService.HasAccessAsync`).

### Dependency Injection

All services and repositories are registered as **scoped** (per-request lifetime) in `ServicesSetup.cs`. `ISystemContext` (`SystemContext`) is registered as a **singleton** since it reads environment variables once at startup.

### Configuration — `ISystemContext`

`SystemContext` is a singleton that reads all configuration from OS environment variables at startup. It is injected into services that need config (e.g. `AuthService` for JWT signing, `DataContext` for the connection string).

There is no `appsettings.json`-based config for secrets — all secrets come from environment variables only. See [environment-variables.md](environment-variables.md).

### Startup Sequence (`Program.cs`)

```
1. Register ISystemContext (validates required env vars — throws if missing)
2. Register controllers, auth, swagger, services, database, CORS
3. Build app
4. ApplyMigrationsAsync()   ← runs any pending EF Core migrations
5. UseRoleSeedAsync()       ← seeds Admin/Editor roles and admin user
6. Configure middleware pipeline
7. app.Run()
```

### Database

- **PostgreSQL** via EF Core (Npgsql)
- `DataContext` extends `IdentityDbContext<User>` (includes all ASP.NET Identity tables)
- Additional tables: `Albums`, `Pictures`, `AlbumShares`
- Pictures stored as `byte[]` columns (full image + thumbnail) — no file system storage
- Migrations in `08_Migrations/`, applied automatically at startup

### Authentication

- **ASP.NET Core Identity** for user management (password hashing, lockout, email confirmation)
- **JWT** access tokens (15-minute lifetime, HMAC-SHA256)
- **Refresh tokens** stored in the `User` table, delivered via HttpOnly cookie
- See [user-handling.md](user-handling.md) for the full auth flow

---

## Frontend

### Layer Structure

```
cloudhw-FE/src/app/
  01_pages/            ← Routed page components (full views)
  02_components/       ← Reusable UI components
  03_services/         ← HTTP services (UserService, AlbumService, PictureService)
  04_models/           ← TypeScript interfaces matching backend DTOs
```

### Key Services

| Service | Responsibility |
|---|---|
| `UserService` | Auth state (access token in-memory, currentUser signal), login/logout/refresh, user CRUD |
| `AlbumService` | Album CRUD, sharing |
| `PictureService` | Upload, fetch, thumbnail/full image URLs |

### Auth State

Auth state is held in `UserService`:
- `accessToken` — private field, in-memory only, never persisted
- `currentUser` — Angular `signal<User | null>`, read by components reactively

On app startup, `APP_INITIALIZER` calls `UserService.initializeAuth()` which:
1. Calls `POST /api/user/refresh-token` (HttpOnly cookie sent automatically)
2. On success: stores new access token, fetches `GET /api/user/me`, sets `currentUser`
3. On failure: sets `authInitialized = true`, user remains unauthenticated

This allows the user to remain logged in across page refreshes without any stored token.

### HTTP Interceptor

Outbound requests that require authentication attach the access token via an Angular HTTP interceptor:

```
Request → Interceptor → adds Authorization: Bearer <token> → Backend
```

If a 401 is returned, the interceptor attempts a silent token refresh and retries the request once.

### Runtime Configuration

`BACKEND_URL` is injected at runtime (not build time) via `assets/env.js`, loaded in `index.html`. This allows the same built image to point to different backends.

See [environment-variables.md](environment-variables.md) for details.

---

## Database Schema (simplified)

```
AspNetUsers  (Identity)
    │  1──n  Albums
    │            │  1──n  Pictures
    │            │  1──n  AlbumShares ──n──1  AspNetUsers
    │
    └── (via AlbumShares)  SharedAlbums
```

- Deleting a user cascades to their albums, which cascade to pictures and shares
- Deleting an album cascades to its pictures and shares
- `CoverPictureId` on Album is set to NULL when the referenced picture is deleted

# User Handling

This document covers how users are stored, authenticated, and managed across the backend and frontend.

---

## User Model

Users are stored in the database via **ASP.NET Core Identity**. The `User` class extends `IdentityUser` with two extra fields:

```
IdentityUser (built-in)
  ├─ Id                   (GUID, primary key)
  ├─ Email
  ├─ UserName             (set to Email on registration)
  ├─ PasswordHash         (bcrypt via Identity)
  ├─ EmailConfirmed
  ├─ LockoutEnabled
  ├─ LockoutEnd
  └─ AccessFailedCount

User (extends IdentityUser)
  ├─ Name                 (display name)
  ├─ RefreshToken         (stored hashed string)
  ├─ RefreshTokenExpiryTime
  ├─ Albums               (navigation property)
  └─ SharedAlbums         (navigation property)
```

Passwords are **never stored in plain text** — Identity handles bcrypt hashing automatically.

---

## Roles

Two roles exist, seeded at startup via `RoleSeed`:

| Role | Description |
|---|---|
| `Admin` | Full access — can view all users, change roles |
| `Editor` | Default role assigned on registration |

---

## Registration Flow

```
1. POST /api/user/register  { email, password, name }
2. Backend creates user via UserManager
3. Assigns role: Editor
4. Generates email confirmation token
5. Sends confirmation email (or logs to console if SMTP not configured)
6. Returns 200 — user cannot log in yet
```

Email confirmation is **required** before login is allowed (`RequireConfirmedEmail = true`).

---

## Email Confirmation Flow

```
1. User clicks link in email:
   GET /api/user/confirm-email?userId=...&token=...
2. Backend validates token via UserManager
3. Sets EmailConfirmed = true
4. User can now log in
```

If the confirmation email is lost:
```
POST /api/user/resend-confirmation  { email }
```
Always returns 200 regardless of whether the email exists (prevents user enumeration).

---

## Login Flow

```
1. POST /api/user/login  { email, password, rememberMe }
2. Backend validates credentials via SignInManager
3. Checks email confirmed — returns error if not
4. Checks lockout — returns remaining time if locked
5. Generates JWT access token (short-lived)
6. Generates refresh token (cryptographically random, stored in DB)
7. Returns:
   - Access token in response body
   - Refresh token as HttpOnly cookie (SameSite=Lax, Secure on HTTPS)
```

### Token lifetimes

| Token | Normal session | Remember Me |
|---|---|---|
| JWT access token | 15 minutes | 15 minutes |
| Refresh token | 1 day | 30 days |

### Account lockout

After **5 failed login attempts** the account is locked for **5 minutes**. Configured in `AuthSetup.cs`.

---

## Token Storage (Frontend)

| Token | Where stored |
|---|---|
| Access token | **In-memory only** (`UserService.accessToken` private field) — never written to localStorage or sessionStorage |
| Refresh token | **HttpOnly cookie** — set by the backend, never accessible via JavaScript |

On app startup (`APP_INITIALIZER`), the frontend silently calls `POST /api/user/refresh-token`. The browser automatically sends the HttpOnly cookie. If valid, a new access token is returned and stored in memory, and the user is considered logged in without any user interaction.

---

## Token Refresh Flow

```
1. POST /api/user/refresh-token  (no body — cookie sent automatically)
2. Backend finds user by refresh token in DB
3. Validates expiry
4. Issues new JWT + new refresh token (rotation)
5. Updates DB with new refresh token
6. Returns new access token in body + sets new refresh cookie
```

Refresh tokens are **rotated** on every use — each refresh invalidates the previous token.

---

## Logout

```
1. POST /api/user/logout
2. Backend clears RefreshToken and RefreshTokenExpiryTime in DB
3. Clears the refresh_token cookie
4. Frontend clears in-memory access token and currentUser signal
```

---

## Password Reset Flow

```
1. POST /api/user/forgot-password  { email }
   → Always returns 200 (prevents user enumeration)
   → Sends reset email with token if account exists and email is confirmed

2. User clicks link → reset-password page with ?email=...&token=...

3. POST /api/user/reset-password  { email, token, newPassword }
   → Validates token (expires after 5 minutes)
   → Rejects if new password matches current password
   → Updates password hash via UserManager
```

Token lifetime for password reset and email confirmation is **5 minutes** (`DataProtectionTokenProviderOptions`).

---

## Change Password (authenticated)

```
POST /api/user/change-password  { currentPassword, newPassword }
Authorization: Bearer <access token>
```

Requires the current password to be correct.

---

## Admin Operations

All require `Admin` role (`Authorization: Bearer <token>` with Admin claim):

| Endpoint | Description |
|---|---|
| `GET /api/user/all` | List all users |
| `GET /api/user/{id}` | Get user by ID |
| `PUT /api/user/{id}/role` | Change a user's role (`Admin` / `Editor`) |

---

## JWT Contents

Each JWT access token contains:

| Claim | Value |
|---|---|
| `NameIdentifier` | User GUID |
| `Name` | Username (= email) |
| `Email` | Email address |
| `Role` | `Admin` or `Editor` |

Signed with HMAC-SHA256 using `JWT_KEY`. Validated against `JWT_ISSUER` and `JWT_AUDIANCE`.

---

## Password Requirements

Enforced by ASP.NET Identity (`AuthSetup.cs`):

- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one digit
- At least one non-alphanumeric character

The frontend enforces these visually with a `PasswordStrengthComponent` before submission.

---

## Security Notes

- Refresh token is HttpOnly — XSS cannot steal it
- Access token is in-memory — not persisted across page refreshes (intentional; recovered via silent refresh on load)
- All responses that could reveal whether an email exists return the same `200 OK` message (forgot password, resend confirmation)
- New password cannot be the same as the current password
- Admin can seed user is created at startup with credentials from `ADMIN_EMAIL` / `ADMIN_PASSWORD` env vars and is assigned the `Admin` role

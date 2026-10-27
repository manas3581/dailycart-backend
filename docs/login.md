# Login — Cookie-based Access + Refresh Tokens

**Status:** Planned (not implemented yet)  
**Auth style:** **HttpOnly cookies only** — tokens never returned in JSON, never stored in `localStorage`  
**Depends on:** Registered user ([register.md](./register.md))  
**Architecture:** [architecture.md](./architecture.md)

---

## 1. Goal

1. Login with email + password.
2. Issue **access** + **refresh** JWTs.
3. Deliver both only via **Secure HttpOnly cookies**.
4. Access token lives **30 minutes**; after that, client calls **refresh** to get a new pair (cookies overwritten).
5. JSON responses carry **user data only** — never token strings.

---

## 2. Token policy

| Token | Cookie name | Lifetime | Purpose |
| --- | --- | --- | --- |
| Access | `access_token` | **30 minutes** | Proves identity on every API call |
| Refresh | `refresh_token` | **7 days** (configurable) | Obtains a new access (+ rotated refresh) when access expires |

### “Refresh every 30 minutes”

```text
t=0        Login → set access (30m) + refresh (7d) cookies
t=0–30m    Protected routes read access_token cookie
t≈30m      Access expired → POST /auth/refresh
           → new access (30m) + new refresh (7d) cookies
           → old refresh revoked in DB
t=7d idle  Refresh expired → must login again
```

Client (browser / frontend):

- Send requests with `credentials: 'include'`.
- On `401` from a protected route → call `POST /auth/refresh` once → retry original request.
- Do **not** put tokens in headers or body.

---

## 3. Cookie rules (both tokens)

| Flag | Value | Why |
| --- | --- | --- |
| `httpOnly` | `true` | JS cannot read tokens (XSS mitigation) |
| `secure` | `true` in production | HTTPS only |
| `sameSite` | `lax` (same-site) or `none` + `secure` (cross-site SPA) | CSRF / cross-origin policy |
| `path` | `/` for access; optionally `/api/v1/auth` for refresh | Limit where refresh is sent |
| `maxAge` | match token TTL | Browser drops cookie when TTL ends |

**Never** put access or refresh tokens in the response body.

---

## 4. Stack

| Piece | Tool |
| --- | --- |
| Password verify | argon2 |
| Sign / verify JWT | jose |
| Validation | Zod (`loginSchema`) |
| Cookies | `cookie-parser` + `res.cookie` / `res.clearCookie` |
| CORS | `cors({ origin: FRONTEND_URL, credentials: true })` |
| Refresh persistence | PostgreSQL `RefreshToken` (hash stored; raw token only in cookie) |
| Config | `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, TTLs, cookie flags |

Redis can replace DB refresh storage later; start with Postgres so auth works without Redis.

---

## 5. Endpoints

| Method | Path | Auth | Action |
| --- | --- | --- | --- |
| `POST` | `/api/v1/auth/login` | Public | Verify credentials → set cookies → return user |
| `POST` | `/api/v1/auth/refresh` | Refresh cookie | Rotate tokens → set new cookies |
| `POST` | `/api/v1/auth/logout` | Refresh or access cookie | Revoke refresh → clear cookies |
| `GET` | `/api/v1/auth/me` | Access cookie | Return current user (smoke-test protected route) |

---

## 6. Flows

### 6.1 Login

```text
POST /api/v1/auth/login  { email, password }
        │
        ▼
Zod loginSchema
        │
        ▼
loginUser()
  1. find user by email
  2. argon2.verify — fail → 401 INVALID_CREDENTIALS (same msg if no user)
  3. sign access JWT (exp 30m)  — claims: sub, role, type:"access"
  4. sign refresh JWT (exp 7d)  — claims: sub, type:"refresh", jti
  5. store hash(refresh) + jti + userId + expiresAt in RefreshToken
  6. return user (safe fields)
        │
        ▼
Controller sets cookies:
  Set-Cookie: access_token=…; HttpOnly; …
  Set-Cookie: refresh_token=…; HttpOnly; …
        │
        ▼
HTTP 200  { success, message, data: { user } }
```

### 6.2 Authenticated request

```text
GET /api/v1/auth/me   (Cookie: access_token=…)
        │
        ▼
auth.middleware
  read req.cookies.access_token
  jose.verify → req.user = { id, role }
  missing/invalid/expired → 401
        │
        ▼
controller
```

### 6.3 Refresh (every ~30m when access dies)

```text
POST /api/v1/auth/refresh   (Cookie: refresh_token=…)
        │
        ▼
  1. read refresh cookie
  2. jose.verify refresh JWT
  3. load RefreshToken by jti / hash — must exist, not revoked, not expired
  4. revoke old refresh row (rotation)
  5. issue new access + new refresh
  6. store new refresh hash
  7. Set-Cookie both again
        │
        ▼
HTTP 200  { success, message, data: { user } }   // optional user re-fetch
```

Reuse of an already-revoked refresh → treat as theft: revoke all refresh tokens for that user and clear cookies (`401` / `TOKEN_REUSE`).

### 6.4 Logout

```text
POST /api/v1/auth/logout
  → revoke current refresh (if present)
  → clearCookie access_token + refresh_token
  → 200
```

---

## 7. Data model addition

```prisma
model RefreshToken {
  id        String    @id @default(uuid())
  userId    String
  tokenHash String    @unique
  jti       String    @unique
  expiresAt DateTime
  revokedAt DateTime?
  createdAt DateTime  @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}

model User {
  // …existing fields…
  refreshTokens RefreshToken[]
}
```

Store **hash** of refresh token (e.g. SHA-256), not the raw JWT.

---

## 8. Env / config

```env
# Secrets (gitignored)
JWT_ACCESS_SECRET=long-random-access-secret
JWT_REFRESH_SECRET=long-random-refresh-secret-different

# TTLs
JWT_ACCESS_EXPIRES_IN=30m
JWT_REFRESH_EXPIRES_IN=7d

# Cookies / CORS
FRONTEND_ORIGIN=http://localhost:5173
COOKIE_SECURE=false          # true in production
COOKIE_SAME_SITE=lax         # none if frontend is on another site (requires Secure)
```

Expose via `src/config/env.ts`. Fail fast if secrets are missing when signing.

---

## 9. Files to add / change

```text
prisma/schema.prisma                 # RefreshToken model + User relation
src/config/env.ts                    # JWT + cookie + FRONTEND_ORIGIN
src/config/cookies.ts                # NEW — cookie option helpers
src/utils/jwt.ts                     # NEW — sign/verify access + refresh
src/utils/hash.ts                    # NEW — sha256 for refresh storage (optional inline)

src/modules/auth/
├── auth.types.ts                    # LoginInput, AuthUser, Jwt payloads
├── auth.validation.ts               # loginSchema
├── auth.service.ts                  # loginUser, refreshSession, logoutUser
├── auth.controller.ts               # login, refresh, logout, me
├── auth.routes.ts                   # wire routes
└── auth.cookies.ts                  # NEW — setAuthCookies / clearAuthCookies

src/middlewares/auth.middleware.ts   # NEW — require access cookie
src/app.ts                           # cookie-parser; cors credentials + origin
package.json                         # + cookie-parser, @types/cookie-parser
```

---

## 10. Request / response shapes

### Login request

```http
POST /api/v1/auth/login
Content-Type: application/json
```

```json
{
  "email": "manas@example.com",
  "password": "Password@123"
}
```

### Login / refresh success (body — no tokens)

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "uuid",
      "firstName": "Manas",
      "lastName": "Kumar",
      "email": "manas@example.com",
      "phone": "9876543210",
      "role": "USER"
    }
  }
}
```

Response also includes `Set-Cookie` headers for `access_token` and `refresh_token`.

### Errors

| Case | Status | errorCode |
| --- | --- | --- |
| Validation | `400` | `VALIDATION_ERROR` |
| Bad email/password | `401` | `INVALID_CREDENTIALS` |
| Missing/invalid/expired access | `401` | `UNAUTHORIZED` |
| Missing/invalid refresh | `401` | `INVALID_REFRESH_TOKEN` |
| Refresh reuse after rotate | `401` | `TOKEN_REUSE` |
| Unexpected | `500` | `INTERNAL_SERVER_ERROR` |

---

## 11. Frontend contract

```ts
// All auth-aware calls
fetch(`${API}/api/v1/auth/login`, {
  method: 'POST',
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
});
```

CORS on backend must allow that origin and `credentials: true`. Wildcard `origin: '*'` is **incompatible** with cookies.

---

## 12. Implementation checklist

1. Prisma `RefreshToken` + migrate.
2. Env: dual secrets, 30m / 7d TTLs, cookie + CORS settings.
3. Install `cookie-parser`; wire in `app.ts` with credentialed CORS.
4. `utils/jwt.ts` — access (30m) + refresh (7d) with distinct secrets / `type` claim.
5. Cookie helpers — set / clear with correct flags.
6. `loginUser` → verify password → issue tokens → persist refresh hash → set cookies.
7. `auth.middleware` — read **cookie only** (no Bearer).
8. `POST /refresh` — verify + rotate; `POST /logout` — revoke + clear.
9. `GET /me` — prove cookie auth works.
10. Manual test with curl `-c/-b` cookie jars or browser credentials.

---

## 13. Security notes

1. Cookie-only — no tokens in JSON (avoids XSS stealing from JS storage).
2. HttpOnly + Secure (prod) + SameSite.
3. Separate secrets for access vs refresh.
4. Refresh **rotation** + DB revoke; reuse detection.
5. Same `401` message for unknown email and bad password.
6. Never log cookie values or raw JWTs.
7. CSRF: SameSite=lax covers classic cross-site POSTs for same-site apps; if `SameSite=none` (cross-origin SPA), add CSRF token or double-submit later.

---

## 14. Out of scope (for this login pass)

- Redis-backed refresh store (Postgres first).
- Mobile native non-cookie clients (would need a separate header strategy later).
- Email verification / MFA.
- Rate limiting (attach `express-rate-limit` on login/refresh next).

---

## 15. Manual test sketch (after implement)

```bash
# Login — save cookies
curl -s -c cookies.txt -X POST http://localhost:3000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"manas@example.com","password":"Password@123"}'

# Protected route with cookies
curl -s -b cookies.txt http://localhost:3000/api/v1/auth/me

# Refresh (simulates post-30m)
curl -s -c cookies.txt -b cookies.txt -X POST http://localhost:3000/api/v1/auth/refresh

# Logout
curl -s -c cookies.txt -b cookies.txt -X POST http://localhost:3000/api/v1/auth/logout
```

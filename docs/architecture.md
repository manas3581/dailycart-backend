# DailyCart Backend — Architecture

## 1. What this project is

DailyCart backend is a **modular monolith**: one Node.js process, feature folders under `src/modules/`, PostgreSQL as source of truth.

```text
Client (web / mobile / Postman)
        │  HTTPS
        ▼
   Express app (app.ts)
        │  /api/v1/...
        ▼
   Feature modules (auth, health, …)
        │
        ▼
   PostgreSQL (Prisma)
```

Later: Redis (cache / sessions / rate limits), BullMQ workers, AI tools — without splitting into microservices first.

---

## 2. Stack (what we actually use)

| Layer | Choice | Why |
| --- | --- | --- |
| Runtime | Node.js + TypeScript | Typed server code |
| HTTP | Express 5 | Routes, middleware |
| ORM | Prisma | PostgreSQL schema + queries |
| DB | PostgreSQL | Primary data store |
| Passwords | argon2 | Hash / verify (never store plaintext) |
| JWT | jose | Access + refresh tokens (cookie delivery) |
| Cookies | cookie-parser + `res.cookie` | HttpOnly auth cookies only |
| Validation | Zod | Request body / query schemas |
| Config | dotenv | `process.env` via `config/env.ts` |
| Security headers | helmet | Baseline HTTP hardening |
| CORS | cors | Credentialed origin (required for cookies) |
| Logging | pino + pino-http | Structured request logs |
| Dev | nodemon + tsx | Hot reload without a full build |

Installed but not wired yet: `express-rate-limit` (use on login/register later).

---

## 3. Folder structure (current)

```text
backend/
├── docs/                      # This documentation
│   ├── README.md
│   ├── architecture.md
│   ├── register.md
│   └── login.md
│
├── prisma/
│   ├── schema.prisma          # User model, etc.
│   └── migrations/
│
├── src/
│   ├── app.ts                 # Express app: middleware + routes
│   ├── server.ts              # listen() + Prisma connect
│   │
│   ├── config/
│   │   ├── env.ts             # PORT, NODE_ENV (+ JWT later)
│   │   ├── database.ts        # Prisma client
│   │   └── logger.ts          # pino logger
│   │
│   ├── constants/
│   │   └── paths.ts           # API_BASE, API_V1, health paths
│   │
│   ├── modules/
│   │   ├── auth/              # register (done), login (next)
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── auth.routes.ts
│   │   │   ├── auth.validation.ts
│   │   │   └── auth.types.ts
│   │   └── health/
│   │       ├── health.controller.ts
│   │       └── health.routes.ts
│   │
│   ├── middlewares/
│   │   ├── requestId.middleware.ts
│   │   └── error.middleware.ts
│   │
│   ├── routes/
│   │   ├── index.ts           # mounts /v1
│   │   └── v1/index.ts        # health + auth
│   │
│   ├── utils/
│   │   ├── ApiError.ts
│   │   ├── asyncHandler.ts
│   │   ├── response.ts
│   │   ├── pagination.ts
│   │   └── url.ts
│   │
│   └── types/
│       ├── express.d.ts
│       └── common.types.ts
│
├── .env                       # gitignored (DATABASE_URL, secrets)
├── .gitignore
├── package.json
├── tsconfig.json
└── nodemon.json
```

Empty stubs (user module, swagger, unused auth/rbac/rateLimit middlewares) were removed until needed.

---

## 4. Request lifecycle

```text
HTTP request
    → requestId middleware
    → pino-http logger
    → helmet / cors
    → express.json()
    → /api  →  /v1  →  module router
    → asyncHandler(controller)
         → Zod parse (validation)
         → service (business logic + Prisma)
         → JSON response
    → errorMiddleware (if anything throws)
```

### URL mounting

| Constant | Value |
| --- | --- |
| `API_BASE` | `/api` |
| `API_V1` | `/v1` |

```text
app.use('/api', apiRouter)
apiRouter.use('/v1', v1Router)
v1Router.use('/auth', authRouter)
authRouter.post('/register', …)
```

Full register path: **`POST /api/v1/auth/register`**

---

## 5. Layer rules (company-style)

| Layer | Responsibility | Must not |
| --- | --- | --- |
| **Route** | HTTP method + path | Business logic |
| **Controller** | Parse input, call service, shape HTTP response | Prisma / hashing |
| **Validation** | Zod schemas | DB access |
| **Service** | Business rules, Prisma, hashing | `res.json` / status codes |
| **Middleware** | Cross-cutting (errors, requestId, later auth) | Feature-specific rules |
| **Utils** | Shared helpers (`ApiError`, `asyncHandler`) | Feature domain logic |

Errors: throw `ApiError(status, message, errorCode)` from services; `errorMiddleware` maps `ApiError`, `ZodError`, and Prisma codes to JSON.

---

## 6. Data model (today)

`prisma/schema.prisma` — `User`:

| Field | Notes |
| --- | --- |
| `id` | UUID |
| `firstName`, `lastName` | Required strings |
| `email` | Unique |
| `phone` | Optional, unique |
| `passwordHash` | Argon2 hash only |
| `role` | Default `"USER"` |
| `createdAt`, `updatedAt` | Timestamps |

Never return `passwordHash` in API responses.

---

## 7. Environment

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Prisma → PostgreSQL |
| `PORT` | No (default `3000`) | HTTP listen port |
| `NODE_ENV` | No | `development` / `production` |
| `JWT_ACCESS_SECRET` | Login | Sign/verify access JWT |
| `JWT_REFRESH_SECRET` | Login | Sign/verify refresh JWT (different secret) |
| `JWT_ACCESS_EXPIRES_IN` | Login | **`30m`** |
| `JWT_REFRESH_EXPIRES_IN` | Login | e.g. `7d` |
| `FRONTEND_ORIGIN` | Login | CORS allowlist for credentialed cookies |
| `COOKIE_SECURE` / `COOKIE_SAME_SITE` | Login | Cookie flags |

`.env` is gitignored. Prefer committing `.env.example` with empty placeholders only.

**Auth transport:** HttpOnly cookies only (`access_token`, `refresh_token`). No Bearer tokens in JSON. See [login.md](./login.md).

---

## 8. Scripts

| Script | Command |
| --- | --- |
| Dev | `npm run dev` (nodemon) |
| Start (tsx) | `npm start` |
| Build | `npm run build` |
| Prod | `npm run start:prod` |

Prisma:

```bash
npx prisma generate
npx prisma migrate dev
```

---

## 9. Response shape

Success:

```json
{
  "success": true,
  "message": "...",
  "data": {}
}
```

Failure (`errorMiddleware`):

```json
{
  "success": false,
  "message": "...",
  "errorCode": "VALIDATION_ERROR"
}
```

Validation failures may include an `errors: [{ field, message }]` array.

---

## 10. Roadmap (backend)

| Done | Next |
| --- | --- |
| Health check | Cookie login + refresh (`docs/login.md`) |
| Register | Access 30m + refresh 7d, HttpOnly cookies |
| Modular auth folder | Auth middleware (cookie), logout, `/me` |
| Central error handler | Rate limit on auth routes |
| Request ID + pino | Redis refresh store (optional later), RBAC |

Feature docs:

- [register.md](./register.md) — create account (implemented)
- [login.md](./login.md) — login design

# Create account (Register)

**Status:** Implemented  
**Endpoint:** `POST /api/v1/auth/register`  
**Related code:** `src/modules/auth/*`

---

## 1. Goal

Create a new user in PostgreSQL with a hashed password. Return a safe user object (no password / hash).

---

## 2. Stack used here

| Piece | Tool |
| --- | --- |
| Validation | Zod (`registerSchema`) |
| Hashing | argon2 (`argon2.hash`) |
| Persistence | Prisma `User` model |
| Errors | `ApiError` + `errorMiddleware` |

JWT is **not** issued on register. Client must call login afterward (see [login.md](./login.md)).

---

## 3. Files

```text
src/modules/auth/
├── auth.types.ts          # RegisterInput
├── auth.validation.ts     # registerSchema (Zod)
├── auth.service.ts        # registerUser()
├── auth.controller.ts     # register()
└── auth.routes.ts         # POST /register

src/routes/v1/index.ts     # v1Router.use('/auth', authRouter)
```

---

## 4. Flow

```text
POST /api/v1/auth/register
        │
        ▼
auth.routes.ts  →  asyncHandler(register)
        │
        ▼
auth.controller.ts
  registerSchema.parse(req.body)     ← Zod
        │
        ▼
auth.service.ts  →  registerUser(input)
  1. findFirst by email OR phone
  2. if exists → ApiError 409 USER_ALREADY_EXISTS
  3. passwordHash = argon2.hash(password)
  4. prisma.user.create({ …, passwordHash })
  5. select safe fields only
        │
        ▼
HTTP 201
{
  success: true,
  message: "User registered successfully",
  data: { id, firstName, lastName, email, phone, role, createdAt }
}
```

---

## 5. Request

### Headers

```http
Content-Type: application/json
```

### Body

| Field | Type | Rules |
| --- | --- | --- |
| `firstName` | string | trim, 2–50 chars |
| `lastName` | string | trim, 2–50 chars |
| `email` | string | valid email, max 254, lowercased |
| `phone` | string? | optional; if present, exactly 10 digits |
| `password` | string | 8–128 chars; upper + lower + digit + special |

### Example

```http
POST http://localhost:3000/api/v1/auth/register
Content-Type: application/json
```

```json
{
  "firstName": "Manas",
  "lastName": "Kumar",
  "email": "manas@example.com",
  "phone": "9876543210",
  "password": "Password@123"
}
```

---

## 6. Success response

**Status:** `201 Created`

```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "id": "uuid",
    "firstName": "Manas",
    "lastName": "Kumar",
    "email": "manas@example.com",
    "phone": "9876543210",
    "role": "USER",
    "createdAt": "2026-…"
  }
}
```

**Never returned:** `password`, `passwordHash`.

---

## 7. Error responses

| Case | Status | errorCode |
| --- | --- | --- |
| Zod validation failed | `400` | `VALIDATION_ERROR` (+ `errors[]`) |
| Email or phone already taken | `409` | `USER_ALREADY_EXISTS` |
| Prisma unique race (`P2002`) | `409` | `DUPLICATE_RESOURCE` |
| Unexpected | `500` | `INTERNAL_SERVER_ERROR` |

Validation example:

```json
{
  "success": false,
  "message": "Validation failed",
  "errorCode": "VALIDATION_ERROR",
  "errors": [
    { "field": "password", "message": "Password must contain at least one uppercase letter" }
  ]
}
```

Conflict example:

```json
{
  "success": false,
  "message": "User with this email or phone already exists",
  "errorCode": "USER_ALREADY_EXISTS"
}
```

---

## 8. Security rules (implemented)

1. Plaintext password never stored — only Argon2 hash.
2. Duplicate check on email and optional phone before create.
3. DB uniqueness on `email` / `phone` as a second line of defense.
4. Response `select` omits `passwordHash`.

---

## 9. How to test

1. Ensure Postgres is up and `DATABASE_URL` is set in `.env`.
2. `npm run dev` in `backend/`.
3. Send the example POST above (Postman / curl).
4. Confirm row in DB has `passwordHash` starting with Argon2 prefix (`$argon2…`), not the raw password.
5. Register again with same email → expect `409`.

```bash
curl -s -X POST http://localhost:3000/api/v1/auth/register \
  -H 'Content-Type: application/json' \
  -d '{
    "firstName": "Manas",
    "lastName": "Kumar",
    "email": "manas@example.com",
    "phone": "9876543210",
    "password": "Password@123"
  }'
```

---

## 10. What register does *not* do

- Issue JWT / session
- Send verification email
- Rate-limit the route (package installed; middleware not attached yet)

Those belong to login / later hardening. See [login.md](./login.md) and [architecture.md](./architecture.md).

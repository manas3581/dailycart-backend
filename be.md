# DailyCart Backend Architecture

## Folder structure

```text
backend/
├── src/
│   ├── config/
│   │   ├── env.ts
│   │   ├── database.ts      # PostgreSQL (Prisma client)
│   │   ├── redis.ts         # Redis client
│   │   └── logger.ts
│   │
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── auth.routes.ts
│   │   │   ├── auth.validation.ts
│   │   │   └── auth.types.ts
│   │   │
│   │   └── user/
│   │       ├── user.controller.ts
│   │       ├── user.service.ts
│   │       ├── user.repository.ts
│   │       ├── user.routes.ts
│   │       ├── user.validation.ts
│   │       └── user.types.ts
│   │
│   ├── middlewares/
│   │   ├── auth.middleware.ts
│   │   ├── rbac.middleware.ts
│   │   ├── error.middleware.ts
│   │   ├── requestId.middleware.ts
│   │   └── rateLimit.middleware.ts
│   │
│   ├── utils/
│   │   ├── ApiError.ts
│   │   ├── asyncHandler.ts
│   │   ├── response.ts
│   │   └── pagination.ts
│   │
│   ├── types/
│   │   ├── express.d.ts
│   │   └── common.types.ts
│   │
│   ├── routes/
│   │   └── index.ts
│   │
│   ├── docs/
│   │   └── swagger.ts
│   │
│   ├── app.ts
│   └── server.ts
│
├── prisma/
│   └── schema.prisma        # PostgreSQL schema
│
├── tests/
│   ├── unit/
│   └── integration/
│
├── .env
├── .env.example
├── tsconfig.json
├── package.json
└── README.md
```

**Data layer**


| Store          | Role                                                    |
| -------------- | ------------------------------------------------------- |
| **PostgreSQL** | Primary source of truth (users, products, orders, etc.) |
| **Redis**      | Cache, sessions, OTP, rate limits, BullMQ queues        |


---



## 1. Core application

```bash
npm install express dotenv cors helmet
npm install @prisma/client ioredis
npm install -D prisma
```


| Package                     | Purpose                      |
| --------------------------- | ---------------------------- |
| `express`                   | HTTP API framework           |
| `@prisma/client` + `prisma` | PostgreSQL ORM / query layer |
| `ioredis`                   | Redis client                 |
| `dotenv`                    | Environment variables        |
| `cors`                      | Cross-origin policy          |
| `helmet`                    | HTTP security headers        |


---



## 2. Authentication

Recommended stack:

```bash
npm install jose argon2 zod express-rate-limit
```



### jose

JWT / JWS / JWE / JOSE functionality.

```text
Login
  ↓
Credentials verified
  ↓
JWT generated
  ↓
Authenticated request
  ↓
JWT verified
```

Prefer `jose` for a modern TypeScript project rather than blindly using `jsonwebtoken`.

### argon2

Password hashing.

```text
password
   ↓
Argon2id
   ↓
passwordHash
   ↓
PostgreSQL
```

Never store:

```json
{ "password": "Manas123" }
```

Store a password hash instead.

### zod

Runtime request validation.

Example payload:

```json
{
  "email": "manas@gmail.com",
  "password": "..."
}
```

Validate before business logic.

### express-rate-limit

Especially important for:

- `/login`
- `/register`
- `/forgot-password`
- `/reset-password`

to reduce brute-force / abuse risk.

---



## 3. Authorization / RBAC

No special RBAC npm package is required.

Implement RBAC yourself — it is an important backend concept for interviews.

### Roles

```text
User    → role: CUSTOMER
Admin   → role: ADMIN
Seller  → role: SELLER
```

Handled in `rbac.middleware.ts`.

### Flow

```text
authenticate()
      ↓
identify user
      ↓
authorize(["ADMIN"])
      ↓
controller
```



### Later: permission-based

- `products:create`
- `products:update`
- `products:delete`
- `orders:read`
- `orders:update`
- `users:manage`

This is closer to how authorization works in real systems.

---



## 4. Logging & observability

For a production application:

```bash
npm install pino pino-http
```



### pino

Structured logging.

Instead of:

```ts
console.log("Order created");
```

prefer structured fields such as:

- `timestamp`
- `requestId`
- `userId`
- `method`
- `route`
- `statusCode`
- `responseTime`
- `error`



### pino-http

HTTP request logging.

Useful with:

- `config/logger.ts`
- `middlewares/requestId.middleware.ts`

---



## 5. API documentation

Use OpenAPI / Swagger.

```bash
npm install swagger-ui-express
```

Eventually expose:

```text
/api-docs
```

where developers can see:

- `POST /auth/login`
- `POST /auth/register`
- `GET /products`
- `GET /products/:id`
- `POST /orders`
- `GET /orders/:id`

For a larger project, keep the OpenAPI specification in the codebase rather than relying on manually maintained docs.

---



## 6. Testing

```bash
npm install -D jest ts-jest @types/jest supertest @types/supertest
```

```text
tests/
├── unit/
└── integration/
```



### Jest

Unit testing.

Example:

```text
UserService
   ↓
test
   ↓
Does registration work?
```



### Supertest

Test actual HTTP APIs:

```text
POST /api/v1/auth/login
```

and verify:

- status → `200`
- body → expected response

---



## 7. File / image uploads

A Flipkart-like application needs:

- Product images
- User profile images
- Seller documents

For local / multipart handling:

```bash
npm install multer
```

Do **not** store product images as blobs in PostgreSQL.

### Production architecture

```text
Frontend
   ↓
Upload
   ↓
Object Storage (S3 / Cloud Storage)
   ↓
URL
   ↓
PostgreSQL
```

For AWS:

```bash
npm install @aws-sdk/client-s3
```

The database stores something like:

```json
{
  "imageUrl": "https://cdn.example.com/product/image.webp"
}
```

not the entire image.

---



## 8. Image optimization

For an e-commerce app with thousands of product images:

```bash
npm install sharp
```

`sharp` can resize / convert / compress images.

```text
original.jpg
     ↓
Sharp
     ↓
WebP / AVIF
     ↓
Object Storage / CDN
```

This can significantly reduce image payload sizes.

---



## 9. Redis / caching

```bash
npm install ioredis
```



### Potential uses

- Caching
- Sessions
- Rate limiting
- OTP storage
- Temporary data
- Distributed locks
- Queues



### Example

```text
GET /products/123
       ↓
    Redis?
   ↙     ↘
 YES      NO
  ↓        ↓
return   PostgreSQL
           ↓
         Redis (cache write)
```

Do not cache everything. Learn where caching actually makes sense.

Typical split:


| PostgreSQL              | Redis               |
| ----------------------- | ------------------- |
| Users, products, orders | Hot product cache   |
| Payments, inventory     | Sessions / OTP      |
| Reviews, categories     | Rate-limit counters |
| Source of truth         | BullMQ job queues   |


---



## 10. Background jobs / queues

Operations that should not block the HTTP request:

```text
Order placed
    ↓
Response immediately
    ↓
Background jobs
    ├── Send email
    ├── Send notification
    ├── Generate invoice
    ├── Update analytics
    └── Process other tasks
```

Recommended stack:

```bash
npm install bullmq
```

with Redis.

### Architecture

```text
API
 ↓
BullMQ
 ↓
Redis
 ↓
Worker
 ↓
Background Job
```

---



## 11. Email

Used for:

- Email verification
- Forgot password
- Order confirmation
- Shipping updates

Do not hardcode SMTP into business logic.

Possible providers:

- AWS SES
- SendGrid
- Resend
- Mailgun



### Preferred architecture

```text
OrderService
     ↓
NotificationService
     ↓
Email Provider
```

Not:

```text
OrderService
     ↓
sendEmail()   ← directly everywhere
```

---



## 12. Payment

Payment is another external service.

Depending on market:

- Razorpay
- Stripe
- PayPal
- Adyen

For India, Razorpay is a common example.

### Architecture

```text
Order
  ↓
Payment Service
  ↓
Payment Provider
  ↓
Webhook
  ↓
Payment verification
  ↓
Order status update
```

Never trust only the frontend payment-success response. The backend must verify payment through the provider / webhook flow.

---



## 13. Search

PostgreSQL can handle basic search (`ILIKE`, full-text search with `tsvector`), but for serious product search you may eventually use:

- Elasticsearch
- or OpenSearch



### Architecture

```text
PostgreSQL
   ↓
Product data
   ↓
Search indexing
   ↓
OpenSearch / Elasticsearch
   ↓
Search API
```



### Features

- Product search
- Autocomplete
- Filters
- Facets
- Ranking
- Brand filtering
- Price filtering
- Category filtering

Do not add Elasticsearch on day one. First make PostgreSQL search work, then understand why a dedicated search engine becomes useful.

---



## 14. Security packages

Besides Helmet and rate limiting, consider:

- `zod`
- `argon2`
- `helmet`
- `cors`
- `express-rate-limit`

And depending on auth architecture:

- CSRF protection

especially if using cookie-based authentication and state-changing browser requests.

Do not blindly install a CSRF package without first deciding the authentication / session model.

---



## 15. TypeScript packages

```bash
npm install -D typescript tsx @types/node @types/express
```

Possibly:

```bash
npm install -D @types/cors
```

depending on package typings / version.

Code will be `.ts`, not `.js`.

---



## 16. Environment / config management



### Development

- `.env`
- `.env.example`

Example variables:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/dailycart
REDIS_URL=redis://localhost:6379
JWT_SECRET=...
```



### Production

- AWS Secrets Manager
- AWS Parameter Store
- Vault
- Kubernetes Secrets

depending on infrastructure.

Never commit:

- `JWT_SECRET`
- `DATABASE_URL` / `DB_PASSWORD`
- `REDIS_URL`
- `STRIPE_SECRET`
- `AWS_SECRET`

into Git.

---



## 17. Target API architecture

For the large e-commerce application:

```text
src/
│
├── config/
│   ├── env.ts
│   ├── database.ts      # PostgreSQL / Prisma
│   ├── redis.ts         # Redis
│   └── logger.ts
│
├── modules/
│   ├── auth/
│   ├── users/
│   ├── products/
│   ├── categories/
│   ├── cart/
│   ├── orders/
│   ├── payments/
│   ├── reviews/
│   ├── inventory/
│   ├── sellers/
│   ├── notifications/
│   └── admin/
│
├── middlewares/
│   ├── auth.middleware.ts
│   ├── rbac.middleware.ts
│   ├── error.middleware.ts
│   ├── validation.middleware.ts
│   ├── rateLimit.middleware.ts
│   └── requestId.middleware.ts
│
├── utils/
│   ├── ApiError.ts
│   ├── asyncHandler.ts
│   ├── response.ts
│   └── pagination.ts
│
├── routes/
│   └── index.ts
│
├── workers/
│   ├── email.worker.ts
│   ├── notification.worker.ts
│   └── order.worker.ts
│
├── app.ts
└── server.ts

prisma/
└── schema.prisma
```

---



## 18. Package stack summary



### Core

- `express`
- `@prisma/client` + `prisma` (PostgreSQL)
- `ioredis` (Redis)
- `dotenv`
- `cors`
- `helmet`



### Authentication

- `jose`
- `argon2`
- `zod`
- `express-rate-limit`



### Logging

- `pino`
- `pino-http`



### Testing

- `jest`
- `ts-jest`
- `supertest`



### Uploads / images

- `multer`
- `sharp`
- `@aws-sdk/client-s3`



### Caching / queues

- `ioredis`
- `bullmq`



### API documentation

- `swagger-ui-express`



### TypeScript

- `typescript`
- `tsx`
- `@types/node`
- `@types/express`





from pathlib import Path

content = r"""# Register API — Step-by-Step Revision (TypeScript + Express + Prisma)

## 1. Architecture to follow

For every API, follow this flow:

```text

Client

  ↓

Route

  ↓

Middleware / Validation

  ↓

Controller

  ↓

Service

  ↓

Prisma / Repository

  ↓

PostgreSQL

  ↓

Response

```

Responsibilities:

- **Route** → URL + HTTP method

- **Validation** → validate request body/query/params

- **Controller** → HTTP layer; gets request data and sends response

- **Service** → business logic

- **Repository** → database access when the project needs a repository layer

- **Prisma** → DB client / queries

- **Middleware** → cross-cutting concerns such as auth, RBAC, rate limiting, errors

---

# 2. User model

`prisma/schema.prisma`

```prisma

model User {

  id           String   @id @default(uuid())

  firstName    String

  lastName     String

  email        String   @unique

  phone        String?  @unique

  passwordHash String

  role         String   @default("USER")

  createdAt    DateTime @default(now())

  updatedAt    DateTime @updatedAt

}

```

After schema changes:

```bash

npx prisma generate

```

For migration-controlled changes, use Prisma migrations carefully.

> Do NOT use `migrate reset` on a database containing important data.

---

# 3. Auth module structure

```text

src/modules/auth/

├── auth.controller.ts

├── auth.routes.ts

├── auth.service.ts

├── auth.types.ts

└── auth.validation.ts

```

With Prisma, `auth.model.ts` is NOT required.

---

# 4. Register input type

`src/modules/auth/auth.types.ts`

```ts

export interface RegisterInput {

  firstName: string;

  lastName: string;

  email: string;

  phone?: string;

  password: string;

}

```

---

# 5. Register validation

`src/modules/auth/auth.validation.ts`

```ts

import { z } from "zod";

export const registerSchema = z.object({

  firstName: z

    .string()

    .trim()

    .min(2, "First name must be at least 2 characters"),

  lastName: z

    .string()

    .trim()

    .min(2, "Last name must be at least 2 characters"),

  email: z

    .string()

    .trim()

    .email("Invalid email address")

    .toLowerCase(),

  phone: z

    .string()

    .trim()

    .optional(),

  password: z

    .string()

    .min(8, "Password must be at least 8 characters"),

});

```

Purpose:

```text

Request body

   ↓

Zod validation

   ↓

Valid data → continue

Invalid data → error

```

---

# 6. Register service

`src/modules/auth/auth.service.ts`

```ts

import argon2 from "argon2";

import { prisma } from "../../config/database.js";

import type { RegisterInput } from "./auth.types.js";

export async function registerUser(input: RegisterInput) {

  const existingUser = await prisma.user.findUnique({

    where: {

      email: [input.email](http://input.email),

    },

  });

  if (existingUser) {

    throw new Error("User with this email already exists");

  }

  const passwordHash = await argon2.hash(input.password);

  const user = await prisma.user.create({

    data: {

      firstName: input.firstName,

      lastName: input.lastName,

      email: [input.email](http://input.email),

      phone: [input.phone](http://input.phone),

      passwordHash,

    },

    select: {

      id: true,

      firstName: true,

      lastName: true,

      email: true,

      phone: true,

      role: true,

      createdAt: true,

    },

  });

  return user;

}

```

Important:

- Never store plain-text passwords.

- Use Argon2 to hash passwords.

- Never return `passwordHash`.

- `email @unique` protects against duplicate emails at DB level too.

---

# 7. Register controller

`src/modules/auth/auth.controller.ts`

```ts

import type { Request, Response } from "express";

import { registerUser } from "./auth.service.js";

import { registerSchema } from "./auth.validation.js";

export async function register(

  req: Request,

  res: Response

) {

  const input = registerSchema.parse(req.body);

  const user = await registerUser(input);

  return res.status(201).json({

    success: true,

    message: "User registered successfully",

    data: user,

  });

}

```

Controller should stay thin.

Do NOT put password hashing, Prisma queries, or business rules directly inside the controller.

---

# 8. Register route

`src/modules/auth/auth.routes.ts`

```ts

import { Router } from "express";

import { register } from "./auth.controller.js";

const router = Router();

[router.post](http://router.post)("/register", register);

export default router;

```

This creates:

```text

POST /register

```

inside the auth router.

---

# 9. API version route

Current project uses versioned routes.

`src/routes/v1/index.ts`

```ts

import { Router } from "express";

import { healthRouter } from "../../modules/health/health.routes.js";

import authRouter from "../../modules/auth/auth.routes.js";

export const v1Router = Router();

v1Router.use(healthRouter);

v1Router.use("/auth", authRouter);

```

---

# 10. Main API route

`src/routes/index.ts`

```ts

import { Router } from "express";

import { API_V1 } from "../constants/paths.js";

import { v1Router } from "./v1";

export const apiRouter = Router();

apiRouter.use(API_V1, v1Router);

```

If:

```ts

API_V1 = "/api/v1"

```

then:

```text

/api/v1

   + /auth

   + /register

```

becomes:

```text

POST /api/v1/auth/register

```

---

# 11. app.ts

The application must mount the API router.

Example:

```ts

import express from "express";

import cors from "cors";

import helmet from "helmet";

import { apiRouter } from "./routes/index.js";

const app = express();

app.use(helmet());

app.use(cors());

app.use(express.json());

app.use(apiRouter);

export default app;

```

Important:

`express.json()` must run before routes that expect JSON request bodies.

---

# 12. Test Register API

### Request

```http

POST [http://localhost:5000/api/v1/auth/register](http://localhost:5000/api/v1/auth/register)

Content-Type: application/json

```

### Body

```json

{

  "firstName": "Manas",

  "lastName": "Kumar",

  "email": "[manas@example.com](mailto:manas@example.com)",

  "phone": "9876543210",

  "password": "Password@123"

}

```

### Expected response

```json

{

  "success": true,

  "message": "User registered successfully",

  "data": {

    "id": "uuid",

    "firstName": "Manas",

    "lastName": "Kumar",

    "email": "[manas@example.com](mailto:manas@example.com)",

    "phone": "9876543210",

    "role": "USER",

    "createdAt": "..."

  }

}

```

`password` and `passwordHash` must NOT be returned.

---

# 13. Register API request lifecycle

```text

POST /api/v1/auth/register

          ↓

routes/index.ts

          ↓

routes/v1/index.ts

          ↓

auth.routes.ts

          ↓

auth.controller.ts

          ↓

registerSchema.parse()

          ↓

auth.service.ts

          ↓

Check existing email

          ↓

Argon2 password hash

          ↓

Prisma user.create()

          ↓

PostgreSQL

          ↓

Controller response

```

---

# 14. How to create ANY new API

Use this checklist.

## Step 1 — Decide endpoint

Example:

```text

POST /api/v1/products

```

Determine:

- HTTP method

- URL

- request body

- query parameters

- path parameters

- response

- authentication required?

- RBAC permission required?

---

## Step 2 — Create module

Example:

```text

src/modules/product/

├── product.controller.ts

├── product.routes.ts

├── product.service.ts

├── product.repository.ts

├── product.validation.ts

└── product.types.ts

```

Repository can be added when database access becomes substantial or you want strict separation.

---

## Step 3 — Define validation

```text

product.validation.ts

```

Validate:

- body

- params

- query

- pagination

- filters

Use Zod.

---

## Step 4 — Define types

```text

product.types.ts

```

Define input/output types that are useful to the application.

---

## Step 5 — Create route

```ts

[router.post](http://router.post)(

  "/",

  authMiddleware,

  permissionMiddleware("product:create"),

  createProduct

);

```

Route should mainly compose:

```text

middleware → controller

```

---

## Step 6 — Create controller

Controller:

```text

1. Read req

2. Validate/receive validated data

3. Call service

4. Return HTTP response

```

Example:

```ts

export async function createProduct(

  req: Request,

  res: Response

) {

  const input = productSchema.parse(req.body);

  const product = await createProductService(input);

  return res.status(201).json({

    success: true,

    data: product,

  });

}

```

---

## Step 7 — Create service

Service contains business logic.

Example:

```text

Check seller

Check category

Check duplicate SKU

Calculate values

Create product

Return product

```

Do NOT put this business logic into the route.

---

## Step 8 — Database access

For simple modules:

```text

Service → Prisma

```

For larger modules:

```text

Service → Repository → Prisma → PostgreSQL

```

---

## Step 9 — Add authentication if required

```text

authMiddleware

```

Authentication answers:

```text

Who are you?

```

---

## Step 10 — Add authorization if required

```text

permissionMiddleware

```

Authorization answers:

```text

What are you allowed to do?

```

Example:

```text

USER

SELLER

ADMIN

```

with permissions such as:

```text

product:read

product:create

product:update

product:delete

```

---

## Step 11 — Add error handling

Production flow:

```text

Controller/Service

      ↓

throw ApiError

      ↓

asyncHandler

      ↓

error.middleware

      ↓

standard JSON error response

```

Do not expose:

- stack traces

- SQL errors

- password information

- internal implementation details

---

## Step 12 — Test the API

Test:

### Success

```text

201 / 200

```

### Validation

```text

400

```

### Unauthenticated

```text

401

```

### Unauthorized

```text

403

```

### Not found

```text

404

```

### Conflict

```text

409

```

### Server error

```text

500

```

---

# 15. Standard API creation template

Whenever you create a new API, think:

```text

1. Endpoint

2. Request/Response contract

3. Validation

4. Route

5. Authentication

6. Authorization

7. Controller

8. Service

9. Repository/Prisma

10. Error handling

11. Tests

12. Documentation

```

---

# 16. Golden rule

Remember:

```text

Route

  → "Which endpoint is this?"

Middleware

  → "Should this request continue?"

Controller

  → "How do I handle the HTTP request?"

Service

  → "What should happen?"

Repository/Prisma

  → "How do I access the database?"

Database

  → "Where is the data stored?"

```

For a production API:

```text

Client

 ↓

Route

 ↓

Middleware

 ↓

Validation

 ↓

Auth

 ↓

RBAC

 ↓

Controller

 ↓

Service

 ↓

Repository

 ↓

Prisma

 ↓

PostgreSQL

```

"""

path = Path("/mnt/data/Register_API_[Revision.md](http://Revision.md)")

path.write_text(content, encoding="utf-8")

print(path)




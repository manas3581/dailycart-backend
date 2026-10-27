# DailyCart Backend Docs

Structured documentation for the Express + TypeScript API.

| Doc | Status | Description |
| --- | --- | --- |
| [architecture.md](./architecture.md) | Living | Stack, folder layout, request lifecycle, conventions |
| [register.md](./register.md) | Implemented | Create-account / register API |
| [login.md](./login.md) | Planned | Cookie auth: access (30m) + refresh (7d) |

## Quick links

- Health: `GET /api/v1/health`
- Register: `POST /api/v1/auth/register`
- Login: `POST /api/v1/auth/login` (cookies; not built yet)
- Refresh: `POST /api/v1/auth/refresh` (planned)
- Logout: `POST /api/v1/auth/logout` (planned)

## How to run

```bash
cd backend
npm install
npx prisma generate
npm run dev
```

Secrets live in `.env` (gitignored). See architecture for required env vars.

# Slooze RBAC Food Ordering App (Full‑Stack)

> Please do not share/distribute this material. All Rights Reserved. — careers@slooze.xyz

A minimal end‑to‑end web app that satisfies the problem statement:
- View restaurants & menu items
- Create order (add food items)
- Place order (checkout & pay) — **ADMIN & MANAGER**
- Cancel order — **ADMIN & MANAGER**
- Update payment method — **ADMIN only**
- **Bonus:** Managers & Members are country‑scoped (India vs America). Admin is org‑wide.

Tech: **Express + Prisma (SQLite)** backend, **Next.js 14** frontend.

## Quickstart

### 1) Backend (API)
```bash
cd server
cp .env.example .env
npm i
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
npm run dev
# API at http://localhost:4000
```

Seeded users (password for all is `password123`):
- Admin (India): `nick@slooze.xyz`
- Manager (India): `carol@slooze.xyz`
- Manager (America): `steve@slooze.xyz`
- Member (India): `thanos@slooze.xyz`, `thor@slooze.xyz`
- Member (America): `travis@slooze.xyz`

### 2) Frontend (Next.js)
```bash
cd client
cp .env.example .env
npm i
npm run dev
# Web at http://localhost:3000
```

### 3) RBAC Matrix

| Function                           | ADMIN | MANAGER | MEMBER |
|------------------------------------|:-----:|:-------:|:-----:|
| View restaurants & menus           |  ✔   |   ✔    |  ✔   |
| Create order (add items)           |  ✔   |   ✔    |  ✔   |
| Place order (checkout & pay)       |  ✔   |   ✔    |  ✖   |
| Cancel order                       |  ✔   |   ✔    |  ✖   |
| Update payment method              |  ✔   |   ✖    |  ✖   |

**Country scoping**: Managers/Members can only see & order from restaurants in their own country; Admin sees all. Managers can only check out/cancel **their own orders** (demo simplification).

## API Overview

Base URL: `http://localhost:4000`

- `POST /auth/login` `{ email, password }` → `{ token }`
- `GET /me` (Bearer) → current user
- `GET /restaurants` (Bearer) → scoped list with embedded menu items
- `GET /restaurants/:id/menu` (Bearer)
- `POST /orders` (Bearer) `{ items:[{menuItemId,quantity}] }` → create (any role)
- `GET /orders/my` (Bearer)
- `POST /orders/:id/checkout` (Bearer, ADMIN|MANAGER) → mock payment success → `PAID`
- `POST /orders/:id/cancel` (Bearer, ADMIN|MANAGER) → `CANCELLED`
- `PATCH /me/payment-method` (Bearer, ADMIN) `{ paymentMethod }`

Import the provided **Postman collection** from `postman/slooze-foodapp.postman_collection.json`.

## Datasets

Seed data lives in `server/prisma/seed.cjs`:
- 4 restaurants (2 India, 2 America) with a few menu items each
- 6 users with roles/country per the spec

## Architecture

- **Auth**: stateless JWT (`Authorization: Bearer <token>`).
- **RBAC**: `requireRole()` middleware enforces route‑level permissions.
- **Country scope**: `countryScope` middleware & query filters; non‑admins restricted to their `country` for reads & actions.
- **DB**: Prisma + SQLite for easy local setup. Can switch to Postgres by changing `DATABASE_URL`.
- **Payment**: mocked in `/orders/:id/checkout` (sets status to `PAID`).

```
client (Next.js) --> server (Express API) --> Prisma --> SQLite (dev.db)
```

## Deployment Notes

- **Backend**: Deploy to Render / Railway / Fly.io. Set env: `DATABASE_URL`, `JWT_SECRET`, `PORT`.
- **Frontend**: Deploy to Vercel. Set `NEXT_PUBLIC_API_BASE` to your API URL.
- For Postgres in prod, create a DB and set `DATABASE_URL` accordingly, then `prisma migrate deploy`.

## Credits

Made for the Slooze food ordering RBAC assignment.

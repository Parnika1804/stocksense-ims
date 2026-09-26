# StockSense IMS

A full-stack B2B inventory and warehouse management system for tracking products, stock levels, receipts, deliveries, internal transfers, and adjustments across multiple warehouses and locations.

---

## Features

- **Authentication** — signup, login with JWT, OTP-based password reset
- **Product catalog** — SKU, category, unit, reorder quantity, per-product alert thresholds
- **Warehouse & location management** — multiple warehouses, named locations with aisle/bay/level
- **Receipts** — draft incoming goods orders, validate to increment stock with destination location per line
- **Deliveries** — draft outgoing orders, validate to decrement stock with source location per line; blocked if insufficient stock
- **Internal transfers** — move stock between locations; blocked if source has insufficient quantity
- **Stock adjustments** — cycle-count corrections with full audit trail; logs a `StockMove` per adjustment
- **Move history** — full ledger of every stock movement with type (incoming / outgoing / transfer), filterable by type and product
- **Dashboard** — live KPIs (low stock, pending receipts/deliveries, scheduled transfers, adjustments) with filters by document type, status, warehouse, location, and product category
- **Status workflow** — Draft → Waiting → Ready → Done / Canceled for receipts, deliveries, and transfers
- **Responsive UI** — dark-themed React SPA with sidebar navigation, collapsible on mobile

---

## Tech Stack

### Backend
| Package | Version |
|---------|---------|
| Node.js | ≥ 18 |
| Express | 5.x |
| TypeScript | 7.x |
| Prisma ORM | 7.x |
| SQLite (better-sqlite3 adapter) | — |
| JSON Web Tokens (jsonwebtoken) | 9.x |
| bcrypt | 6.x |
| Zod | 4.x |

### Frontend
| Package | Version |
|---------|---------|
| React | 19.x |
| Vite | 8.x |
| TypeScript | 6.x |
| Tailwind CSS | 4.x |
| React Router | 7.x |
| Zod | 4.x |

---

## Project Structure

```
stocksense-ims/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma       # Data models
│   │   └── migrations/         # Migration history
│   ├── src/
│   │   ├── routes/             # Express route handlers
│   │   ├── generated/prisma/   # Generated Prisma client
│   │   └── index.ts            # App entry point
│   ├── .env                    # Environment variables
│   └── package.json
└── frontend/
    ├── src/
    │   ├── components/         # Layout, Sidebar, shared UI
    │   ├── context/            # AuthContext
    │   ├── hooks/              # useApi
    │   ├── lib/                # apiFetch helper
    │   └── pages/              # One file per route
    └── package.json
```

---

## Prerequisites

- **Node.js** ≥ 18
- **npm** ≥ 9

---

## Setup

### Backend

```bash
cd stocksense-ims/backend
npm install
```

Create a `.env` file (or edit the existing one):

```env
DATABASE_URL="file:./dev.db"
JWT_SECRET="your-secret-here"
```

Run the database migration and start the dev server:

```bash
npx prisma migrate dev --name init
npm run dev
# → http://localhost:4000
```

### Frontend

```bash
cd stocksense-ims/frontend
npm install
npm run dev
# → http://localhost:5173
```

The frontend expects the backend at `http://localhost:4000`. CORS is pre-configured for this origin.

---

## API Overview

| Group | Method | Path |
|-------|--------|------|
| Health | `GET` | `/health` |
| **Auth** | `POST` | `/auth/signup` |
| | `POST` | `/auth/login` |
| | `POST` | `/auth/forgot-password` |
| | `POST` | `/auth/reset-password` |
| **Products** | `GET / POST` | `/products` |
| | `GET / PUT / DELETE` | `/products/:id` |
| | `GET` | `/products/stock` |
| **Warehouses** | `GET / POST` | `/warehouses` |
| | `GET / PUT / DELETE` | `/warehouses/:id` |
| **Locations** | `GET / POST` | `/locations` |
| | `GET / PUT / DELETE` | `/locations/:id` |
| **Receipts** | `GET / POST` | `/receipts` |
| | `GET` | `/receipts/:id` |
| | `POST` | `/receipts/:id/status` |
| | `POST` | `/receipts/:id/validate` |
| **Deliveries** | `GET / POST` | `/deliveries` |
| | `GET` | `/deliveries/:id` |
| | `POST` | `/deliveries/:id/status` |
| | `POST` | `/deliveries/:id/validate` |
| **Transfers** | `GET / POST` | `/transfers` |
| | `POST` | `/transfers/:id/status` |
| **Adjustments** | `GET / POST` | `/adjustments` |
| **Stock Moves** | `GET` | `/stockmoves` |

All request bodies are validated with Zod. Protected routes expect an `Authorization: Bearer <token>` header.

---

## Status Workflow

Receipts, deliveries, and transfers follow a five-stage lifecycle:

```
Draft → Waiting → Ready → Done
                        → Canceled
```

- **Draft** — created, not yet processed
- **Waiting** — acknowledged, awaiting resources or approval
- **Ready** — cleared for execution
- **Done** — stock mutations applied; cannot be reverted to Draft
- **Canceled** — voided; no stock mutations occur

Transitioning to **Done** on a receipt or delivery triggers the actual stock update (upsert `StockItem`, log `StockMove`). Transfers execute stock movement immediately on creation and land in **Done** by default.

---

## Notes

- **Database** — SQLite file stored at `backend/prisma/dev.db`. Suitable for development; swap the Prisma adapter and `DATABASE_URL` for production use.
- **OTP password reset** — the `/auth/forgot-password` endpoint returns the 6-digit OTP directly in the JSON response (demo mode). In production, replace this with an email delivery service.
- **No production deployment config** — no Docker, reverse proxy, or CI/CD setup is included. The app is intentionally kept simple for local development and evaluation.

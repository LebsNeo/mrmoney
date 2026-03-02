# MrCA — Hospitality Financial Operating System

MrCA is a production-ready financial operating system built for South African hospitality operators. It replaces spreadsheets and fragmented tools with a single platform covering bookings, invoicing, bank reconciliation, OTA payout matching, VAT tracking, revenue forecasting, and real-time KPI dashboards — all designed for guest houses, lodges, and boutique hotels managing one or multiple properties.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, Server Actions) |
| Database | PostgreSQL via [Neon](https://neon.tech) (serverless) |
| ORM | Prisma v7 + `@prisma/adapter-pg` |
| Auth | NextAuth v4 (JWT, credentials) |
| Styling | Tailwind CSS v4 |
| Validation | Zod v4 |
| Language | TypeScript 5 |
| Deployment | Vercel |

---

## Local Setup

### Prerequisites
- Node.js 20+
- A [Neon](https://neon.tech) PostgreSQL database (free tier works)

### 1. Clone

```bash
git clone https://github.com/your-org/mrmoney.git
cd mrmoney
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment

```bash
cp .env.example .env.local
```

Edit `.env.local` and fill in:

```env
DATABASE_URL="postgresql://..."        # Your Neon connection string
NEXTAUTH_SECRET="$(openssl rand -base64 32)"
NEXTAUTH_URL="http://localhost:3000"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### 4. Run database migrations

```bash
npx prisma migrate dev
```

### 5. Seed demo data

```bash
npm run db:seed
```

### 6. Start development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and log in.

---

## Seed Credentials

| Field | Value |
|-------|-------|
| Email | `lebs@sunsethospitality.co.za` |
| Password | `MrCA2025!` |

The seed creates a demo organisation (**Sunset Hospitality Group**) with two properties, multiple rooms, sample bookings, transactions, invoices, and OTA payouts.

---

## Phase Overview

| Phase | Feature |
|-------|---------|
| 1 | Core data models: Organisations, Properties, Rooms, Users |
| 2 | Authentication (NextAuth JWT) + Role-based access |
| 3 | Booking management + Finance Engine (invoices, transactions) |
| 4 | Bank statement import (FNB, ABSA, Nedbank, Standard Bank, Capitec) |
| 5 | Profitability Intelligence (room-level, source-level margins) |
| 6 | KPI Engine (RevPAR, ADR, occupancy, benchmarking, leakage) |
| 7 | OTA Payout Reconciliation (Airbnb, Booking.com CSV import) |
| 8 | Revenue Forecasting + Budget vs Actual + Cash Flow |
| 9 | Production Hardening (security headers, error boundaries, rate limiting, health check, structured logging, input validation) |

---

## API Endpoints

| Route | Description |
|-------|-------------|
| `GET /api/health` | Health check — DB connectivity + version |
| `GET /api/forecast/revenue` | Revenue forecast |
| `GET /api/forecast/cashflow` | Cash flow forecast |
| `GET /api/forecast/budget` | Budget vs actual |
| `GET /api/alerts/count` | Unread alert count |
| `POST /api/import/bank/preview` | Parse bank statement CSV |
| `POST /api/import/quickbooks/preview` | Parse QuickBooks CSV |

---

## Deployment (Vercel + Neon)

### 1. Push to GitHub

```bash
git push origin main
```

### 2. Connect to Vercel

- Import your GitHub repo on [vercel.com](https://vercel.com)
- Framework: **Next.js** (auto-detected)

### 3. Set environment variables in Vercel

In **Project Settings → Environment Variables**, add:

```
DATABASE_URL          = <your Neon connection string>
NEXTAUTH_SECRET       = <openssl rand -base64 32>
NEXTAUTH_URL          = https://your-app.vercel.app
NEXT_PUBLIC_APP_URL   = https://your-app.vercel.app
```

### 4. Deploy

Vercel auto-deploys on every push to `main`. The `build` script runs `prisma generate` automatically.

### Health Check

Vercel can verify your deployment via:
```
GET https://your-app.vercel.app/api/health
```

Expected response:
```json
{ "status": "ok", "db": "connected", "version": "0.1.0", "timestamp": "..." }
```

---

## Development Scripts

```bash
npm run dev          # Start dev server
npm run build        # Build for production
npm run db:migrate   # Run Prisma migrations
npm run db:seed      # Seed demo data
npm run db:studio    # Open Prisma Studio
npx tsc --noEmit     # TypeScript type check
```

---

## Architecture Notes

- **Server Actions** handle all mutations — no REST layer for UI operations
- **Prisma v7** with `PrismaPg` adapter enables Neon serverless compatibility
- **Soft deletes** throughout — `deletedAt` field, nothing is hard-deleted
- **VAT** is tracked on every booking and transaction (South African 15%)
- **Rate limiting** is in-memory per-process (upgrade to Upstash Redis for multi-instance)
- **Security headers** applied globally via `next.config.ts`

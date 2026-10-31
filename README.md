<p align="center">
  <img src="docs/github/logo.png" width="96" height="96" alt="shidro logo"/>
</p>

<h1 align="center">shidro</h1>

<p align="center">
  <strong>Persian-first B2B cargo matching and logistics platform</strong><br/>
  Approved distribution companies request city-to-city loads. Approved drivers accept or reject.<br/>
  Admin owns verification, invoices, live jobs, and the rule book.
</p>

<p align="center">
  <a href="https://github.com/omidram/shidvar"><img alt="GitHub" src="https://img.shields.io/badge/GitHub-omidram%2Fshidvar-181717?style=for-the-badge&logo=github"/></a>
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js_16-000000?style=for-the-badge&logo=nextdotjs&logoColor=white"/>
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white"/>
  <img alt="PostgreSQL" src="https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white"/>
  <img alt="Prisma" src="https://img.shields.io/badge/Prisma-2D3748?style=for-the-badge&logo=prisma&logoColor=white"/>
  <img alt="RTL Persian" src="https://img.shields.io/badge/UI-Persian_RTL-00b562?style=for-the-badge"/>
</p>

<p align="center">
  <a href="#-what-it-is">Product</a> ·
  <a href="#-portals">Portals</a> ·
  <a href="#-architecture">Architecture</a> ·
  <a href="#-quick-start">Quick start</a> ·
  <a href="#-demo-accounts">Demo accounts</a> ·
  <a href="#-windows-exe">Windows EXE</a>
</p>

---

<p align="center">
  <img src="docs/github/hero.png" alt="shidro — night fleet, live matching, emerald tracking" width="100%"/>
</p>

## What it is

shidro is **not** a client-only mock. Persistence is PostgreSQL. Authorization is enforced on the server. Status changes go through state machines. Documents (KYC, invoices, proof of delivery) stay in private storage.

| You get | How |
| --- | --- |
| Three portals | Company (cargo owner / supplier) · Driver · Admin |
| Matching | Weighted supplier + driver scoring, not a dump of every row |
| Live ops | Tracking, POD photo + signature, invoices, disputes, tickets |
| Persian product UI | `fa` + RTL as the default locale |
| One deployable | Next.js App Router UI + versioned `/api/v1` |

<p align="center">
  <img src="docs/github/portals.png" alt="Requester, supplier, driver, and admin portal montage" width="100%"/>
</p>

## Portals

| Portal | Who | Prefix | They do |
| --- | --- | --- | --- |
| **Company** | Cargo owners and suppliers (one role) | `/requester/*` | Post loads (normal or VIP, optional waybill / insurance), track, receive goods |
| **Driver** | Individual drivers | `/driver/*` | Accept jobs (one active load, or same-destination روبار loads), navigate, e-POD, wallet |
| **Admin** | Platform operators | `/admin/*` | Request follow-up info, review and announce loads, coins, invoices, business rules |
| **Public** | Anyone | `/`, `/login`, `/register` | Marketing site + auth |

### Load flow

1. Sign-up asks only for mobile number, national ID, and password. Every new company or driver gets **1000 coins**.
2. Admin asks newly registered accounts for whatever extra info and documents are needed; the user answers from their panel.
3. A company posts a load as **normal** (all drivers in range) or **VIP** (one chosen driver), with optional waybill and insurance.
4. Admin reviews the request and announces it to drivers (or re-targets it while no driver has taken it).
5. A driver with an active load can only accept another load going to the same destination (روبار).

## Architecture

<p align="center">
  <img src="docs/github/architecture.svg" alt="Runtime diagram: four portals, Next.js, PostgreSQL, Redis, files, adapters" width="100%"/>
</p>

```mermaid
flowchart LR
  subgraph clients [Clients]
    R[Requester]
    S[Supplier]
    D[Driver]
    A[Admin]
  end

  subgraph next [Next.js 16]
    P[proxy.ts]
    UI[App Router]
    API["/api/v1 REST"]
  end

  subgraph domain [Domain services]
    M[Matching]
    J[Jobs + POD]
    F[Finance]
    V[Verification]
  end

  PG[(PostgreSQL)]
  RD[(Redis / queues)]
  FS[Private files]

  R --> UI
  S --> UI
  D --> UI
  A --> UI
  UI --> P
  UI --> API
  API --> domain
  domain --> PG
  domain --> RD
  domain --> FS
```

### Commercial path

```mermaid
stateDiagram-v2
  [*] --> DRAFT
  DRAFT --> SUBMITTED
  SUBMITTED --> UNDER_REVIEW
  UNDER_REVIEW --> PUBLISHED
  PUBLISHED --> MATCHING
  MATCHING --> SUPPLIER_RESPONDED
  SUPPLIER_RESPONDED --> SUPPLIER_SELECTED
  SUPPLIER_SELECTED --> TRANSPORT_PENDING
  TRANSPORT_PENDING --> TRANSPORT_ASSIGNED
  TRANSPORT_ASSIGNED --> PICKUP_SCHEDULED
  PICKUP_SCHEDULED --> IN_TRANSIT
  IN_TRANSIT --> DELIVERED
  DELIVERED --> RECEIVED
  RECEIVED --> COMPLETED
```

### Stack

| Layer | Choice |
| --- | --- |
| UI | Next.js 16 App Router, React 19, Tailwind, Radix |
| Forms | React Hook Form + Zod (same schemas on the server) |
| Data | PostgreSQL + Prisma |
| Jobs | Redis / BullMQ with an in-memory local fallback |
| Auth | Opaque session + rotating refresh in HttpOnly cookies |
| Maps | OSM-compatible geocode + Haversine |
| Pay | Provider interface (Zarinpal adapter in demo) |

Read these before changing domain behavior:

- [Architecture](docs/ARCHITECTURE.md)
- [Database](docs/DATABASE.md)
- [Business rules](docs/BUSINESS_RULES.md)
- [Security](docs/SECURITY.md)
- [API](docs/API.md)
- [Permissions](docs/PERMISSIONS.md)
- [Routes](docs/ROUTES.md)
- [Decisions](docs/DECISIONS.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Testing](docs/TESTING.md)

## Quick start

**Requirements:** Node.js 20+, PostgreSQL on port `5433` (`npm run db:up` if Docker is not installed). Docker is optional.

```bash
cp .env.example .env
npm install
npm run db:up
```

Leave `db:up` running, then in another terminal:

```bash
npm run db:push
npm run db:seed
npm run dev
```

Open [http://localhost:5500](http://localhost:5500)

If Docker Desktop is installed you can use `docker compose up -d` instead of `npm run db:up`.

### Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Next.js on port 5500 |
| `npm run worker` | Background jobs |
| `npm run build` | Production build (`output: standalone`) |
| `npm run start` | Apply schema hotfix then start standalone on port 5500 |
| `npm run db:ensure` | Add missing columns (`isSpecial`, `loadType`, …) without wiping data |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test` | Unit tests |
| `npm run test:e2e` | Playwright |
| `npm run db:up` | Local PostgreSQL on 5433 |
| `npm run db:push` | Apply Prisma schema |
| `npm run db:seed` | Demo seed (blocked in real production unless `SHIDVAR_DEMO=1`) |
| `npm run package:win` | Build a portable Windows EXE |

### Production deploy

After pulling a release that changes Prisma schema:

```bash
npm install
npm run db:ensure
npm run build
npm run start
```

`npm run start` runs `db:ensure` first, then `node .next/standalone/server.js` (required when `output: "standalone"` is set). Do **not** use plain `next start` on this build.

## Accounts

A normal seed creates only the platform operator. Companies and drivers register themselves. There is no list of suggested users on the login page.

| Portal | Email | Password |
| --- | --- | --- |
| Admin | `shidroadmin` | `123shidroadmin123` |

Set `SHIDVAR_DEMO=1` only when you intentionally want the old sample companies, drivers, and loads.

## Windows EXE

`npm run package:win` produces a single file:

`dist/Shidro.exe`

Copy **only that file** to another Windows 10/11 x64 PC. Double-click it (do **not** use Run as administrator). It unpacks Node + a seeded Postgres cluster and opens `http://127.0.0.1:5500`.

If a previous run was elevated, delete `%LOCALAPPDATA%\ShidroDesktop` and try again.

## Health

- `GET /health` — process up
- `GET /health/ready` — database reachable

## Repo layout

```text
src/app              portals + public site (App Router)
src/server           domain services, auth, jobs, HTTP router
src/components       design system + logistics visuals
prisma               schema + seed
docs                 architecture of record
scripts              db:up, Windows packager
docs/github          README art
```

<p align="center"><sub>Built as a production-shaped demo — server-enforced RBAC, not localStorage theatre.</sub></p>

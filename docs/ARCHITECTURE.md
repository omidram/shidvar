# Shidvar Platform Architecture

Shidvar is a multi-tenant B2B procurement, matching, and logistics platform. It connects requesters (chain stores and purchasing organizations), suppliers, carriers/drivers, and platform administrators.

This document is the system-of-record for architecture decisions. Implementation must follow it. Business defaults that can change without a schema migration live in `docs/BUSINESS_RULES.md`.

## 1. Current baseline

The previous application was a Next.js UI demo:

- Client-side Ant Design pages
- Mock users in `localStorage`
- IndexedDB as a faux database
- No server-side authorization, matching, documents, or audit trail

That baseline is **not** extended. The production system uses PostgreSQL, server-side RBAC, and four portals on `/api/v1`. Remaining work is finance, realtime notifications, disputes/ratings, and production hardening — not rebuilding the commercial path.

## 2. Technology decisions

| Concern | Choice | Why |
| --- | --- | --- |
| Frontend | Next.js 16 App Router, React 19, TypeScript, Tailwind CSS | Already the project runtime. App Router gives colocated UI + API. Next.js 16 uses `proxy.ts` (middleware is deprecated). |
| UI kit | Internal design system in the shadcn style (Radix + Tailwind) | Shared across four portals. Ant Design is removed. |
| Forms / validation | React Hook Form + Zod | Same schemas on client and server. Server never trusts the client. |
| Data fetching | TanStack Query for portal screens; native `fetch` for auth bootstrap | Cache, retries, and no ad-hoc polling for lists. |
| i18n | Cookie locale (`en` / `fa`) + JSON catalogs, no URL prefix | Spec routes stay `/supplier/dashboard`, not `/fa/supplier/dashboard`. `dir=rtl` for `fa`. |
| Backend | Modular domain services inside the Next.js server | One deployable for v1. Domain folders are extractable to NestJS later if traffic or team boundaries require it. |
| HTTP API | REST `/api/v1/*` via a versioned router | Consistent envelope, OpenAPI generation from route metadata. |
| Database | PostgreSQL 16 + Prisma | Relational integrity, transactions, row locks, indexes. |
| Cache / jobs | Redis + BullMQ (in-memory fallback in local dev only) | Matching, expiration, notifications must not block HTTP. |
| Object storage | `FileService` abstraction; local disk in dev, S3-compatible in prod | Private documents, signed URLs, no public bucket for KYC or POD. |
| Auth | Opaque session + rotating refresh token in HttpOnly cookies | Revocable sessions, lockout, no JWT-as-session anti-pattern. |
| Passwords | bcrypt (cost 12) | Portable on Windows/Linux without native Argon2 build issues. |
| Realtime | Redis pub/sub + Server-Sent Events | Fits Next.js; WebSocket adapter interface exists for later. |
| Maps | `GeoProvider` interface; Haversine + OSM Nominatim-compatible geocode | Not coupled to Google/Mapbox. |
| Payments | `PaymentProvider` interface; `Manual` adapter first | Invoices and settlements work without a PSP. |
| Email / SMS / push | Provider interfaces + console adapters in development | Swappable without domain changes. |

Monorepo (`apps/web`, `apps/api`) is **deferred**. Domain modules already isolate business logic. Split when a second runtime (mobile BFF, dedicated worker cluster) is required.

## 3. Runtime architecture

```text
Browser (four portals + public site)
    │  HTTPS, HttpOnly cookies
    ▼
Next.js 16
 ├── proxy.ts          cookie presence + locale + security headers (not authorization)
 ├── App Router pages  RSC + client islands
 └── /api/v1/*         REST router
         │
         ▼
Domain services (src/server/domains/*)
         │
         ├── PostgreSQL (Prisma, transactions)
         ├── Redis (rate limit, cache, pub/sub, BullMQ)
         ├── FileService (private object storage)
         └── Adapters (mail, sms, push, maps, payments)
```

Background worker (`src/server/jobs`) consumes BullMQ queues:

- `matching.suppliers`
- `matching.drivers`
- `notifications.dispatch`
- `expiration.scan`
- `reports.generate`
- `documents.process`

HTTP handlers enqueue work and return. They never run matching or mail inline except in test mode.

## 4. Portals

| Portal | Audience | Route prefix |
| --- | --- | --- |
| Public | Anonymous | `/`, `/login`, `/register`, … |
| Requester | Stores / purchasing orgs | `/requester/*` |
| Supplier | Supply companies | `/supplier/*` |
| Driver | Individual drivers (mobile-first) | `/driver/*` |
| Carrier | Fleet operators (phase 5+) | `/carrier/*` |
| Admin | Platform staff | `/admin/*` |

A user authenticates once. Portal access is derived from **memberships + platform roles + verification status**. A platform admin does not become a supplier by opening `/supplier`.

Independent drivers receive an auto-created carrier company of type `CARRIER` with a single membership so tenancy stays uniform.

## 5. Domain modules

Business logic lives under `src/server/domains/<module>` with no imports from React.

| Module | Responsibility |
| --- | --- |
| `identity` | Users, credentials, sessions, verification tokens, lockout |
| `tenancy` | Companies, memberships, stores, warehouses, addresses |
| `rbac` | Roles, permissions, impersonation gates |
| `catalog` | Products, categories, units, currencies |
| `suppliers` | Supplier profile, products, capacity, areas, certifications |
| `fleet` | Drivers, carriers, vehicles, operating areas, availability |
| `procurement` | Requests, items, publish, expiration, cancellation |
| `matching` | Configurable scoring engines (supplier + driver) |
| `offers` | Supplier offers, comparison, accept/reject |
| `orders` | Commercial order after accepted offer |
| `logistics` | Transport jobs, applications, assignment, shipments, POD |
| `documents` | Metadata + FileService |
| `finance` | Invoices, payments, commissions, settlements |
| `comms` | Notifications, preferences, messaging, support tickets |
| `quality` | Ratings, disputes |
| `audit` | Immutable audit log writer/reader |
| `settings` | System settings and business rules |
| `reports` | Aggregations and exports |

State machines live in `src/server/state-machines` and are the only legal status writers.

## 6. Multi-tenancy and data ownership

Tenancy is **shared database, company-scoped rows**.

- Every tenant entity has `companyId` (or a parent that does).
- Platform operators have `CompanyType.PLATFORM` and permissions, not a wildcard in Prisma.
- Domain queries take an `Actor` (`userId`, `companyIds`, `permissions`, `driverId?`).
- “List all requests” for a supplier means **marketplace rows the matcher published to them**, never another supplier’s drafts or offers.
- Drivers receive a **redacted DTO** until the job reaches `SUPPLIER_CONFIRMED` or later. The API omits exact addresses, contacts, and documents. UI hiding is not sufficient.

Row-level checks run in the service layer on every read and write.

## 7. Authentication and session model

1. Register with email **or** phone, password, and intended portal.
2. Password hashed with bcrypt. Never logged.
3. Email/phone verification tokens (hashed at rest). Development seed users are pre-verified.
4. Login issues:
   - `sc_session` — opaque access session, 30 minutes idle sliding window (configurable)
   - `sc_refresh` — rotating refresh token, 14 days, family revoked on reuse
5. Failed logins increment a counter; after N failures the account locks until `lockedUntil`.
6. Logout revokes the session family.
7. Optional TOTP 2FA: schema and challenge flow exist; enrollment is admin-configurable and off by default.
8. Password reset uses single-use hashed tokens with expiry.

Authorization is **permission-based**. Roles are bundles of permissions. Custom company roles are allowed; system roles cannot be deleted.

## 8. Notification architecture

```text
Domain event  →  NotificationService.enqueue(event)
              →  BullMQ notifications.dispatch
              →  Preference filter
              →  Channel adapters (in-app, email, sms, push)
              →  Redis pub/sub  →  SSE /notifications/stream
```

Users own `NotificationPreference` rows per event type and channel. Critical security events (password reset, suspension) cannot be fully disabled.

## 9. Matching engine

Matching is a **pure function** plus a persistence/notification wrapper.

Hard filters (ineligible → score 0, not notified):

- Verification status must be `APPROVED`
- Entity not suspended/blocked
- Product/category compatibility
- Capacity vs requested min quantity (unless partial offers are enabled)
- Operating area overlap
- Required certifications
- Vehicle type/capacity/equipment for drivers
- Availability window

Soft scores (0–1 each), weighted by admin-configurable `business_rules` keys, normalized to 0–100. Weights are **not** hardcoded in call sites.

Results persist as `SupplierMatch` / `DriverMatch` with a JSON breakdown for explainability.

## 10. Frontend architecture

- Route groups: `(public)`, `(auth)`, `requester`, `supplier`, `driver`, `admin`
- Each portal has a layout that enforces portal access via server session
- Shared components in `src/components/ui` and `src/components/domain`
- Portal-specific widgets may not import another portal’s pages
- Driver portal is a distinct, simpler, mobile-first shell
- All copy goes through `t(key)`; no hardcoded user-facing English/Persian strings in components

## 11. Deployment architecture

See `docs/DEPLOYMENT.md`.

Local: Docker Compose (Postgres, Redis, MinIO) + `next dev`.

Production: containerized Next.js, separate worker process (`npm run worker`), managed Postgres, Redis, S3-compatible storage, reverse proxy with TLS. CI runs lint, typecheck, unit tests, and Prisma migrate deploy.

## 12. Implementation roadmap

| Milestone | Outcome | Status |
| --- | --- | --- |
| M0 | Architecture, schema, state machines, security model | Done |
| M1 | Docker, Prisma, auth, RBAC, health, seed, i18n shell, four dashboards | Done (portals on real API) |
| M2 | Companies, stores, warehouses, supplier/driver onboarding, admin verification | API + verification UI done |
| M3 | Procurement requests, marketplace, matching, offers, comparison, accept | API + requester/supplier UI done |
| M4 | Transport jobs, driver marketplace, assignment, info release, shipment lifecycle, POD, partials | API + driver/supplier UI done |
| M5 | Documents, invoices, commissions, manual payments | Later |
| M6 | Notifications, SSE, messaging, tickets | Later |
| M7 | Disputes, ratings, cancellations with penalties | Later |
| M8 | Admin analytics, reports export, audit UI, business rules UI | Audit + rules UI started |
| M9 | Test hardening, CI, production Docker, backups, monitoring | Later |

Each milestone must leave `npm run dev`, `npm run typecheck`, and `npm run test` green.

## 13. OpenAPI and versioning

- All product APIs are under `/api/v1`.
- Breaking changes require `/api/v2`.
- Route metadata (Zod in/out, permissions, examples) generates OpenAPI at `/api/v1/openapi.json`.

## 14. What we will not do in v1

- Live GPS tracking of drivers (schema supports last-known point; continuous tracking is a later integration)
- Built-in payment capture (Stripe/local PSPs) — recording and settlement only
- Native mobile apps — the driver portal is the mobile client; APIs are mobile-ready
- Automatic legal invoice tax engines per country — tax rate is configurable per invoice

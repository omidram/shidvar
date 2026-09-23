# API architecture

Base path: `/api/v1`

Envelope:

```json
{ "success": true, "data": {}, "message": null, "meta": {} }
```

Error:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request",
    "fields": { "email": ["Required"] }
  }
}
```

`meta` is used for pagination: `{ page, pageSize, total, cursor }`. Lists are paginated (default 20, max 100).

Auth: session cookie. `GET /api/v1/auth/me` returns the actor. Unauthenticated calls receive `401 AUTH_REQUIRED`.

OpenAPI: `GET /api/v1/openapi.json`

Health (unversioned): `GET /health` liveness, `GET /health/ready` checks DB.

## Identity

| Method | Path | Auth | Permission |
| --- | --- | --- | --- |
| POST | `/auth/register` | no | |
| POST | `/auth/login` | no | |
| POST | `/auth/logout` | yes | |
| POST | `/auth/refresh` | refresh cookie | |
| POST | `/auth/forgot-password` | no | |
| POST | `/auth/reset-password` | no | |
| POST | `/auth/verify-email` | no | |
| POST | `/auth/verify-phone` | no | |
| GET | `/auth/me` | yes | |
| PATCH | `/auth/me` | yes | |
| POST | `/auth/change-password` | yes | |
| GET | `/users` | yes | `users.read` |
| PATCH | `/users/:id/status` | yes | `users.suspend` |

## Tenancy and master data

| Method | Path | Permission |
| --- | --- | --- |
| GET/POST | `/companies` | `companies.read` / `companies.create` |
| GET/PATCH | `/companies/:id` | `companies.read` / `companies.update` |
| POST | `/companies/:id/verify` | `companies.verify` |
| GET/POST | `/stores` | `stores.read` / `stores.create` |
| GET/POST | `/warehouses` | `warehouses.read` / `warehouses.create` |
| GET/POST | `/addresses` | scoped |
| GET | `/geo/areas` | authenticated |
| GET/POST | `/products` | `products.read` / `products.manage` |
| GET/POST | `/categories` | `products.read` / `categories.manage` |

## Supply and fleet

| Method | Path | Permission |
| --- | --- | --- |
| GET/PATCH | `/suppliers/me` | supplier membership |
| GET/POST | `/suppliers/me/products` | `supplier_products.manage` |
| GET | `/admin/suppliers` | `suppliers.read` |
| POST | `/admin/suppliers/:id/verify` | `suppliers.verify` |
| GET/PATCH | `/drivers/me` | driver |
| POST | `/drivers/me/vehicles` | driver |
| GET | `/admin/drivers` | `drivers.read` |
| POST | `/admin/drivers/:id/verify` | `drivers.verify` |
| GET/POST | `/vehicles` | `vehicles.read` / `vehicles.manage` |

## Procurement

| Method | Path | Permission |
| --- | --- | --- |
| GET/POST | `/requests` | `requests.read` / `requests.create` |
| GET/PATCH | `/requests/:id` | `requests.read` / `requests.update` |
| POST | `/requests/:id/submit` | `requests.update` |
| POST | `/requests/:id/publish` | `requests.review` or owner if rule |
| POST | `/requests/:id/cancel` | `requests.cancel` |
| GET | `/marketplace/requests` | `marketplace.supplier.read` |
| GET | `/requests/:id/matches` | owner or admin |
| GET/POST | `/requests/:id/offers` | offers.* |
| POST | `/offers/:id/submit` | `offers.create` |
| POST | `/offers/:id/accept` | `offers.accept` |
| POST | `/offers/:id/reject` | `offers.reject` |
| GET | `/offers/:id/compare` | requester owner |

## Orders and logistics

| Method | Path | Permission |
| --- | --- | --- |
| GET | `/orders` | `orders.read` |
| GET | `/orders/:id` | `orders.read` |
| POST | `/orders/:id/cancel` | `orders.cancel` |
| GET | `/marketplace/jobs` | `marketplace.driver.read` |
| GET | `/jobs/:id` | redacted serializer |
| POST | `/jobs/:id/apply` | `jobs.apply` |
| POST | `/jobs/:id/select-driver` | `jobs.assign` |
| POST | `/jobs/:id/confirm-driver` | `jobs.confirm` |
| POST | `/jobs/:id/status` | `jobs.update_status` |
| POST | `/shipments/:id/pod` | assigned driver |
| POST | `/shipments/:id/confirm-delivery` | requester |
| GET | `/shipments/:id` | parties |

## Documents, finance, quality, admin

| Method | Path | Permission |
| --- | --- | --- |
| POST | `/documents` | `documents.upload` |
| GET | `/documents/:id` | `documents.read` + tenancy |
| GET | `/documents/:id/url` | signed URL |
| GET/POST | `/invoices` | `invoices.read` / `invoices.manage` |
| POST | `/payments` | `payments.manage` |
| GET | `/notifications` | self |
| PATCH | `/notifications/:id/read` | self |
| GET | `/notifications/stream` | SSE, self |
| GET/POST | `/conversations` | `messages.*` |
| GET/POST | `/tickets` | `tickets.*` |
| POST | `/ratings` | `ratings.create` |
| GET/POST | `/disputes` | `disputes.*` |
| GET | `/admin/dashboard` | `analytics.read` |
| GET | `/admin/audit-logs` | `audit_logs.read` |
| GET/PATCH | `/admin/business-rules` | `business_rules.manage` |
| GET | `/reports/:type` | `reports.read` |

Idempotency: mutating logistics/finance endpoints accept `Idempotency-Key`. Keys stored hashed for 24h.

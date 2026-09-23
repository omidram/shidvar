# Security model

Authorization is enforced on the server for every API and server-rendered portal. The UI may hide actions; it is not a control.

## Threat model (v1)

- Cross-tenant data reads (supplier A reads supplier B)
- Privilege escalation (driver self-approves, requester publishes as admin)
- Premature PII/address release to unmatched drivers
- Session theft and fixation
- Brute-force login
- Malicious file upload
- Race on job assignment and offer acceptance
- Audit log tampering

## Authentication

- Passwords: bcrypt cost 12, never returned, never logged
- Sessions: opaque 32-byte tokens, SHA-256 at rest, HttpOnly / SameSite=Lax / Secure in production / Path=/
- Refresh rotation: reuse of a revoked family member revokes the whole family
- CSRF: SameSite cookies + `Origin`/`Host` check on mutating `/api/v1` requests
- Rate limits: login, register, reset, OTP — Redis when available
- Lockout after failed logins (configurable)
- Session revocation on logout, password change, admin force-logout
- 2FA: TOTP secret encrypted at rest when enabled; not required by default

## Authorization

Every handler declares `auth` and optional `permissions[]`.

`Actor` is loaded once per request:

- `userId`, `status`
- `permissions: Set<string>`
- `memberships: { companyId, type, status }[]`
- `driverProfileId`, `isPlatformStaff`

Platform staff permissions still need an explicit code (`requests.cancel`, not “is admin”).

`SUPER_ADMIN` is the only role that receives all permissions at seed time. Other admin roles are subsets.

### Tenant isolation algorithm

1. Resolve target entity and its `companyId` (or related companies: requester, supplier, carrier).
2. If actor is platform staff with the resource permission, allow (still log).
3. Else actor must have an ACTIVE membership on an allowed company for that operation.
4. Else if actor is a driver, allow only entities linked to their assigned/applied jobs, with redaction rules.
5. Else 404 (not 403) for cross-tenant reads to avoid existence leaks on private ids; 403 when the resource is known to the user but forbidden (e.g. wrong permission on own company).

### Information release

`TransportationJob.detailsReleasedAt` is set only on `SUPPLIER_CONFIRMED`. Mapper `toDriverJobDto` is the single serializer drivers go through.

## File security

- Validate size, extension, and MIME (sniff, not client Content-Type alone)
- Store outside public/ with random keys
- Signed GET URLs, short TTL
- Virus scanning hook (no-op adapter in v1)
- KYC and POD documents are never world-readable

## Input / output

- Zod on all bodies and query params
- Prisma parameterized queries only
- HTML is not rendered from user content without escaping (React default)
- Security headers from `proxy.ts`: `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy`
- CSP documented in production nginx/CDN; Next.js assets allowed

## Impersonation

Requires `users.impersonate`, a written reason, maximum duration, banner on the UI (`x-impersonated-by` cookie pair), and an audit row that cannot be deleted. Impersonator cannot disable audit or impersonate `SUPER_ADMIN`.

## Privacy

- Data minimization in driver pre-confirm views
- Personal documents access audited
- Account deactivation: status `DEACTIVATED`, sessions revoked, PII export endpoint (`users.export` self-service architecture)
- Retention: audit logs are not user-deletable

## Secrets

Environment only. `.env` is gitignored. `.env.example` has placeholders. Never send secrets to the client bundle (`NEXT_PUBLIC_*` only for map style URLs and similar).

# Testing

## Layers

| Layer | Tool | What |
| --- | --- | --- |
| Unit | Vitest | State machines, matching, commission, permissions, redaction, cancellation policy |
| Integration | Vitest + Prisma | Auth, request publish, offer accept, driver assign (test database) |
| E2E | Playwright | Happy-path workflow in the definition of done |

## Commands

```bash
npm run test
npm run test:watch
npm run test:e2e
```

Integration tests require `DATABASE_URL` pointing at a disposable database. CI creates one via Compose.

## Must-cover unit tests (M1+)

- Every illegal status transition throws
- Supplier matching weights change output
- Unapproved supplier score is filtered
- Driver DTO redacts street before confirm and reveals after
- Commission percent and fixed fee
- Permission matrix denies cross-role actions
- Concurrent assignment helper: second `updateMany` count is 0

## E2E happy path (M9, stubs from M3)

Store registration → supplier registration → admin approval → request → match → offer → accept → transport match → driver apply → confirm → pickup → POD → complete → rating.

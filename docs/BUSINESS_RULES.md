# Business rules and state machines

Rules that are not hardcoded live in `BusinessRule` rows (admin UI). Code reads them through `src/server/settings/rules.ts` with typed defaults.

## Recommended defaults (also seed data)

| Key | Default | Meaning |
| --- | --- | --- |
| `matching.supplier.weights` | see matching section | Score weights |
| `matching.driver.weights` | see matching section | Score weights |
| `matching.minScoreToNotify` | `40` | Below this, eligible but not notified |
| `offers.maxValidityHours` | `72` | Cap on supplier-chosen validity |
| `offers.allowPartialQuantity` | `true` | Offer qty may be in [min, max] |
| `requests.autoPublish` | `false` | SUBMITTED goes to UNDER_REVIEW, not PUBLISHED |
| `requests.closeAfterDeadlineHours` | `0` | Close when delivery date passed + N hours |
| `jobs.opportunityExpiryMinutes` | `30` | Unanswered driver opportunity |
| `jobs.requireSupplierConfirm` | `true` | Driver selected ≠ information released |
| `fulfillment.singleWinner` | `true` | One accepted offer per request |
| `commission.supplier.percent` | `2.5` | Of merchandise total |
| `commission.transport.percent` | `5` | Of transport total |
| `auth.maxFailedLogins` | `5` | Then lock |
| `auth.lockoutMinutes` | `15` | |
| `auth.sessionMinutes` | `30` | |
| `auth.refreshDays` | `14` | |
| `cancellation.loadedRequiresAdmin` | `true` | |
| `documents.maxUploadMb` | `20` | |
| `pod.requireSignature` | `true` | |
| `pod.requirePhoto` | `true` | |

## A. Procurement request

```text
DRAFT → SUBMITTED → UNDER_REVIEW → PUBLISHED → MATCHING
MATCHING → SUPPLIER_RESPONDED → SUPPLIER_SELECTED → TRANSPORT_PENDING
TRANSPORT_PENDING → TRANSPORT_ASSIGNED → PICKUP_SCHEDULED → IN_TRANSIT
IN_TRANSIT → DELIVERED → RECEIVED → COMPLETED

From most non-terminal states → CANCELLED (rule-dependent)
From in-fulfillment states → DISPUTED
```

| From | To | Who | Guard |
| --- | --- | --- | --- |
| DRAFT | SUBMITTED | Requester | ≥1 item, destination, delivery date |
| DRAFT | CANCELLED | Requester | |
| SUBMITTED | UNDER_REVIEW | System / admin | If `requests.autoPublish=false` |
| SUBMITTED | PUBLISHED | System / admin | If auto-publish or admin publish |
| UNDER_REVIEW | PUBLISHED | Admin `requests.review` | |
| UNDER_REVIEW | CANCELLED | Admin or requester | |
| PUBLISHED | MATCHING | System | After enqueue matching |
| MATCHING | SUPPLIER_RESPONDED | System | First submitted offer |
| MATCHING | CANCELLED | Requester / admin | Before any accepted offer |
| SUPPLIER_RESPONDED | SUPPLIER_SELECTED | Requester | Accept offer |
| SUPPLIER_RESPONDED | MATCHING | System | All offers rejected/expired and still open |
| SUPPLIER_SELECTED | TRANSPORT_PENDING | System | Job created |
| TRANSPORT_PENDING | TRANSPORT_ASSIGNED | System | Driver confirmed |
| TRANSPORT_ASSIGNED | PICKUP_SCHEDULED | System | Job scheduled |
| PICKUP_SCHEDULED | IN_TRANSIT | System | Shipment LOADED/IN_TRANSIT |
| IN_TRANSIT | DELIVERED | System | POD submitted |
| DELIVERED | RECEIVED | Requester | Delivery accepted or partial |
| RECEIVED | COMPLETED | System | No open remainder/dispute |
| * | DISPUTED | Party / admin | Open dispute linked |
| * | CANCELLED | See cancellation | |

Invalid transitions throw `INVALID_STATE_TRANSITION`. Prisma updates use `where: { id, status: from, version }` so concurrent actors cannot skip states.

## B. Supplier offer

`DRAFT → SUBMITTED → UNDER_REVIEW? → ACCEPTED | REJECTED | EXPIRED | CANCELLED`

- SUBMITTED is allowed only if request is `MATCHING` or `SUPPLIER_RESPONDED`.
- Supplier must be APPROVED and matched (or marketplace-visible if admin allows open market).
- Quantity in `[item.minQuantity, item.maxQuantity]`.
- Price ≥ 0, currency = request currency.
- Validity ≤ `offers.maxValidityHours`.
- Unique active offer per (request, supplier) — new submit supersedes DRAFT only.
- EXPIRED is set by the expiration worker, not by clients.
- ACCEPTED is requester-only; in a transaction: lock request, reject sibling offers if `singleWinner`, create order + job.

## C. Order

`CREATED → CONFIRMED → AWAITING_TRANSPORT → IN_FULFILLMENT → DELIVERED → COMPLETED`

Also `PARTIALLY_FULFILLED`, `CANCELLED`, `DISPUTED`.

Created only from an accepted offer. Totals are snapshotted; later catalog price changes do not mutate the order.

## D. Transportation job

```text
CREATED → MATCHING → OFFERED_TO_DRIVERS → DRIVER_APPLIED → DRIVER_SELECTED
→ SUPPLIER_CONFIRMED → SCHEDULED → DRIVER_ASSIGNED
→ ARRIVING_AT_PICKUP → AT_PICKUP → LOADING → LOADED
→ IN_TRANSIT → ARRIVING_AT_DESTINATION → AT_DESTINATION → UNLOADING
→ DELIVERED → PROOF_SUBMITTED → CONFIRMED → COMPLETED
```

Plus `CANCELLED`, `DISPUTED`.

| Transition | Actor | Notes |
| --- | --- | --- |
| CREATED → MATCHING | System | |
| MATCHING → OFFERED_TO_DRIVERS | System | After matches persist |
| OFFERED_TO_DRIVERS → DRIVER_APPLIED | Driver | Application row |
| DRIVER_APPLIED → DRIVER_SELECTED | Supplier or logistics admin | Race-safe updateMany |
| DRIVER_SELECTED → SUPPLIER_CONFIRMED | Supplier (or requester if rule says so) | **Information release gate** |
| SUPPLIER_CONFIRMED → SCHEDULED / DRIVER_ASSIGNED | System | |
| Statuses through UNLOADING | Assigned driver | Sequential; cannot skip LOADING → IN_TRANSIT |
| DELIVERED → PROOF_SUBMITTED | Driver | POD required |
| PROOF_SUBMITTED → CONFIRMED | Requester | Resolution enum |
| CONFIRMED → COMPLETED | System | Remainder resolved |

Two drivers cannot both be selected: `updateMany` where `assignedDriverId` is null and status in `(OFFERED_TO_DRIVERS, DRIVER_APPLIED)`. Unique `DriverApplication(jobId, driverId)`.

## E. Shipment

Mirrors execution of a confirmed job. Created at `SUPPLIER_CONFIRMED`. Tracking number allocated from `NumberSequence`.

## F. Invoice

`DRAFT → ISSUED → SENT → PARTIALLY_PAID → PAID` with `VOID`, `OVERDUE`, `CANCELLED`.

Issued when order is CONFIRMED (merchandise) and/or when job is CONFIRMED (transport), depending on rules.

## G. Payment

`PENDING → PROCESSING → COMPLETED | FAILED | CANCELLED` and `COMPLETED → REFUNDED`.

Manual adapter marks COMPLETED only from users with `payments.manage`.

## H. Dispute

`OPEN → UNDER_REVIEW → WAITING_FOR_INFORMATION → RESOLVED | REJECTED → CLOSED`

Opening a dispute from an active shipment moves job/order/request to `DISPUTED` without deleting logistics history.

## Information release

Before `SUPPLIER_CONFIRMED`, driver DTOs include only:

- Cargo category and total weight/volume band
- Pickup **area** (city/zone), not street
- Delivery **area**, not street
- Window (date, not exact dock time if requester marked exact time sensitive)
- Vehicle requirements, estimated distance, compensation band

After confirmation, the same endpoints return full addresses, contacts, documents, and exact times. Direct queries for `Address` by id still require job assignment + released flag.

## Partial delivery

`ShipmentItem.deliveredQuantity` vs `requestedQuantity`. Remainder `remainingQuantity` with `remainingDisposition`: `PENDING | DELIVER_LATER | CANCELLED | REASSIGNED | DISPUTED`.

`DELIVER_LATER` may spawn a follow-up job; it does not silently close the order.

## Cancellation

| Phase | Requester | Supplier | Driver | Penalty |
| --- | --- | --- | --- | --- |
| DRAFT / SUBMITTED | Yes, reason optional | n/a | n/a | None |
| PUBLISHED / MATCHING | Yes | n/a | n/a | None |
| After offer accepted, before loading | Yes, reason required | Yes, reason required | Application withdraw | Configurable fee |
| LOADING or later | Admin review required | Admin review | Admin review | Higher fee / dispute |

Every cancellation writes `Cancellation` + `AuditLog`.

## Matching formulas

Supplier score components (0–1), then `100 * sum(weight_i * score_i) / sum(weights)`:

- productCompatibility — exact product 1.0, category 0.7, else 0 (filtered)
- capacityCompatibility — offered/available vs requested
- geographicCompatibility — same city 1.0, same region 0.6, zone overlap 0.8, else 0
- certificationCompatibility — fraction of required certs valid
- priceScore — relative to request budget or peer median
- ratingScore — avg/5
- reliabilityScore — completion rate and on-time rate
- deliveryScore — promised date vs requested
- workloadScore — inverse of open orders vs capacity
- verificationScore — approved 1.0 else 0 (usually filtered)

Driver engine: vehicle fit, capacity, distance to pickup, area, rating, reliability, availability, equipment, workload.

## Edge cases (must not corrupt state)

Handled in domain services with transactions:

- Supplier accepted then suspended → order `DISPUTED`/`CANCELLED` path, job cancelled, audit
- Driver selected then rejected by supplier → job back to `OFFERED_TO_DRIVERS`, application `REJECTED`, others remain
- Concurrent driver apply/select → row lock / conditional update
- Partial offer → order items snapshot offered qty; remainder can stay open only if `singleWinner=false`
- Expired request/offer → worker; clients cannot set EXPIRED
- Duplicate offers → unique active constraint
- Document expiry → worker flags, blocks matching if cert required
- User suspended mid-trip → cannot start new jobs; active trip continues but admin-alerted
- Network retry on status update → idempotent: same from→to with same version is a no-op success

# Business decisions

Ambiguities from the specification, with the default implemented unless product later overrides it. Defaults are also stored as `BusinessRule` rows where they should be tunable.

## D1. One winner vs split fulfillment

**Unclear:** Can two suppliers fulfill one request?

**Options:** Exclusive accept; split by line; split by quantity.

**Decision:** Exclusive accept (`fulfillment.singleWinner=true`). A supplier may still offer a quantity inside `[min, max]`. Split fulfillment is a later flag.

**Why:** Simplifies matching, transport, invoicing, and disputes for v1.

## D2. Who confirms the driver

**Unclear:** Supplier, requester, or both?

**Options:** Supplier only; requester only; dual confirm; first driver accept.

**Decision:** First eligible driver who accepts wins. The system then issues waybill and transport invoice. Cargo owner sees driver details immediately. Admin can still override.

**Why:** The product is cargo-owner → driver matching. There is no supplier marketplace in the operating model.

## D3. Payments

**Unclear:** Escrow, PSP, or offline?

**Options:** Stripe-like capture; local Iranian PSP; record-only.

**Decision:** Record-only `ManualPaymentProvider`. Invoices and commissions are real; money movement is recorded by finance staff.

**Why:** PSP choice is market-specific and must not block logistics.

## D4. Independent drivers vs companies

**Unclear:** Is a driver always under a carrier?

**Decision:** Every driver has a `DriverProfile` and a `CARRIER` company (personal fleet of one if independent). Vehicles belong to the company.

**Why:** Uniform tenancy and invoices.

## D5. Multi-line transport

**Unclear:** One job per request or per line?

**Decision:** One `TransportationJob` per accepted order (all lines). Partial remainder may create a follow-up job.

**Why:** Stores typically want one truck for a replenishment order.

## D6. Currency and locale

**Unclear:** Spec uses London; existing product is Persian Shidvar.

**Decision:** Default locale `fa`, default currency `IRR`, default country `IR`. Architecture is multi-currency and `en` is first-class. Seed catalog uses Iran geography plus a London demo supplier area for matching tests.

**Why:** The running product is Persian RTL; the spec requires i18n, not a UK-only deployment.

## D7. Open marketplace vs match-only

**Unclear:** Do all approved suppliers see all requests?

**Decision:** Suppliers see requests they were matched to with score ≥ `matching.minScoreToNotify`, plus requests they were invited to. Admins can toggle `marketplace.openToAllApproved` (default false).

**Why:** Reduces noise and leakage of demand data.

## D8. Auto-publish requests

**Decision:** Default `requests.autoPublish=true`. An approved cargo owner submit immediately dispatches the load to eligible nearby drivers.

## D9. Commission timing

**Decision:** Calculated when the related invoice is ISSUED; settlement is a later batch. Cancels reverse commission if invoice is VOID.

## D10. Chat

**Decision:** Order-scoped conversations among requester, supplier, assigned driver, and support. No global social inbox. Attachments use `FileService`.

## D11. Maps

**Decision:** Haversine for matching. OSM tiles in the UI when a map is shown. Google/Mapbox behind `GeoProvider`.

## D12. Inventory WMS

**Unclear:** Previous demo had warehouse inventory.

**Decision:** Out of v1 core path. Warehouses are locations with capacity metadata, not a full WMS. Inventory tables are not in the first schema to avoid fake stock logic.

## D13. National ID / KYC storage

**Decision:** Encrypted at rest when `ENCRYPTION_KEY` is set; shown masked except to verification agents and the owner. Audit every full reveal.

## D14. Pickup warehouse on job create

**Decision:** When an offer is accepted, the transport job’s pickup warehouse is the supplier company’s oldest active warehouse.

**Why:** Driver matching and information release need a real pickup location. Suppliers can later select a specific warehouse.

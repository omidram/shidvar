# Roles and permissions

## Portal identities (company types)

| Type | Portals | Verification |
| --- | --- | --- |
| PLATFORM | `/admin` | Staff accounts, seeded |
| REQUESTER | `/requester` | Company approval required to publish (drafts allowed while pending) |
| SUPPLIER | `/supplier` | Must be APPROVED to see marketplace and offer |
| CARRIER | `/driver` and later `/carrier` | Driver APPROVED to apply for jobs |

A user may have multiple memberships (rare). Active portal is selected at login and stored on the session.

## Platform roles (staff)

| Role | Intent |
| --- | --- |
| SUPER_ADMIN | All permissions; cannot be impersonated |
| ADMIN | Operations except payment provider secrets and role deletion |
| PROCUREMENT_MANAGER | Requests, offers, catalog, requester companies |
| LOGISTICS_MANAGER | Jobs, drivers, vehicles, shipments |
| FINANCE_MANAGER | Invoices, payments, commissions, settlements |
| SUPPORT_AGENT | Tickets, messages, read orders |
| VERIFICATION_AGENT | KYC approve/reject |
| ANALYST | Reports and dashboards read-only |

## Company roles

`OWNER`, `MANAGER`, `EMPLOYEE`, `DRIVER` (membership). Owners receive all portal permissions for their company type.

## Permission catalog

Codes are `resource.action`. Server checks exact strings.

```
users.read users.create users.update users.suspend users.impersonate users.export
roles.read roles.manage
companies.read companies.create companies.update companies.verify companies.reject companies.suspend
stores.read stores.create stores.update
warehouses.read warehouses.create warehouses.update
suppliers.read suppliers.update suppliers.verify suppliers.reject
supplier_products.manage supplier_capacity.manage
drivers.read drivers.update drivers.verify drivers.reject
carriers.read carriers.verify
vehicles.read vehicles.manage
products.read products.manage categories.manage
requests.read requests.create requests.update requests.publish requests.cancel requests.review
marketplace.supplier.read marketplace.driver.read
offers.read offers.create offers.update offers.accept offers.reject offers.withdraw
orders.read orders.update orders.cancel
jobs.read jobs.apply jobs.assign jobs.confirm jobs.update_status jobs.cancel
shipments.read shipments.update
invoices.read invoices.manage
payments.read payments.manage
commissions.read commissions.manage
settlements.read settlements.manage
documents.read documents.upload documents.verify documents.delete
notifications.read notifications.manage
messages.read messages.send
tickets.read tickets.create tickets.manage
ratings.read ratings.create
disputes.read disputes.create disputes.manage
reports.read analytics.read
audit_logs.read
settings.read settings.manage
business_rules.manage
```

## Matrix (abbreviated)

| Permission | Super | Admin | Procure | Logistics | Finance | Support | Verify | Analyst | Requester owner | Supplier owner | Driver |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| users.read | Y | Y | | | | Y | Y | | own co | own co | self |
| users.suspend | Y | Y | | | | | | | | | |
| companies.verify | Y | Y | | | | | Y | | | | |
| requests.create | Y | Y | Y | | | | | | Y | | |
| offers.create | Y | Y | | | | | | | | Y if approved | |
| offers.accept | Y | Y | Y | | | | | | Y | | |
| marketplace.supplier.read | Y | Y | Y | | | | | | | Y if approved | |
| jobs.apply | Y | | | | | | | | | | Y if approved |
| jobs.confirm | Y | Y | | Y | | | | | | Y | |
| jobs.update_status | Y | Y | | Y | | | | | | | assigned |
| payments.manage | Y | | | | Y | | | | | | |
| audit_logs.read | Y | Y | | | | | | Y | | | |
| business_rules.manage | Y | Y | | | | | | | | | |
| disputes.manage | Y | Y | | | | Y | | | create | create | create |

Empty cells are deny. Own-company reads still go through tenant checks.

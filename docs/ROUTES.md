# Frontend routes

Locale is a cookie (`sc_locale=fa|en`), not a path prefix.

## Public

- `/` landing
- `/about`
- `/how-it-works`
- `/contact`
- `/login`
- `/register`
- `/forgot-password`
- `/reset-password`
- `/verify-account`

## Requester

- `/requester/dashboard`
- `/requester/company`
- `/requester/stores`
- `/requester/warehouses`
- `/requester/requests`
- `/requester/requests/new`
- `/requester/requests/[id]`
- `/requester/offers`
- `/requester/orders`
- `/requester/orders/[id]`
- `/requester/shipments`
- `/requester/documents`
- `/requester/invoices`
- `/requester/payments`
- `/requester/messages`
- `/requester/disputes`
- `/requester/reports`
- `/requester/settings`

## Supplier

- `/supplier/dashboard`
- `/supplier/profile`
- `/supplier/products`
- `/supplier/capacity`
- `/supplier/operating-areas`
- `/supplier/requests`
- `/supplier/requests/[id]`
- `/supplier/offers`
- `/supplier/orders`
- `/supplier/orders/[id]`
- `/supplier/shipments`
- `/supplier/documents`
- `/supplier/invoices`
- `/supplier/payments`
- `/supplier/messages`
- `/supplier/ratings`
- `/supplier/disputes`
- `/supplier/settings`

## Driver (mobile-first)

- `/driver/dashboard`
- `/driver/profile`
- `/driver/vehicle`
- `/driver/jobs`
- `/driver/jobs/[id]`
- `/driver/active-trip`
- `/driver/documents`
- `/driver/earnings`
- `/driver/ratings`
- `/driver/messages`
- `/driver/settings`

## Admin

- `/admin/dashboard`
- `/admin/users`
- `/admin/companies`
- `/admin/suppliers`
- `/admin/requesters`
- `/admin/drivers`
- `/admin/carriers`
- `/admin/vehicles`
- `/admin/products`
- `/admin/categories`
- `/admin/requests`
- `/admin/offers`
- `/admin/orders`
- `/admin/shipments`
- `/admin/documents`
- `/admin/payments`
- `/admin/disputes`
- `/admin/support`
- `/admin/notifications`
- `/admin/reports`
- `/admin/audit-logs`
- `/admin/settings`
- `/admin/business-rules`

Unauthenticated access to portal prefixes redirects to `/login`. Wrong portal membership receives 403 with a switcher.

export function invoiceHref(pathname: string, id: string) {
  if (pathname.startsWith("/admin")) return `/admin/invoices/${id}`;
  if (pathname.startsWith("/requester")) return `/requester/invoices/${id}`;
  return `/requester/invoices/${id}`;
}

export function jobHref(pathname: string, id: string) {
  if (pathname.startsWith("/admin")) return `/admin/jobs/${id}`;
  if (pathname.startsWith("/requester")) return `/requester/jobs/${id}`;
  if (pathname.startsWith("/driver")) return `/driver/jobs/${id}`;
  return `/driver/jobs/${id}`;
}

export function driverHref(pathname: string, id: string) {
  if (pathname.startsWith("/admin")) return `/admin/drivers/${id}`;
  if (pathname.startsWith("/requester")) return `/requester/drivers/${id}`;
  if (pathname.startsWith("/driver")) return "/driver/profile";
  return `/requester/drivers/${id}`;
}

export function requestHref(pathname: string, id: string) {
  if (pathname.startsWith("/admin")) return `/admin/requests/${id}`;
  if (pathname.startsWith("/requester")) return `/requester/requests/${id}`;
  return `/requester/requests/${id}`;
}

export function companyHref(id: string) {
  return `/admin/companies/${id}`;
}

export function supportHref(pathname: string) {
  if (pathname.startsWith("/admin")) return "/admin/tickets";
  if (pathname.startsWith("/driver")) return "/driver/support";
  if (pathname.startsWith("/supplier")) return "/supplier/support";
  return "/requester/support";
}

export function ticketHref(pathname: string, id: string) {
  if (pathname.startsWith("/admin")) return `/admin/tickets/${id}`;
  if (pathname.startsWith("/driver")) return `/driver/support/${id}`;
  if (pathname.startsWith("/supplier")) return `/supplier/support/${id}`;
  return `/requester/support/${id}`;
}

export function disputeHref(pathname: string, id: string) {
  if (pathname.startsWith("/admin")) return `/admin/disputes/${id}`;
  if (pathname.startsWith("/driver")) return `/driver/disputes/${id}`;
  if (pathname.startsWith("/supplier")) return `/supplier/disputes/${id}`;
  return `/requester/disputes/${id}`;
}

export type NotificationPayload = {
  jobId?: string;
  requestId?: string;
  orderId?: string;
  invoiceId?: string;
  companyId?: string;
  driverId?: string;
  kind?: string;
};

function jobsHome(portal: "admin" | "requester" | "supplier" | "driver") {
  return portal === "supplier" ? "/supplier/dashboard" : `/${portal}/jobs`;
}

function requestsHome(portal: "admin" | "requester" | "supplier" | "driver") {
  if (portal === "driver") return "/driver/jobs";
  return `/${portal}/requests`;
}

export function notificationHref(
  portal: "admin" | "requester" | "supplier" | "driver",
  note: { eventType?: string; payload?: NotificationPayload | null },
) {
  const payload = note.payload ?? {};
  const kind = note.eventType || payload.kind || "";

  if (kind === "tracking.consent" || payload.kind === "tracking.consent") {
    return payload.jobId ? `/driver/jobs/${payload.jobId}` : "/driver/active-trip";
  }
  if (kind === "company.review") return "/admin/verifications";
  if (kind === "driver.review") return "/admin/verifications";
  if (kind === "job.offered" || kind === "job.matched") {
    return payload.jobId ? jobHref(`/${portal}`, payload.jobId) : jobsHome(portal);
  }
  if (kind === "job.accepted" || kind === "job.assigned" || kind === "job.in_transit") {
    if (payload.jobId) return jobHref(`/${portal}`, payload.jobId);
    if (kind === "job.in_transit" && (portal === "admin" || portal === "requester")) return `/${portal}/tracking`;
    return jobsHome(portal);
  }
  if (kind === "supplier.matched" || kind === "request.published") {
    if (payload.requestId) {
      if (portal === "supplier") return `/supplier/requests/${payload.requestId}`;
      return requestHref(`/${portal}`, payload.requestId);
    }
    return requestsHome(portal);
  }
  if (kind === "invoice.issued") {
    if (payload.invoiceId) return invoiceHref(`/${portal}`, payload.invoiceId);
    return portal === "driver" ? "/driver/wallet" : `/${portal}/invoices`;
  }
  if (kind === "job.message" || kind === "job.extra" || kind === "job.pod") {
    return payload.jobId ? jobHref(`/${portal}`, payload.jobId) : jobsHome(portal);
  }
  if (kind === "dispute.opened") {
    return portal === "admin" ? "/admin/disputes" : supportHref(`/${portal}`);
  }
  if (kind === "ticket.opened" || kind === "ticket.updated") {
    return portal === "admin" ? "/admin/tickets" : supportHref(`/${portal}`);
  }
  if (payload.jobId) return jobHref(`/${portal}`, payload.jobId);
  if (payload.requestId) {
    if (portal === "supplier") return `/supplier/requests/${payload.requestId}`;
    return requestHref(`/${portal}`, payload.requestId);
  }
  if (payload.orderId) {
    if (portal === "admin") return `/admin/orders/${payload.orderId}`;
    if (portal === "supplier") return `/supplier/orders/${payload.orderId}`;
    return `/requester/orders/${payload.orderId}`;
  }
  if (payload.invoiceId) return invoiceHref(`/${portal}`, payload.invoiceId);
  if (payload.companyId && portal === "admin") return companyHref(payload.companyId);
  if (payload.driverId) return driverHref(`/${portal}`, payload.driverId);
  return `/${portal}/dashboard`;
}

const TITLE_FA: Record<string, string> = {
  "tracking.consent": "تأیید ردیابی سفر",
  "job.matched": "بار جدید برای شما",
  "supplier.matched": "درخواست منطبق",
  "job.message": "پیام جدید بار",
  "job.extra": "هزینه جانبی بار",
  "job.pod": "مدارک تحویل بار",
  "dispute.opened": "اختلاف بار جدید",
  "ticket.opened": "تیکت پشتیبانی جدید",
  "ticket.updated": "به‌روزرسانی تیکت",
};

export function notificationTitle(note: { eventType?: string; title?: string; payload?: NotificationPayload | null }) {
  const kind = note.eventType || note.payload?.kind || "";
  return TITLE_FA[kind] ?? note.title ?? "اعلان";
}

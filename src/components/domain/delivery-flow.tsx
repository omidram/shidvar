import { cn } from "@/lib/utils";

const STEPS = [
  { id: "accept", title: "قبول بار" },
  { id: "pickup", title: "بارگیری" },
  { id: "transit", title: "در مسیر" },
  { id: "handoff", title: "تحویل بار" },
  { id: "docs", title: "ارسال مدارک" },
  { id: "done", title: "پایان سفر" },
] as const;

type Audience = "driver" | "owner" | "staff";

export function deliveryStep(status: string) {
  if (status === "CANCELLED" || status === "REJECTED") return { index: -1, finished: false, cancelled: true };
  if (status === "COMPLETED" || status === "CONFIRMED") return { index: STEPS.length - 1, finished: true, cancelled: false };
  const index: Record<string, number> = {
    MATCHING: 0,
    OFFERED_TO_DRIVERS: 0,
    DRIVER_APPLIED: 0,
    DRIVER_SELECTED: 1,
    SUPPLIER_CONFIRMED: 1,
    SCHEDULED: 1,
    DRIVER_ASSIGNED: 1,
    ARRIVING_AT_PICKUP: 1,
    AT_PICKUP: 1,
    LOADING: 1,
    LOADED: 2,
    IN_TRANSIT: 2,
    ARRIVING_AT_DESTINATION: 2,
    AT_DESTINATION: 3,
    UNLOADING: 3,
    DELIVERED: 4,
    PROOF_SUBMITTED: 5,
    DISPUTED: 5,
  };
  return { index: index[status] ?? 0, finished: false, cancelled: false };
}

export function flowTitle(status: string) {
  const progress = deliveryStep(status);
  if (progress.cancelled) return "لغو شده";
  if (progress.finished) return "سفر تمام شد";
  return STEPS[progress.index]?.title ?? "قبول بار";
}

export function driverMove(status: string): { next: string; label: string } | null {
  const moves: Record<string, { next: string; label: string }> = {
    SCHEDULED: { next: "ARRIVING_AT_PICKUP", label: "بروید بار را بردارید" },
    DRIVER_ASSIGNED: { next: "ARRIVING_AT_PICKUP", label: "بروید بار را بردارید" },
    ARRIVING_AT_PICKUP: { next: "AT_PICKUP", label: "رسیدم محل بارگیری" },
    AT_PICKUP: { next: "LOADING", label: "دارم بار می‌زنم" },
    LOADING: { next: "LOADED", label: "بار را زدم" },
    LOADED: { next: "IN_TRANSIT", label: "راه افتادم سمت مقصد" },
    IN_TRANSIT: { next: "ARRIVING_AT_DESTINATION", label: "نزدیک مقصدم" },
    ARRIVING_AT_DESTINATION: { next: "AT_DESTINATION", label: "رسیدم مقصد" },
    AT_DESTINATION: { next: "UNLOADING", label: "دارم خالی می‌کنم" },
    UNLOADING: { next: "DELIVERED", label: "بار را تحویل دادم" },
  };
  return moves[status] ?? null;
}

const TASK_RANK: Record<string, number> = {
  DELIVERED: 0,
  DISPUTED: 1,
  UNLOADING: 2,
  AT_DESTINATION: 3,
  ARRIVING_AT_DESTINATION: 4,
  IN_TRANSIT: 5,
  LOADED: 6,
  LOADING: 7,
  AT_PICKUP: 8,
  ARRIVING_AT_PICKUP: 9,
  DRIVER_ASSIGNED: 10,
  SCHEDULED: 10,
  SUPPLIER_CONFIRMED: 10,
  DRIVER_SELECTED: 10,
};

export function driverTaskLabel(status: string) {
  if (status === "DELIVERED") return "عکس رسید و بارنامه را بفرستید";
  if (status === "DISPUTED") return "مدارک را دوباره بفرستید";
  if (status === "PROOF_SUBMITTED") return "منتظر تأیید مدارک هستید";
  if (["DRIVER_SELECTED", "SUPPLIER_CONFIRMED"].includes(status)) return "بروید بار را بردارید";
  return driverMove(status)?.label ?? "سفر را ادامه دهید";
}

export function driverTaskRank(status: string) {
  return TASK_RANK[status] ?? 50;
}

const OWNER_RANK: Record<string, number> = {
  PROOF_SUBMITTED: 0,
  DISPUTED: 1,
  DELIVERED: 2,
  UNLOADING: 3,
  AT_DESTINATION: 4,
  ARRIVING_AT_DESTINATION: 5,
  IN_TRANSIT: 6,
  LOADED: 7,
  LOADING: 8,
  AT_PICKUP: 9,
  ARRIVING_AT_PICKUP: 10,
  DRIVER_ASSIGNED: 11,
  SCHEDULED: 11,
  SUPPLIER_CONFIRMED: 12,
  DRIVER_SELECTED: 12,
  DRIVER_APPLIED: 20,
  OFFERED_TO_DRIVERS: 21,
  MATCHING: 22,
};

export function ownerTaskLabel(status: string) {
  if (status === "PROOF_SUBMITTED") return "مدارک رسیده. تأیید کنید تا سفر بسته شود";
  if (status === "DISPUTED") return "روی مدارک اختلاف است. بررسی کنید";
  if (status === "DELIVERED") return "راننده بار را داده و دارد عکس مدارک را می‌فرستد";
  if (["OFFERED_TO_DRIVERS", "DRIVER_APPLIED", "MATCHING"].includes(status)) return "منتظر قبول یک راننده هستید";
  if (["DRIVER_SELECTED", "SUPPLIER_CONFIRMED", "SCHEDULED", "DRIVER_ASSIGNED", "ARRIVING_AT_PICKUP"].includes(status)) return "راننده قبول کرد و به سمت بارگیری می‌رود";
  return `الان: ${flowTitle(status)}`;
}

export function ownerTaskRank(status: string) {
  return OWNER_RANK[status] ?? 40;
}

export function ownerTaskHref(id: string, status: string) {
  if (status === "PROOF_SUBMITTED" || status === "DISPUTED" || status === "DELIVERED") return `/requester/jobs/${id}#delivery-docs`;
  if (["OFFERED_TO_DRIVERS", "DRIVER_APPLIED", "MATCHING", "DRIVER_SELECTED", "SUPPLIER_CONFIRMED"].includes(status)) return `/requester/jobs/${id}`;
  return "/requester/tracking";
}

function nowText(status: string, audience: Audience, finished: boolean, cancelled: boolean) {
  if (cancelled) return "این بار لغو شده و دیگر ادامه ندارد.";
  if (finished) return "سفر تمام شد. مدارک تأیید شده و این بار بسته است.";
  if (status === "DISPUTED") return "روی مدارک اختلاف ثبت شده. تا تعیین تکلیف، سفر باز می‌ماند.";
  const driver = audience === "driver";
  const byStatus: Record<string, string> = {
    MATCHING: "بار هنوز به راننده‌ها اعلام نشده است.",
    OFFERED_TO_DRIVERS: driver
      ? "این بار را قبول یا رد کنید. بعد از قبول، تا پایان سفر فقط روبارِ تخصیص‌یافته توسط مدیریت را می‌توانید بگیرید."
      : "بار اعلام شده و منتظر قبول یک راننده است.",
    DRIVER_APPLIED: driver
      ? "این بار را قبول یا رد کنید. بعد از قبول، تا پایان سفر فقط روبارِ تخصیص‌یافته توسط مدیریت را می‌توانید بگیرید."
      : "راننده اعلام آمادگی کرده و هنوز بار را قطعی نکرده است.",
    PROOF_SUBMITTED: driver
      ? "مدارک برای صاحب بار و مدیریت فرستاده شد. تا تأیید یکی از آن‌ها سفر باز می‌ماند."
      : "مدارک تحویل رسیده است. اگر درست‌اند تأیید کنید تا سفر بسته شود.",
    DELIVERED: driver
      ? "بار را دادید. این سفر همین‌جا می‌ماند. دو عکس بفرستید: رسید و بارنامه. بعد دکمهٔ فرستادن را بزنید."
      : "راننده بار را تحویل داده و باید عکس مدارک را بفرستد.",
  };
  if (byStatus[status]) return byStatus[status];
  const step = deliveryStep(status).index;
  if (step <= 1) {
    return driver
      ? "به مبدأ بروید، بار را تحویل بگیرید و هر مرحله را همین‌جا ثبت کنید."
      : "راننده به سمت بارگیری می‌رود. وضعیت هر مرحله همین‌جا به‌روز می‌شود.";
  }
  if (step === 2) {
    return driver
      ? "در مسیر مقصد هستید. اگر لوکیشن گوشی روشن باشد، موقعیت شما روی نقشه دیده می‌شود."
      : "بار در مسیر است. اگر راننده لوکیشن را روشن کرده باشد، موقعیت روی نقشه دیده می‌شود.";
  }
  return driver
    ? "به مقصد رسیده‌اید. تخلیه و تحویل را ثبت کنید، بعد مدارک را بفرستید."
    : "راننده به مقصد رسیده و در حال تحویل بار است.";
}

function stepState(status: string, index: number) {
  const progress = deliveryStep(status);
  if (progress.cancelled) return "later" as const;
  if (progress.finished || index < progress.index) return "done" as const;
  if (index === progress.index) return "now" as const;
  return "later" as const;
}

export function DeliveryFlow({ status, audience = "staff" }: { status: string; audience?: Audience }) {
  const progress = deliveryStep(status);
  const note = nowText(status, audience, progress.finished, progress.cancelled);
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-bold">مراحل این بار</h2>
        <span className="text-xs text-muted">{progress.finished ? "تمام‌شده" : progress.cancelled ? "لغو" : `مرحله ${progress.index + 1} از ${STEPS.length}`}</span>
      </div>
      <ol className="mt-3 grid gap-2">
        {STEPS.map((step, index) => {
          const state = stepState(status, index);
          return (
            <li
              key={step.id}
              className={cn(
                "flex items-center gap-3 rounded-2xl px-3 py-2.5",
                state === "now" && "bg-primary text-primary-foreground",
                state === "done" && "bg-accent/15 text-foreground",
                state === "later" && "bg-background text-muted",
              )}
            >
              <span
                className={cn(
                  "grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold",
                  state === "now" && "bg-white/20",
                  state === "done" && "bg-accent text-white",
                  state === "later" && "bg-border text-muted",
                )}
              >
                {state === "done" ? "✓" : index + 1}
              </span>
              <span className="font-semibold">{step.title}</span>
              <span className="ms-auto text-xs">{state === "now" ? "الان" : state === "done" ? "انجام شد" : ""}</span>
            </li>
          );
        })}
      </ol>
      <p className={cn("mt-3 rounded-2xl px-4 py-3 text-sm leading-7", progress.cancelled ? "bg-red-50 text-red-800" : "bg-primary/10")}>{note}</p>
    </div>
  );
}

export function RoleGuide({ role }: { role: "driver" | "owner" }) {
  const steps =
    role === "driver"
      ? [
          ["قبول یا رد", "بار همگانی یا بار تخصیص‌یافته را از فهرست بارها قبول یا رد کنید."],
          ["یک بار فعال", "تا پایان سفر بار دیگری نمی‌گیرید، مگر روباری که مدیریت مخصوص شما تخصیص داده باشد."],
          ["لوکیشن", "در مسیر، لوکیشن گوشی را روشن کنید تا موقعیت روی نقشه دیده شود."],
          ["مدارک و پایان", "بعد از تحویل، بارنامه و رسید را بفرستید. با تأیید صاحب بار یا مدیریت سفر بسته می‌شود."],
        ]
      : [
          ["ثبت درخواست", "مسیر و کالا را ثبت کنید و نوع اعلام را همگانی یا VIP انتخاب کنید."],
          ["اعلام توسط مدیریت", "بعد از بررسی، بار به همه راننده‌ها یا فقط به رانندهٔ VIP اعلام می‌شود."],
          ["پیگیری مسیر", "وضعیت هر مرحله و، در صورت روشن بودن لوکیشن، موقعیت راننده را ببینید."],
          ["تأیید مدارک", "بارنامه و رسید را بررسی کنید. با تأیید شما سفر بسته می‌شود."],
        ];
  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {steps.map(([title, body], index) => (
        <div key={title} className="rounded-3xl border border-border bg-card p-4">
          <div className="text-xs font-bold text-accent">گام {index + 1}</div>
          <h2 className="mt-1 font-bold">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-muted">{body}</p>
        </div>
      ))}
    </section>
  );
}

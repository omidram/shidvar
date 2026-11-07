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

export function driverMove(status: string): { next: string; label: string } | null {
  const moves: Record<string, { next: string; label: string }> = {
    SCHEDULED: { next: "ARRIVING_AT_PICKUP", label: "حرکت به سمت بارگیری" },
    DRIVER_ASSIGNED: { next: "ARRIVING_AT_PICKUP", label: "حرکت به سمت بارگیری" },
    ARRIVING_AT_PICKUP: { next: "AT_PICKUP", label: "به محل بارگیری رسیدم" },
    AT_PICKUP: { next: "LOADING", label: "بارگیری را شروع کردم" },
    LOADING: { next: "LOADED", label: "بارگیری تمام شد" },
    LOADED: { next: "IN_TRANSIT", label: "به سمت مقصد حرکت کردم" },
    IN_TRANSIT: { next: "ARRIVING_AT_DESTINATION", label: "نزدیک مقصد هستم" },
    ARRIVING_AT_DESTINATION: { next: "AT_DESTINATION", label: "به مقصد رسیدم" },
    AT_DESTINATION: { next: "UNLOADING", label: "تخلیه را شروع کردم" },
    UNLOADING: { next: "DELIVERED", label: "بار را تحویل دادم" },
  };
  return moves[status] ?? null;
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
      ? "بار تحویل شد. عکس بارنامه و رسید را بارگذاری کنید، بعد درخواست تأیید را بفرستید."
      : "راننده بار را تحویل داده و باید مدارک را بفرستد.",
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

export function DeliveryFlow({ status, audience = "staff" }: { status: string; audience?: Audience }) {
  const progress = deliveryStep(status);
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-bold">مراحل این بار</h2>
        <span className="text-xs text-muted">{progress.finished ? "تمام‌شده" : progress.cancelled ? "لغو" : `مرحله ${progress.index + 1} از ${STEPS.length}`}</span>
      </div>
      <ol className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {STEPS.map((step, index) => {
          const state = progress.cancelled ? "later" : progress.finished || index < progress.index ? "done" : index === progress.index ? "now" : "later";
          return (
            <li
              key={step.id}
              className={cn(
                "rounded-2xl border px-2 py-2 text-center text-xs leading-5",
                state === "now" && "border-primary bg-primary font-bold text-primary-foreground",
                state === "done" && "border-accent/50 bg-accent/15 font-semibold",
                state === "later" && "border-border bg-background text-muted",
              )}
            >
              {index + 1}. {step.title}
            </li>
          );
        })}
      </ol>
      <p className="mt-3 text-sm leading-7">{nowText(status, audience, progress.finished, progress.cancelled)}</p>
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

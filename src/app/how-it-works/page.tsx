import { PublicHeader } from "@/components/layout/public-header";
import { PublicFooter } from "@/components/layout/public-footer";
import { Card } from "@/components/ui/card";
import { VisualField } from "@/components/visual/visual-field";

const STEPS = [
  { title: "ثبت‌نام و ارسال مدارک", body: "صاحب بار و راننده ثبت‌نام می‌کنند و فرم‌ها را برای مدیریت می‌فرستند." },
  { title: "تأیید مدیریت", body: "فقط پس از تأیید هویت، پنل عملیاتی باز می‌شود." },
  { title: "ثبت درخواست شمسی", body: "شرکت پخش مبدأ، مقصد، نوع بار و زمان را ثبت می‌کند؛ مثل زر ماکارون از تهران به آمل." },
  { title: "اعلان به راننده مناسب", body: "سیستم درخواست را به رانندگان تأییدشده همان محدوده و ناوگان می‌فرستد." },
  { title: "قبول یا رد آگاهانه", body: "راننده صاحب بار، نوع محموله و مقصد را می‌بیند و تصمیم می‌گیرد." },
  { title: "اسناد خودکار", body: "با قبول، اطلاعات راننده، بارنامه و فاکتور در هر دو پنل ظاهر می‌شود." },
  { title: "ردیابی با اجازه گوشی", body: "سفر فعال فقط بعد از تأیید موقعیت روی گوشی راننده زنده می‌شود." },
  { title: "تسویه کیف پول زرین‌پال", body: "کرایه به درآمد حمل می‌نشیند. شارژ از درگاه و برداشت به شبای ثبت‌شده در زرین‌پال است." },
];

export default function HowPage() {
  return (
    <div className="bg-background">
      <PublicHeader />
      <main className="mx-auto max-w-4xl px-4 py-16">
        <p className="text-sm font-bold text-primary">مسیر سازمانی</p>
        <h1 className="mt-2 text-4xl font-black">چطور کار می‌کند؟</h1>
        <p className="mt-3 max-w-2xl text-muted">
          از تأیید هویت تا تسویه ریالی، شیدور فروشگاه واسط نیست؛ شرکت پخش، راننده تأییدشده و مدیریت در یک مسیر مشخص کار می‌کنند.
        </p>
        <VisualField className="mt-8 h-56 rounded-3xl bg-ink">
          <img src="/media/cargo-2.jpg" alt="" className="absolute inset-0 h-full w-full rounded-3xl object-cover opacity-50" />
          <div className="relative z-10 flex h-full items-end p-6 text-white">
            <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-bold backdrop-blur">
              ثبت بار → قبول راننده → ردیابی → کیف پول
            </span>
          </div>
        </VisualField>
        <div className="mt-8 grid gap-3">
          {STEPS.map((step, i) => (
            <Card key={step.title} className="flex items-start gap-4">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary text-lg font-black text-primary-foreground">
                {i + 1}
              </span>
              <div>
                <p className="font-bold">{step.title}</p>
                <p className="mt-1 text-sm leading-6 text-muted">{step.body}</p>
              </div>
            </Card>
          ))}
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}

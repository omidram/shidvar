import { PublicHeader } from "@/components/layout/public-header";
import { PublicFooter } from "@/components/layout/public-footer";
import { Card } from "@/components/ui/card";
import { VisualField } from "@/components/visual/visual-field";

export default function AboutPage() {
  return (
    <div className="bg-background">
      <PublicHeader />
      <main className="mx-auto max-w-4xl px-4 py-16">
        <p className="text-sm font-bold text-primary">درباره شیدور</p>
        <h1 className="mt-2 text-4xl font-black">سامانه حمل بار برای شرکت‌های پخش و رانندگان تأییدشده</h1>
        <VisualField className="mt-8 h-64 rounded-3xl bg-ink">
          <img src="/media/truck-illustration.jpg" alt="" className="absolute inset-0 h-full w-full rounded-3xl object-cover opacity-50" />
        </VisualField>
        <p className="mt-5 text-lg text-muted">
          شیدور فروشگاه واسط ندارد. شرکت پخش تأییدشده درخواست حمل ثبت می‌کند، سیستم راننده مناسب محدوده را پیدا می‌کند و با
          قبول راننده بارنامه و فاکتور صادر می‌شود. ردیابی فقط با اجازه گوشی روشن است و تسویه راننده از کیف پول ریالی و درگاه زرین‌پال انجام می‌شود.
        </p>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <Card>
            <h2 className="font-bold">صاحب بار / شرکت پخش</h2>
            <p className="mt-2 text-sm text-muted">ثبت مسیر، نوع بار و تاریخ شمسی. مشاهده راننده قبول‌کننده، ردیابی و اسناد حمل.</p>
          </Card>
          <Card>
            <h2 className="font-bold">راننده تأییدشده</h2>
            <p className="mt-2 text-sm text-muted">بار محدوده، کیف پول، درآمد سفر، هزینه مسیر و برداشت به شبا در زرین‌پال.</p>
          </Card>
          <Card>
            <h2 className="font-bold">مدیریت سامانه</h2>
            <p className="mt-2 text-sm text-muted">تأیید هویت، قواعد کسب‌وکار، اعلان‌ها و لاگ ممیزی در یک پنل.</p>
          </Card>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}

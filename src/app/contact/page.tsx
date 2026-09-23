import { PublicHeader } from "@/components/layout/public-header";
import { PublicFooter } from "@/components/layout/public-footer";
import { Card } from "@/components/ui/card";

export default function ContactPage() {
  return (
    <div className="bg-background">
      <PublicHeader />
      <main className="mx-auto max-w-4xl px-4 py-16">
        <h1 className="text-4xl font-black">تماس و پشتیبانی</h1>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <Card>
            <h2 className="font-bold">فرستندگان کالا</h2>
            <p className="mt-2 text-sm text-muted">۰۲۱-۹۱۰۰۰۰۰۰</p>
          </Card>
          <Card>
            <h2 className="font-bold">کاپیتان‌های جاده</h2>
            <p className="mt-2 text-sm text-muted">۰۲۱-۹۱۰۰۰۰۰۱</p>
          </Card>
          <Card>
            <h2 className="font-bold">پشتیبانی مرکزی</h2>
            <p className="mt-2 text-sm text-muted">۲۴ ساعته از داخل سامانه</p>
          </Card>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}

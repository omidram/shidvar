import Link from "next/link";
import { BrandMark } from "@/components/visual/icons";

export function PublicFooter() {
  return (
    <footer className="surface-ink mt-16">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 md:grid-cols-4">
        <div>
          <BrandMark className="text-white" />
          <p className="mt-3 text-sm text-white/70">اتصال شرکت‌های پخش تأییدشده به رانندگان تأییدشده؛ با ردیابی زنده و کیف پول زرین‌پال.</p>
        </div>
        <div>
          <h3 className="font-semibold">خدمات</h3>
          <div className="mt-3 grid gap-2 text-sm text-white/75">
            <Link href="/register?portal=REQUESTER">ثبت درخواست بار</Link>
            <Link href="/register?portal=DRIVER">ثبت‌نام راننده</Link>
          </div>
        </div>
        <div>
          <h3 className="font-semibold">شیدور</h3>
          <div className="mt-3 grid gap-2 text-sm text-white/75">
            <Link href="/about">درباره ما</Link>
            <Link href="/how-it-works">روش کار</Link>
            <Link href="/#faq">سوالات متداول</Link>
            <Link href="/contact">تماس و پشتیبانی</Link>
          </div>
        </div>
        <div>
          <h3 className="font-semibold">پشتیبانی</h3>
          <p className="mt-3 text-sm text-white/75">صاحبان بار: ۰۲۱-۹۱۰۰۰۰۰۰</p>
          <p className="mt-1 text-sm text-white/75">ناوگان: ۰۲۱-۹۱۰۰۰۰01</p>
        </div>
      </div>
    </footer>
  );
}

export function SupportFab() {
  return (
    <Link
      href="/contact"
      className="fixed bottom-5 start-5 z-40 grid h-14 w-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg"
      aria-label="پشتیبانی"
    >
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 12a8 8 0 1 1 12 6.9L20 20l-2.2-3.1A8 8 0 0 1 4 12Z" />
      </svg>
    </Link>
  );
}

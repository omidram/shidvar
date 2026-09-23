"use client";

import Link from "next/link";
import { useI18n } from "@/i18n/provider";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/visual/icons";
import { ThemeToggle } from "@/components/theme/theme-toggle";

export function PublicHeader({ ink = false }: { ink?: boolean }) {
  const { t } = useI18n();
  return (
    <header className={ink ? "border-b border-white/10 bg-ink text-white" : "sticky top-0 z-30 border-b border-border bg-card/80 backdrop-blur"}>
      <div className="mx-auto flex h-18 max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-lg">
          <BrandMark className={ink ? "text-white" : ""} />
        </Link>
        <nav className="hidden items-center gap-5 text-sm md:flex">
          <Link href="/#services">{t.nav.services}</Link>
          <Link href="/#why">{t.landing.features}</Link>
          <Link href="/how-it-works">{t.nav.how}</Link>
          <Link href="/#faq">{t.nav.faq}</Link>
          <Link href="/about">{t.nav.about}</Link>
          <Link href="/contact">{t.nav.contact}</Link>
        </nav>
        <div className="flex items-center gap-2">
          <ThemeToggle className={ink ? "border-white/20 bg-white/10 text-white hover:text-primary" : ""} />
          <Button asChild variant={ink ? "outline" : "secondary"} className={ink ? "border-white text-white" : ""}>
            <Link href="/login">{t.nav.login}</Link>
          </Button>
          <Button asChild variant={ink ? "secondary" : "default"}>
            <Link href="/register">{t.nav.register}</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

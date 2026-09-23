"use client";

import Link from "next/link";
import { useState } from "react";
import { BellRing, ChevronDown, FileText, MapPinned, ShieldCheck, TrendingUp, Wallet } from "lucide-react";
import { PublicHeader } from "@/components/layout/public-header";
import { PublicFooter, SupportFab } from "@/components/layout/public-footer";
import { Button } from "@/components/ui/button";
import { ShamsiDateInput } from "@/components/ui/shamsi-date-input";
import { Card } from "@/components/ui/card";
import { ChoiceTile } from "@/components/domain/chrome";
import { useI18n } from "@/i18n/provider";
import { ColdIcon, HeavyTruckIcon, TankerIcon, TruckIcon, VanIcon } from "@/components/visual/icons";
import { VisualField } from "@/components/visual/visual-field";
import { FeatureMedia } from "@/components/visual/feature-motion";
import { Input } from "@/components/ui/input";

const VEHICLES = [
  { key: "VAN", icon: <VanIcon className="h-8 w-8" />, body: "تا ۵۰۰ کیلو" },
  { key: "LIGHT_TRUCK", icon: <TruckIcon className="h-8 w-8" />, body: "بار شهری سنگین" },
  { key: "TRUCK", icon: <HeavyTruckIcon className="h-8 w-8" />, body: "بین‌شهری" },
  { key: "REFRIGERATED", icon: <ColdIcon className="h-8 w-8" />, body: "زنجیره سرد" },
  { key: "TANKER", icon: <TankerIcon className="h-8 w-8" />, body: "مایعات و فله" },
] as const;

const FAQ_KEYS = ["q1", "q2", "q3", "q4", "q5", "q6"] as const;

export default function HomePage() {
  const { t } = useI18n();
  const [vehicle, setVehicle] = useState<(typeof VEHICLES)[number]["key"]>("TRUCK");
  const [origin, setOrigin] = useState("تهران");
  const [destination, setDestination] = useState("آمل");
  const [when, setWhen] = useState("2026-09-01");
  const [openFaq, setOpenFaq] = useState<string | null>("q1");

  const features = [
    { key: "match" as const, title: t.landing.featureFast, body: t.landing.featureFastBody, icon: <ShieldCheck className="h-5 w-5" />, live: false },
    { key: "docs" as const, title: t.landing.featurePrice, body: t.landing.featurePriceBody, icon: <FileText className="h-5 w-5" />, live: false },
    { key: "track" as const, title: t.landing.featureTrack, body: t.landing.featureTrackBody, icon: <MapPinned className="h-5 w-5" />, live: true },
    { key: "wallet" as const, title: t.landing.featureWallet, body: t.landing.featureWalletBody, icon: <Wallet className="h-5 w-5" />, live: false },
    { key: "income" as const, title: t.landing.featureIncome, body: t.landing.featureIncomeBody, icon: <TrendingUp className="h-5 w-5" />, live: false },
    { key: "control" as const, title: t.landing.featureSupport, body: t.landing.featureSupportBody, icon: <BellRing className="h-5 w-5" />, live: true },
  ];

  const howSteps = [
    { title: t.landing.how1, body: t.landing.how1Body },
    { title: t.landing.how2, body: t.landing.how2Body },
    { title: t.landing.how3, body: t.landing.how3Body },
    { title: t.landing.how4, body: t.landing.how4Body },
    { title: t.landing.how5, body: t.landing.how5Body },
  ];

  return (
    <div className="bg-background text-foreground">
      <PublicHeader />
      <section className="relative overflow-hidden bg-ink text-white">
        <video className="absolute inset-0 h-full w-full object-cover opacity-30" autoPlay muted loop playsInline poster="/media/loading-crew.jpg">
          <source src="/media/fleet.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-gradient-to-l from-ink via-ink/80 to-emerald-950/40" />
        <div className="aurora-field pointer-events-none absolute inset-0">
          <span className="glow-orb glow-orb-a" />
          <span className="glow-orb glow-orb-b" />
        </div>
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 md:grid-cols-[1.1fr_0.9fr] md:py-24">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-bold text-primary">
              <span className="live-dot h-2 w-2 rounded-full bg-primary" />
              شیدور · حمل سازمانی B2B
            </p>
            <h1 className="mt-5 text-4xl font-black leading-[1.25] md:text-5xl">{t.landing.hero}</h1>
            <p className="mt-5 max-w-xl text-lg/8 text-white/85">{t.landing.body}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild>
                <Link href="/register?portal=REQUESTER">{t.landing.cta}</Link>
              </Button>
              <Button asChild variant="outline" className="border-white/70 text-white hover:bg-white/10">
                <Link href="/register?portal=DRIVER">{t.landing.ctaDriver}</Link>
              </Button>
            </div>
            <div className="mt-8 flex flex-wrap gap-2 text-xs text-white/75">
              {["راننده تأییدشده", "کیف پول زرین‌پال", "ردیابی با اجازهٔ گوشی"].map((item) => (
                <span key={item} className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5">
                  {item}
                </span>
              ))}
            </div>
          </div>
          <Card className="glass-panel border-white/15 p-6 text-foreground shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-black">{t.landing.bookingTitle}</h2>
                <p className="mt-1 text-sm text-muted">{t.request.example}</p>
              </div>
              <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary">{t.vehicle[vehicle]}</span>
            </div>
            <div className="mt-5 grid gap-3">
              <label className="grid gap-1.5 text-sm font-medium">
                {t.landing.origin}
                <Input value={origin} onChange={(e) => setOrigin(e.target.value)} />
              </label>
              <div className="flex items-center gap-3 px-1">
                <span className="h-px flex-1 bg-border" />
                <span className="text-xs text-muted">{origin} ← {destination}</span>
                <span className="h-px flex-1 bg-border" />
              </div>
              <label className="grid gap-1.5 text-sm font-medium">
                {t.landing.destination}
                <Input value={destination} onChange={(e) => setDestination(e.target.value)} />
              </label>
              <label className="grid gap-1.5 text-sm font-medium">
                {t.landing.when}
                <ShamsiDateInput value={when} onChange={setWhen} />
              </label>
              <Button asChild className="mt-1 w-full">
                <Link href={`/register?portal=REQUESTER&vehicle=${vehicle}&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}`}>
                  {t.landing.book}
                </Link>
              </Button>
            </div>
          </Card>
        </div>
      </section>

      <section id="services" className="relative overflow-hidden bg-surface-soft">
        <div className="mesh-grid pointer-events-none absolute inset-0 opacity-70" />
        <div className="relative mx-auto max-w-6xl px-4 py-16">
          <div className="max-w-2xl">
            <p className="text-sm font-bold text-primary">انتخاب ناوگان</p>
            <h2 className="mt-2 text-3xl font-black">{t.landing.services}</h2>
            <p className="mt-2 text-muted">{t.landing.servicesBody}</p>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {VEHICLES.map((item, index) => (
              <ChoiceTile
                key={item.key}
                title={t.vehicle[item.key]}
                body={item.body}
                icon={item.icon}
                active={vehicle === item.key}
                badge={index === 2 ? "پیشنهادی" : undefined}
                onClick={() => setVehicle(item.key)}
              />
            ))}
          </div>
        </div>
      </section>

      <section id="why" className="relative mx-auto max-w-6xl px-4 py-16">
        <div className="mb-8 max-w-2xl">
          <h2 className="text-3xl font-black">{t.landing.features}</h2>
          <p className="mt-2 text-muted">{t.landing.featuresBody}</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {features.map((item) => (
            <Card key={item.key} className="group overflow-hidden p-0 transition hover:-translate-y-1 hover:border-primary/40">
              <FeatureMedia kind={item.key}>
                <div className="relative z-10 flex h-full items-end justify-between p-5 text-white">
                  <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/15 backdrop-blur">
                    {item.icon}
                  </div>
                  {item.live ? <span className="live-dot h-3 w-3 rounded-full bg-white" /> : null}
                </div>
              </FeatureMedia>
              <div className="p-5">
                <h3 className="text-lg font-bold">{item.title}</h3>
                <p className="mt-2 text-sm leading-7 text-muted">{item.body}</p>
              </div>
            </Card>
          ))}
        </div>
        <div className="mt-6 grid overflow-hidden rounded-3xl border border-border bg-card md:grid-cols-3">
          {[
            { value: "+۱۲٬۰۰۰", label: t.landing.statsShipments, tone: "bg-primary text-primary-foreground" },
            { value: "۲۴", label: t.landing.statsCities, tone: "bg-card" },
            { value: "۳۸۰", label: t.landing.statsFleet, tone: "bg-card" },
          ].map((item) => (
            <div key={item.label} className={`px-6 py-7 ${item.tone}`}>
              <div className="text-4xl font-black tracking-tight">{item.value}</div>
              <div className="mt-2 text-sm font-medium opacity-80">{item.label}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="relative overflow-hidden bg-background">
        <div className="pointer-events-none absolute inset-0 mesh-grid opacity-40" />
        <div className="relative mx-auto grid max-w-6xl gap-10 px-4 py-16 lg:grid-cols-2">
          <div id="how">
            <h2 className="text-3xl font-black">{t.landing.howTitle}</h2>
            <p className="mt-2 text-muted">{t.landing.howBody}</p>
            <VisualField className="mt-6 h-52 rounded-3xl bg-ink">
              <img src="/media/loading-crew.jpg" alt="" className="absolute inset-0 h-full w-full object-cover opacity-45" />
              <div className="relative z-10 flex h-full items-end p-5 text-white">
                <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-bold backdrop-blur">
                  مسیر زنده سازمانی
                </span>
              </div>
            </VisualField>
            <ol className="mt-6 grid gap-3">
              {howSteps.map((step, i) => (
                <li key={step.title} className="flex items-start gap-3 rounded-3xl border border-border bg-card p-4 card-shadow">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-ink text-sm font-black text-white">{i + 1}</div>
                  <div>
                    <div className="text-sm font-bold">{step.title}</div>
                    <p className="mt-1 text-sm leading-6 text-muted">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <div id="faq">
            <h2 className="text-3xl font-black">{t.landing.faqTitle}</h2>
            <VisualField className="mt-6 h-52 rounded-3xl bg-emerald-900">
              <img src="/media/truck-illustration.jpg" alt="" className="absolute inset-0 h-full w-full object-cover opacity-40" />
              <div className="relative z-10 flex h-full items-end p-5 text-white">
                <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-bold backdrop-blur">
                  پاسخ شفاف برای صاحب بار و راننده
                </span>
              </div>
            </VisualField>
            <div className="mt-6 grid gap-2">
              {FAQ_KEYS.map((key) => {
                const open = openFaq === key;
                const answerKey = `a${key.slice(1)}` as "a1" | "a2" | "a3" | "a4" | "a5" | "a6";
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setOpenFaq(open ? null : key)}
                    className="rounded-3xl border border-border bg-card p-4 text-start transition hover:border-primary/40"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-semibold">{t.faq[key]}</div>
                      <ChevronDown className={`h-4 w-4 shrink-0 text-muted transition ${open ? "rotate-180" : ""}`} />
                    </div>
                    {open ? <p className="mt-2 text-sm leading-7 text-muted">{t.faq[answerKey]}</p> : null}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-10">
        <Card className="relative overflow-hidden bg-ink p-0 text-white">
          <div className="aurora-field pointer-events-none absolute inset-0">
            <span className="glow-orb glow-orb-a" />
            <span className="glow-orb glow-orb-c" />
          </div>
          <div className="relative grid gap-6 p-8 md:grid-cols-[1.2fr_0.8fr] md:items-center">
            <div>
              <h2 className="text-2xl font-black">{t.landing.citiesTitle}</h2>
              <p className="mt-2 text-white/70">{t.landing.citiesBody}</p>
              <div className="mt-6 flex flex-wrap gap-2">
                {["تهران", "آمل", "کرج", "اصفهان", "مشهد", "شیراز", "تبریز", "اهواز", "قم"].map((city) => (
                  <span key={city} className="rounded-full bg-white/10 px-3 py-1.5 text-sm">
                    {city}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <Button asChild>
                <Link href="/register?portal=REQUESTER">{t.landing.cta}</Link>
              </Button>
              <Button asChild variant="outline" className="border-white/40 text-white">
                <Link href="/register?portal=DRIVER">{t.landing.ctaDriver}</Link>
              </Button>
            </div>
          </div>
        </Card>
      </section>
      <PublicFooter />
      <SupportFab />
    </div>
  );
}

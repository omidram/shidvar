"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

function LoopVideo({ src, fallback }: { src: string; fallback: ReactNode }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const markReady = () => setReady(true);
    if (el.readyState >= 3) markReady();
    el.addEventListener("canplay", markReady);
    el.addEventListener("loadeddata", markReady);
    return () => {
      el.removeEventListener("canplay", markReady);
      el.removeEventListener("loadeddata", markReady);
    };
  }, [src]);

  if (failed) return <>{fallback}</>;

  return (
    <>
      {ready ? null : fallback}
      <video
        ref={videoRef}
        className={cn("absolute inset-0 h-full w-full object-cover transition-opacity duration-500", ready ? "opacity-100" : "opacity-0")}
        src={src}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        onError={() => setFailed(true)}
      />
    </>
  );
}

function KenBurns({ src }: { src: string }) {
  return <img src={src} alt="" className="feature-ken absolute inset-0 h-full w-full object-cover opacity-55" />;
}

function DriverMotion() {
  return (
    <div className="feature-motion feature-motion-match absolute inset-0" aria-hidden>
      <KenBurns src="/media/cargo-1.jpg" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgb(34_211_122_/_0.28),transparent_46%),linear-gradient(to_top,rgb(11_18_32_/_0.55),transparent)]" />
      <svg viewBox="0 0 360 180" className="absolute inset-0 h-full w-full">
        <path className="income-path" d="M28 128 C 110 108, 170 92, 250 70" fill="none" stroke="#22d37a" strokeWidth="3" strokeDasharray="10 8" />
        <g filter="url(#soft-none)">
          <rect x="-22" y="-12" width="40" height="22" rx="6" fill="#00b562" />
          <rect x="16" y="-6" width="16" height="16" rx="4" fill="#04210f" />
          <circle cx="-10" cy="12" r="5" fill="#0b1220" stroke="#bbf7d0" strokeWidth="2" />
          <circle cx="18" cy="12" r="5" fill="#0b1220" stroke="#bbf7d0" strokeWidth="2" />
          <animateMotion dur="4.8s" repeatCount="indefinite" rotate="auto" path="M28 128 C 110 108, 170 92, 250 70" />
        </g>
      </svg>
      <div className="float-chip start-3 top-3">راننده تأییدشده</div>
      <div className="float-chip end-3 bottom-3 delay-mid">محدوده ناوگان</div>
    </div>
  );
}

function DocsMotion() {
  return (
    <div className="feature-motion feature-motion-docs absolute inset-0" aria-hidden>
      <KenBurns src="/media/invoice-illustration.jpg" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_10%,rgb(132_204_22_/_0.28),transparent_46%),linear-gradient(to_top,rgb(11_18_32_/_0.6),transparent)]" />
      <div className="doc-sheet">
        <b>بارنامه SHP-1405</b>
        <span>فاکتور PDF آماده است</span>
      </div>
      <div className="float-chip end-3 top-3">صدور فوری</div>
    </div>
  );
}

function TrackMotion() {
  return (
    <div className="feature-motion feature-motion-track absolute inset-0" aria-hidden>
      <KenBurns src="/media/tracking-phone.jpg" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgb(56_189_248_/_0.26),transparent_42%),linear-gradient(to_top,rgb(11_18_32_/_0.55),transparent)]" />
      <span className="gps-ping absolute start-[42%] top-[38%] h-16 w-16 rounded-full border border-primary/60" />
      <div className="float-chip start-3 top-3">اجازه گوشی</div>
      <div className="float-chip end-3 bottom-3 delay-mid">سفر فعال</div>
    </div>
  );
}

function WalletMotion() {
  return (
    <div className="feature-motion feature-motion-wallet absolute inset-0" aria-hidden>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_16%_12%,rgb(34_211_122_/_0.38),transparent_42%),radial-gradient(circle_at_88%_86%,rgb(250_204_21_/_0.22),transparent_40%),linear-gradient(160deg,#04210f,#0b1220_62%)]" />
      <div className="dot-grid absolute inset-0 opacity-25" />
      <svg viewBox="0 0 360 180" className="absolute inset-0 h-full w-full">
        <defs>
          <linearGradient id="wallet-face" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#4ade80" />
            <stop offset="100%" stopColor="#047857" />
          </linearGradient>
          <filter id="wallet-glow">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <g className="coin coin-a" filter="url(#wallet-glow)">
          <circle cx="58" cy="18" r="13" fill="#facc15" />
          <text x="58" y="23" textAnchor="middle" fill="#3f2a00" fontSize="11" fontWeight="800">
            ﷼
          </text>
        </g>
        <g className="coin coin-b">
          <circle cx="108" cy="10" r="10" fill="#22d37a" />
          <text x="108" y="14" textAnchor="middle" fill="#04210f" fontSize="9" fontWeight="800">
            ﷼
          </text>
        </g>
        <g className="coin coin-c">
          <circle cx="82" cy="4" r="8" fill="#86efac" />
        </g>
        <g className="wallet-card" transform="translate(68 58)">
          <rect width="224" height="96" rx="24" fill="#04140c" opacity="0.88" />
          <rect x="12" y="12" width="148" height="72" rx="18" fill="url(#wallet-face)" />
          <rect x="172" y="24" width="36" height="48" rx="12" fill="#f8fafc" />
          <circle cx="190" cy="48" r="9" fill="#00b562" />
          <text x="26" y="42" fill="#04210f" fontSize="15" fontWeight="800">
            کیف پول ریالی
          </text>
          <text x="26" y="62" fill="#04210f" fontSize="11">
            ۱۲٬۴۵۰٬۰۰۰ ریال
          </text>
        </g>
      </svg>
      <div className="sheba-strip">IR12 · شبا تأییدشده</div>
      <div className="float-chip end-3 bottom-3 delay-mid">برداشت آنی</div>
      <div className="zarin-badge">زرین‌پال</div>
    </div>
  );
}

function IncomeMotion() {
  return (
    <div className="feature-motion feature-motion-income absolute inset-0" aria-hidden>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_84%_8%,rgb(167_139_250_/_0.28),transparent_42%),radial-gradient(circle_at_10%_88%,rgb(34_211_122_/_0.26),transparent_40%),linear-gradient(180deg,#0b1220,#111827)]" />
      <svg viewBox="0 0 360 180" className="absolute inset-0 h-full w-full">
        <path className="income-path" d="M28 128 C 90 118, 150 72, 210 86 S 300 48, 336 40" fill="none" stroke="#22d37a" strokeWidth="3" strokeDasharray="10 8" />
        <circle className="income-dot" r="6" fill="#bbf7d0">
          <animateMotion dur="3.2s" repeatCount="indefinite" path="M28 128 C 90 118, 150 72, 210 86 S 300 48, 336 40" />
        </circle>
        <g transform="translate(28 78)">
          <rect className="income-bar bar-a" x="0" y="18" width="16" height="52" rx="6" fill="#22d37a" />
          <rect className="income-bar bar-b" x="26" y="8" width="16" height="62" rx="6" fill="#4ade80" />
          <rect className="income-bar bar-c" x="52" y="28" width="16" height="42" rx="6" fill="#86efac" />
          <rect className="income-bar bar-d" x="78" y="2" width="16" height="68" rx="6" fill="#00b562" />
        </g>
      </svg>
      <div className="income-row income-in">+ کرایه سفر</div>
      <div className="income-row income-out delay-mid">− سوخت و عوارض</div>
      <div className="income-meter">
        <span>سود خالص مسیر</span>
        <i />
      </div>
    </div>
  );
}

function ControlMotion() {
  return (
    <div className="feature-motion feature-motion-control absolute inset-0" aria-hidden>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_14%,rgb(34_211_122_/_0.28),transparent_40%),radial-gradient(circle_at_88%_78%,rgb(56_189_248_/_0.24),transparent_44%),linear-gradient(200deg,#0b1220,#102018)]" />
      <div className="bell-wrap">
        <svg viewBox="0 0 48 48" className="h-10 w-10 text-white">
          <path
            className="bell-ring"
            d="M24 6a10 10 0 0 0-10 10v7l-3 6h26l-3-6v-7A10 10 0 0 0 24 6Zm-5 30a5 5 0 0 0 10 0"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span className="bell-count">۳</span>
      </div>
      <div className="note-card note-a">بار جدید در محدوده</div>
      <div className="note-card note-b">قواعد تطبیق به‌روز شد</div>
      <div className="note-card note-c">لاگ ممیزی ثبت شد</div>
      <div className="audit-stamp">ممیزی زنده</div>
      <span className="live-dot absolute end-4 top-4 h-3 w-3 rounded-full bg-primary" />
    </div>
  );
}

export function FeatureMedia({
  kind,
  className,
  children,
}: {
  kind: "match" | "docs" | "track" | "wallet" | "income" | "control";
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div className={cn("relative isolate h-44 overflow-hidden bg-ink", className)}>
      {kind === "match" ? (
        <LoopVideo src="/media/driver.mp4" fallback={<DriverMotion />} />
      ) : null}
      {kind === "docs" ? <LoopVideo src="/media/bill.mp4" fallback={<DocsMotion />} /> : null}
      {kind === "track" ? <LoopVideo src="/media/tracking.mp4" fallback={<TrackMotion />} /> : null}
      {kind === "wallet" ? <WalletMotion /> : null}
      {kind === "income" ? <IncomeMotion /> : null}
      {kind === "control" ? <ControlMotion /> : null}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink/75 via-ink/10 to-transparent" />
      {children}
    </div>
  );
}

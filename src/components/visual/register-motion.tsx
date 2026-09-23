export function RegisterMotion() {
  return (
    <div className="register-motion pointer-events-none absolute inset-0" aria-hidden>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(0,181,98,0.18),transparent_42%),radial-gradient(circle_at_80%_10%,rgba(109,40,217,0.16),transparent_36%)]" />
      <div className="dot-grid absolute inset-0 opacity-40" />

      <svg viewBox="0 0 560 640" className="absolute inset-0 h-full w-full">
        <defs>
          <linearGradient id="route-line" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#00b562" />
            <stop offset="100%" stopColor="#6ee7b7" />
          </linearGradient>
          <filter id="soft-glow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <path
          className="route-draw"
          d="M92 430 C 150 360, 170 300, 230 250 S 360 180, 430 150"
          fill="none"
          stroke="url(#route-line)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray="14 12"
          filter="url(#soft-glow)"
        />
        <path
          className="route-draw-slow"
          d="M92 430 C 150 360, 170 300, 230 250 S 360 180, 430 150"
          fill="none"
          stroke="#00b562"
          strokeOpacity="0.25"
          strokeWidth="14"
          strokeLinecap="round"
        />

        <g className="city-pulse" transform="translate(92 430)">
          <circle r="28" fill="#00b562" opacity="0.12" />
          <circle r="10" fill="#00b562" />
          <text x="18" y="6" fill="#f8fafc" fontSize="18" fontWeight="700">تهران</text>
        </g>
        <g className="city-pulse delay-long" transform="translate(430 150)">
          <circle r="28" fill="#6d28d9" opacity="0.16" />
          <circle r="10" fill="#a78bfa" />
          <text x="-58" y="-18" fill="#f8fafc" fontSize="18" fontWeight="700">آمل</text>
        </g>

        <g filter="url(#soft-glow)">
          <rect x="-34" y="-18" width="52" height="28" rx="8" fill="#00b562" />
          <rect x="16" y="-10" width="22" height="20" rx="5" fill="#04210f" />
          <circle cx="-16" cy="14" r="6" fill="#0b1220" stroke="#bbf7d0" strokeWidth="2" />
          <circle cx="18" cy="14" r="6" fill="#0b1220" stroke="#bbf7d0" strokeWidth="2" />
          <animateMotion
            dur="6s"
            repeatCount="indefinite"
            rotate="auto"
            keyTimes="0;1"
            keyPoints="0;1"
            calcMode="linear"
            path="M92 430 C 150 360, 170 300, 230 250 S 360 180, 430 150"
          />
        </g>
      </svg>

      <div className="float-card absolute start-[12%] top-[14%] rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-white backdrop-blur">
        <div className="text-[11px] text-primary">بارنامه</div>
        <div className="mt-1 text-sm font-bold">SHP-1405-0022</div>
        <div className="mt-1 text-xs text-white/65">تهران ← آمل</div>
      </div>
      <div className="float-card delay-mid absolute end-[10%] top-[28%] rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-white backdrop-blur">
        <div className="text-[11px] text-violet-300">فاکتور</div>
        <div className="mt-1 text-sm font-bold">خودکار صادر شد</div>
        <div className="mt-1 text-xs text-white/65">بعد از قبول راننده</div>
      </div>
      <div className="gps-ping absolute start-[38%] top-[40%] h-16 w-16 rounded-full border border-primary/50" />
    </div>
  );
}

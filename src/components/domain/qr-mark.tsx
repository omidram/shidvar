"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { cn } from "@/lib/utils";

export function qrPayload(kind: "invoice" | "load" | "request", number: string) {
  return `SHIDVAR:${kind.toUpperCase()}:${number}`;
}

export function QrMark({
  value,
  label,
  size = 78,
  className,
}: {
  value?: string | null;
  label?: string;
  size?: number;
  className?: string;
}) {
  const [svg, setSvg] = useState("");
  useEffect(() => {
    if (!value) {
      setSvg("");
      return;
    }
    QRCode.toString(value, {
      type: "svg",
      margin: 0,
      width: size,
      errorCorrectionLevel: "M",
      color: { dark: "#0b1220", light: "#ffffff" },
    }).then(setSvg);
  }, [value, size]);

  if (!value) return null;

  return (
    <figure className={cn("grid justify-items-center gap-0.5", className)}>
      <div
        className="overflow-hidden rounded-md border border-border bg-white p-0.5"
        style={{ width: size, height: size }}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      {label ? <figcaption className="max-w-[88px] text-center text-[9px] font-bold leading-tight">{label}</figcaption> : null}
    </figure>
  );
}

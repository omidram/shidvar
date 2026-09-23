"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDateTime } from "@/lib/utils";
import type { SignatureRole } from "@/lib/documents";

type Point = { x: number; y: number };

const ROLE_LABEL: Record<SignatureRole, string> = {
  receiver: "امضای گیرنده",
  driver: "امضای راننده",
  issuer: "امضای صاحب بار",
  company: "نمونه امضای مجاز",
};

function canvasPoint(canvas: HTMLCanvasElement, event: PointerEvent): Point {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return { x: (event.clientX - rect.left) * scaleX, y: (event.clientY - rect.top) * scaleY };
}

function setupCanvas(canvas: HTMLCanvasElement) {
  const ratio = Math.max(window.devicePixelRatio || 1, 1);
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  canvas.width = Math.floor(width * ratio);
  canvas.height = Math.floor(height * ratio);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#111827";
  ctx.lineWidth = 2.4 * ratio;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function isBlank(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return true;
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < data.length; i += 16) {
    if (data[i] < 250 || data[i + 1] < 250 || data[i + 2] < 250) return false;
  }
  return true;
}

export async function composeSignedReceipt(input: {
  signature: Blob;
  title: string;
  number: string;
  signerName: string;
  waybill?: string | null;
}): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = 900;
  canvas.height = 560;
  const ctx = canvas.getContext("2d");
  if (!ctx) return input.signature;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#111827";
  ctx.textAlign = "right";
  ctx.font = "bold 28px Tahoma, sans-serif";
  ctx.fillText(input.title, canvas.width - 40, 56);
  ctx.font = "16px Tahoma, sans-serif";
  ctx.fillStyle = "#4b5563";
  ctx.fillText("رسید تحویل الکترونیک", canvas.width - 40, 88);
  ctx.fillStyle = "#111827";
  ctx.font = "18px Tahoma, sans-serif";
  const lines = [
    `شماره مأموریت: ${input.number}`,
    input.waybill ? `بارنامه: ${input.waybill}` : null,
    `امضاکننده: ${input.signerName}`,
    `زمان امضا: ${formatDateTime(new Date())}`,
  ].filter(Boolean) as string[];
  lines.forEach((line, index) => ctx.fillText(line, canvas.width - 40, 140 + index * 32));
  ctx.font = "16px Tahoma, sans-serif";
  ctx.fillStyle = "#374151";
  ctx.fillText("با این امضا، دریافت محموله تأیید می‌شود.", canvas.width - 40, 300);
  const image = await createImageBitmap(input.signature);
  const signW = 420;
  const signH = 160;
  ctx.strokeStyle = "#d1d5db";
  ctx.strokeRect(canvas.width - 40 - signW, 340, signW, signH);
  ctx.drawImage(image, canvas.width - 36 - signW, 344, signW - 8, signH - 8);
  ctx.fillStyle = "#6b7280";
  ctx.font = "13px Tahoma, sans-serif";
  ctx.fillText("امضای الکترونیک گیرنده", canvas.width - 40, 528);
  return await new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("ساخت رسید ناموفق بود"))), "image/png");
  });
}

export function SignatureCapture({
  role,
  title,
  defaultName,
  saving,
  onCancel,
  onSave,
}: {
  role: SignatureRole;
  title: string;
  defaultName?: string;
  saving?: boolean;
  onCancel: () => void;
  onSave: (result: { blob: Blob; signerName: string }) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const last = useRef<Point | null>(null);
  const [name, setName] = useState(defaultName ?? "");
  const [error, setError] = useState("");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setupCanvas(canvas);
    const onResize = () => setupCanvas(canvas);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  function paint(event: PointerEvent) {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !last.current) return;
    const next = canvasPoint(canvas, event);
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(next.x, next.y);
    ctx.stroke();
    last.current = next;
  }

  function start(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    event.preventDefault();
    canvas.setPointerCapture(event.pointerId);
    last.current = canvasPoint(canvas, event.nativeEvent);
    setError("");
  }

  function move(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!last.current) return;
    event.preventDefault();
    paint(event.nativeEvent);
  }

  function end() {
    last.current = null;
  }

  function clear() {
    const canvas = canvasRef.current;
    if (canvas) setupCanvas(canvas);
    setError("");
  }

  function save() {
    const canvas = canvasRef.current;
    const signerName = name.trim();
    if (!signerName) {
      setError("نام امضاکننده را بنویسید");
      return;
    }
    if (!canvas || isBlank(canvas)) {
      setError("امضا روی صفحه کشیده نشده است");
      return;
    }
    canvas.toBlob((blob) => {
      if (!blob) {
        setError("ذخیره امضا ناموفق بود");
        return;
      }
      onSave({ blob, signerName });
    }, "image/png");
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-ink/50 p-3 sm:place-items-center">
      <div className="w-full max-w-xl rounded-3xl border border-border bg-card p-5 shadow-xl">
        <h2 className="text-lg font-bold">{ROLE_LABEL[role]}</h2>
        <p className="mt-1 text-sm text-muted">{title}</p>
        <label className="mt-4 grid gap-1 text-sm">
          نام امضاکننده
          <Input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <canvas
          ref={canvasRef}
          className="mt-4 h-48 w-full touch-none rounded-2xl border border-border bg-white"
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
        />
        {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onCancel} disabled={saving}>
            انصراف
          </Button>
          <Button type="button" variant="secondary" onClick={clear} disabled={saving}>
            پاک کردن
          </Button>
          <Button type="button" onClick={save} disabled={saving}>
            {saving ? "در حال ذخیره…" : "ثبت امضا"}
          </Button>
        </div>
      </div>
    </div>
  );
}

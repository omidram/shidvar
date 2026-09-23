"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { api, formatApiError } from "@/lib/api";
import { slotsFor, type DocumentSlot } from "@/lib/documents";
import { StatusBadge } from "@/components/ui/badge";
import { useMe } from "@/hooks/use-me";
import { composeSignedReceipt, SignatureCapture } from "@/components/domain/signature-pad";

export type DocRow = {
  id: string;
  originalName: string;
  mimeType: string;
  documentType: string;
  verification: string;
  url: string;
  isImage: boolean;
};

type Checklist = {
  complete: boolean;
  entityId: string;
  entityType: string;
  items: Array<DocumentSlot & { document: DocRow | null }>;
};

export async function uploadFile(input: { file: File; documentType: string; entityType: string; entityId: string }) {
  const form = new FormData();
  form.append("file", input.file);
  form.append("documentType", input.documentType);
  form.append("entityType", input.entityType);
  form.append("entityId", input.entityId);
  let res: Response;
  try {
    res = await fetch("/api/v1/documents/upload", { method: "POST", body: form, credentials: "include" });
  } catch {
    throw new Error("اتصال به سرور برقرار نشد");
  }
  const json = (await res.json().catch(() => null)) as { success: boolean; data?: DocRow; error?: { message: string } } | null;
  if (!res.ok || !json?.success) throw new Error(json?.error?.message ?? "بارگذاری ناموفق بود");
  return json.data!;
}

export function DocumentGallery({
  kind,
  entityId,
  title,
  canUpload = true,
  canVerify = false,
  canSign,
  context,
}: {
  kind: DocumentSlot["kinds"][number];
  entityId: string;
  title: string;
  canUpload?: boolean | ((slot: DocumentSlot) => boolean);
  canVerify?: boolean;
  canSign?: (slot: DocumentSlot) => boolean;
  context?: { number?: string; waybill?: string | null };
}) {
  const qc = useQueryClient();
  const me = useMe();
  const entityType = kind === "company" ? "Company" : kind === "vehicle" ? "Vehicle" : kind === "job" ? "TransportationJob" : "DriverProfile";
  const jobKind = kind === "job";
  const [signing, setSigning] = useState<DocumentSlot | null>(null);
  const [savingSign, setSavingSign] = useState(false);
  const q = useQuery({
    queryKey: ["docs", entityType, entityId],
    queryFn: () => api<Checklist>(`/documents/checklist?kind=${kind}&entityId=${entityId}`),
    enabled: Boolean(entityId),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/documents/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["docs", entityType, entityId] });
      if (jobKind) qc.invalidateQueries({ queryKey: ["job", entityId] });
    },
  });
  const verify = useMutation({
    mutationFn: (input: { id: string; verification: "VERIFIED" | "REJECTED" }) =>
      api(`/documents/${input.id}/verify`, { method: "POST", body: JSON.stringify({ verification: input.verification }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["docs", entityType, entityId] });
      if (jobKind) qc.invalidateQueries({ queryKey: ["job", entityId] });
    },
  });

  function allowUpload(slot: DocumentSlot) {
    return typeof canUpload === "function" ? canUpload(slot) : canUpload;
  }

  function allowSign(slot: DocumentSlot) {
    if (!slot.signable) return false;
    return canSign ? canSign(slot) : allowUpload(slot);
  }

  async function refresh() {
    qc.invalidateQueries({ queryKey: ["docs", entityType, entityId] });
    qc.invalidateQueries({ queryKey: ["docs-me"] });
    if (jobKind) qc.invalidateQueries({ queryKey: ["job", entityId] });
  }

  async function onPick(type: string, file?: File) {
    if (!file) return;
    try {
      await uploadFile({ file, documentType: type, entityType, entityId });
      toast.success("مدرک بارگذاری شد");
      await refresh();
    } catch (error) {
      toast.error(formatApiError(error, "بارگذاری ناموفق بود"));
    }
  }

  async function onSaveSignature(result: { blob: Blob; signerName: string }) {
    if (!signing) return;
    setSavingSign(true);
    try {
      const blob =
        signing.type === "JOB_POD_RECEIPT"
          ? await composeSignedReceipt({
              signature: result.blob,
              title: "رسید تحویل کالا",
              number: context?.number ?? entityId.slice(0, 8),
              signerName: result.signerName,
              waybill: context?.waybill,
            })
          : result.blob;
      const file = new File([blob], `esign-${signing.type}.png`, { type: "image/png" });
      await uploadFile({ file, documentType: signing.type, entityType, entityId });
      toast.success("امضای الکترونیک ثبت شد");
      setSigning(null);
      await refresh();
    } catch (error) {
      toast.error(formatApiError(error, "ثبت امضا ناموفق بود"));
    } finally {
      setSavingSign(false);
    }
  }

  const items = q.data?.items ?? slotsFor(kind).map((slot) => ({ ...slot, document: null }));
  const defaultSignerName = signing
    ? signing.signatureRole === "receiver"
      ? ""
      : `${me.data?.firstName ?? ""} ${me.data?.lastName ?? ""}`.trim()
    : "";

  return (
    <Card className="grid gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">{title}</h2>
          <p className="mt-1 text-sm text-muted">
            {jobKind
              ? "امضای الکترونیک روی گوشی، یا عکس سند امضاشده. تصویر یا PDF تا ۲۰ مگابایت."
              : "مدارک تصویر یا PDF تا ۲۰ مگابایت. موارد ستاره‌دار الزامی است. برای نمونه امضا می‌توانید امضای الکترونیک بگذارید."}
          </p>
        </div>
        {q.data ? (
          <span className={`text-sm font-semibold ${q.data.complete ? "text-primary" : "text-danger"}`}>
            {q.data.complete ? "مدارک کامل است" : "مدارک ناقص است"}
          </span>
        ) : null}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {items.map((slot) => {
          const upload = allowUpload(slot);
          const sign = allowSign(slot);
          return (
            <div key={slot.type} className="rounded-2xl border border-border p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-semibold">
                    {slot.label}
                    {slot.required ? <span className="ms-1 text-danger">*</span> : null}
                  </div>
                  <p className="mt-1 text-xs text-muted">{slot.hint}</p>
                </div>
                {slot.document ? <StatusBadge status={slot.document.verification} /> : null}
              </div>
              {slot.document?.isImage ? (
                <a href={slot.document.url} target="_blank" rel="noreferrer" className="mt-3 block">
                  <img src={slot.document.url} alt={slot.label} className="h-36 w-full rounded-xl bg-white object-contain" />
                </a>
              ) : slot.document ? (
                <a href={slot.document.url} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm text-primary">
                  مشاهده {slot.document.originalName}
                </a>
              ) : (
                <p className="mt-3 text-sm text-muted">هنوز ثبت نشده</p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                {sign ? (
                  <Button type="button" onClick={() => setSigning(slot)}>
                    امضای الکترونیک
                  </Button>
                ) : null}
                {upload && jobKind ? (
                  <>
                    <label className="inline-flex h-9 cursor-pointer items-center rounded-xl border border-border bg-background px-3 text-xs font-bold">
                      عکس با دوربین
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={(e) => onPick(slot.type, e.target.files?.[0])}
                      />
                    </label>
                    <label className="inline-flex h-9 cursor-pointer items-center rounded-xl border border-border bg-background px-3 text-xs font-bold">
                      {slot.document ? "جایگزینی فایل" : "انتخاب فایل"}
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        className="hidden"
                        onChange={(e) => onPick(slot.type, e.target.files?.[0])}
                      />
                    </label>
                  </>
                ) : upload ? (
                  <label className="inline-flex h-9 cursor-pointer items-center rounded-xl bg-primary px-3 text-xs font-bold text-primary-foreground">
                    {slot.document ? "جایگزینی" : "بارگذاری"}
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      className="hidden"
                      onChange={(e) => onPick(slot.type, e.target.files?.[0])}
                    />
                  </label>
                ) : null}
                {slot.document && (upload || sign) ? (
                  <Button type="button" variant="secondary" onClick={() => remove.mutate(slot.document!.id)}>
                    حذف
                  </Button>
                ) : null}
                {slot.document && canVerify ? (
                  <>
                    <Button type="button" onClick={() => verify.mutate({ id: slot.document!.id, verification: "VERIFIED" })}>
                      تأیید مدرک
                    </Button>
                    <Button type="button" variant="secondary" onClick={() => verify.mutate({ id: slot.document!.id, verification: "REJECTED" })}>
                      رد مدرک
                    </Button>
                  </>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
      {signing ? (
        <SignatureCapture
          role={signing.signatureRole ?? "receiver"}
          title={signing.label}
          defaultName={defaultSignerName}
          saving={savingSign}
          onCancel={() => setSigning(null)}
          onSave={onSaveSignature}
        />
      ) : null}
    </Card>
  );
}

export function OwnDocumentGate() {
  const q = useQuery({
    queryKey: ["docs-me"],
    queryFn: () =>
      api<{
        driver: Checklist | null;
        vehicle: Checklist | null;
        company: Checklist | null;
      }>("/documents/me"),
  });
  if (q.isLoading) return <p>در حال بارگذاری مدارک…</p>;
  const driver = q.data?.driver;
  const vehicle = q.data?.vehicle;
  const company = q.data?.company;
  return (
    <div className="grid gap-4">
      <p className="text-sm leading-7 text-muted">
        قبل از تأیید مدیریت، مدارک الزامی را بارگذاری کنید. بعد از تکمیل، وضعیت از همین صفحه پیگیری می‌شود.
      </p>
      {driver ? <DocumentGallery kind="driver" entityId={driver.entityId} title="مدارک راننده" /> : null}
      {vehicle ? <DocumentGallery kind="vehicle" entityId={vehicle.entityId} title="مدارک خودرو" /> : null}
      {company ? <DocumentGallery kind="company" entityId={company.entityId} title="مدارک شرکت" /> : null}
    </div>
  );
}

"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { api, liveInterval } from "@/lib/api";
import { useI18n } from "@/i18n/provider";
import { useMe } from "@/hooks/use-me";
import { formatDateTime, formatMoney } from "@/lib/utils";
import { cn } from "@/lib/utils";

const EXTRA_KINDS = [
  { id: "DETENTION", label: "حق توقف" },
  { id: "WAITING", label: "انتظار بارگیری" },
  { id: "EXTRA_LABOR", label: "کارگر اضافه" },
  { id: "FUEL", label: "سوخت اضافه" },
  { id: "RETURN", label: "برگشت بار" },
  { id: "OTHER", label: "سایر" },
] as const;

const DISPUTE_REASONS = [
  { id: "DAMAGE", label: "آسیب بار" },
  { id: "SHORTAGE", label: "کسری کالا" },
  { id: "DELAY", label: "تأخیر" },
  { id: "OVERCHARGE", label: "هزینه اضافه" },
  { id: "NO_SHOW", label: "عدم حضور" },
  { id: "OTHER", label: "سایر" },
] as const;

type JobMessage = { id: string; body: string; createdAt: string; senderId: string; senderName: string };
type JobExtra = { id: string; kind: string; label: string; amount: number; currencyCode: string; status: string; note: string };
type JobRating = { id: string; targetType: string; overall: number; comment?: string | null; mine: boolean; rater: string };

function fieldClass() {
  return "h-11 w-full rounded-2xl border border-border bg-background px-3 text-sm";
}

export function JobOpsPanel({
  jobId,
  status,
  currencyCode,
  receiverName,
}: {
  jobId: string;
  status: string;
  currencyCode?: string;
  receiverName?: string | null;
}) {
  const assigned = !["OFFERED_TO_DRIVERS", "DRIVER_APPLIED", "MATCHING", "CANCELLED"].includes(status);
  if (!assigned) return null;
  return (
    <div className="grid gap-4">
      <JobChat jobId={jobId} />
      <JobExtras jobId={jobId} currencyCode={currencyCode} />
      <JobDeliveryActions jobId={jobId} status={status} receiverName={receiverName} />
      <JobRatingCard jobId={jobId} status={status} />
    </div>
  );
}

function JobChat({ jobId }: { jobId: string }) {
  const { t } = useI18n();
  const me = useMe();
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const q = useQuery({
    queryKey: ["job-messages", jobId],
    queryFn: () => api<{ conversationId: string; messages: JobMessage[] }>(`/jobs/${jobId}/messages`),
    enabled: Boolean(me.data),
    refetchInterval: liveInterval(6000),
  });
  const send = useMutation({
    mutationFn: () => api(`/jobs/${jobId}/messages`, { method: "POST", body: JSON.stringify({ body }) }),
    onSuccess: () => {
      setBody("");
      qc.invalidateQueries({ queryKey: ["job-messages", jobId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const messages = q.data?.messages ?? [];
  return (
    <Card>
      <h2 className="font-bold">{t.ops.chat}</h2>
      <p className="mt-1 text-sm text-muted">{t.ops.chatHint}</p>
      <div className="mt-4 grid max-h-72 gap-2 overflow-y-auto">
        {messages.length === 0 ? <p className="text-sm text-muted">{t.ops.chatEmpty}</p> : null}
        {messages.map((message) => {
          const mine = message.senderId === me.data?.userId;
          return (
            <div key={message.id} className={cn("max-w-[85%] rounded-2xl px-3 py-2 text-sm", mine ? "ms-auto bg-primary text-primary-foreground" : "bg-background")}>
              <div className={cn("text-xs", mine ? "text-primary-foreground/80" : "text-muted")}>{message.senderName}</div>
              <p className="mt-0.5 whitespace-pre-wrap">{message.body}</p>
              <div className={cn("mt-1 text-[11px]", mine ? "text-primary-foreground/70" : "text-muted")}>{formatDateTime(message.createdAt)}</div>
            </div>
          );
        })}
      </div>
      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (body.trim()) send.mutate();
        }}
      >
        <input className={fieldClass()} value={body} onChange={(e) => setBody(e.target.value)} placeholder={t.ops.chatPlaceholder} />
        <Button type="submit" disabled={send.isPending || !body.trim()}>
          {t.ops.send}
        </Button>
      </form>
    </Card>
  );
}

function JobExtras({ jobId, currencyCode }: { jobId: string; currencyCode?: string }) {
  const { t } = useI18n();
  const me = useMe();
  const qc = useQueryClient();
  const requester = Boolean(me.data?.isPlatformStaff || me.data?.memberships.some((m) => m.companyType === "REQUESTER"));
  const [kind, setKind] = useState<(typeof EXTRA_KINDS)[number]["id"]>("DETENTION");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const q = useQuery({
    queryKey: ["job-extras", jobId],
    queryFn: () => api<JobExtra[]>(`/jobs/${jobId}/extras`),
  });
  const request = useMutation({
    mutationFn: () =>
      api(`/jobs/${jobId}/extras`, {
        method: "POST",
        body: JSON.stringify({ kind, amount: Number(amount), note: note || undefined }),
      }),
    onSuccess: () => {
      toast.success(t.ops.extraRequested);
      setAmount("");
      setNote("");
      qc.invalidateQueries({ queryKey: ["job-extras", jobId] });
      qc.invalidateQueries({ queryKey: ["job", jobId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const decide = useMutation({
    mutationFn: ({ extraId, action }: { extraId: string; action: "approve" | "reject" }) =>
      api(`/jobs/${jobId}/extras/${extraId}/${action}`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["job-extras", jobId] });
      qc.invalidateQueries({ queryKey: ["job", jobId] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Card>
      <h2 className="font-bold">{t.ops.extras}</h2>
      <p className="mt-1 text-sm text-muted">{t.ops.extrasHint}</p>
      <div className="mt-4 grid gap-2">
        {(q.data ?? []).map((extra) => (
          <div key={extra.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-background px-4 py-3">
            <div>
              <div className="font-semibold">{extra.label}</div>
              <p className="text-sm text-muted">{extra.note}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold">{formatMoney(extra.amount, extra.currencyCode || currencyCode)}</span>
              <StatusBadge status={extra.status} />
              {requester && extra.status === "DRAFT" ? (
                <>
                  <Button onClick={() => decide.mutate({ extraId: extra.id, action: "approve" })}>{t.common.confirm}</Button>
                  <Button variant="secondary" onClick={() => decide.mutate({ extraId: extra.id, action: "reject" })}>
                    {t.common.reject}
                  </Button>
                </>
              ) : null}
            </div>
          </div>
        ))}
      </div>
      <form
        className="mt-4 grid gap-3 sm:grid-cols-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (Number(amount) > 0) request.mutate();
        }}
      >
        <select className={fieldClass()} value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
          {EXTRA_KINDS.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
        <input className={fieldClass()} inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={t.ops.extraAmount} />
        <input className={fieldClass()} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t.common.notes} />
        <Button type="submit" className="sm:col-span-3" disabled={request.isPending}>
          {t.ops.requestExtra}
        </Button>
      </form>
    </Card>
  );
}

function JobDeliveryActions({ jobId, status, receiverName }: { jobId: string; status: string; receiverName?: string | null }) {
  const { t } = useI18n();
  const me = useMe();
  const qc = useQueryClient();
  const requester = Boolean(me.data?.isPlatformStaff || me.data?.memberships.some((m) => m.companyType === "REQUESTER"));
  const [reason, setReason] = useState<(typeof DISPUTE_REASONS)[number]["id"]>("DAMAGE");
  const [description, setDescription] = useState("");
  const [returnNote, setReturnNote] = useState("");
  const confirm = useMutation({
    mutationFn: (resolution: "ACCEPTED" | "DISPUTED") =>
      api(`/jobs/${jobId}/confirm-delivery`, {
        method: "POST",
        body: JSON.stringify({
          resolution,
          reason: resolution === "DISPUTED" ? reason : undefined,
          description: resolution === "DISPUTED" ? description : undefined,
        }),
      }),
    onSuccess: (_, resolution) => {
      toast.success(resolution === "ACCEPTED" ? t.ops.deliveryAccepted : t.ops.disputeOpened);
      qc.invalidateQueries({ queryKey: ["job", jobId] });
      qc.invalidateQueries({ queryKey: ["disputes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const returnDocs = useMutation({
    mutationFn: () =>
      api(`/jobs/${jobId}/delivery-docs/return`, {
        method: "POST",
        body: JSON.stringify({ note: returnNote.trim() || undefined }),
      }),
    onSuccess: () => {
      toast.success(t.ops.docsReturned);
      qc.invalidateQueries({ queryKey: ["job", jobId] });
      qc.invalidateQueries({ queryKey: ["docs", "TransportationJob", jobId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  if (!requester || status !== "PROOF_SUBMITTED") return null;
  return (
    <Card>
      <h2 className="font-bold">{t.job.confirmDelivery}</h2>
      <p className="mt-1 text-sm text-muted">{t.ops.deliveryHint}</p>
      {receiverName ? (
        <p className="mt-3 text-sm">
          {t.job.receiver}: <span className="font-semibold">{receiverName}</span>
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button onClick={() => confirm.mutate("ACCEPTED")} disabled={confirm.isPending || returnDocs.isPending}>
          {t.ops.acceptDelivery}
        </Button>
      </div>
      <div className="mt-6 grid gap-3 border-t border-border pt-4">
        <p className="text-sm text-muted">{t.ops.returnDocsHint}</p>
        <textarea
          className="min-h-20 w-full rounded-2xl border border-border bg-background px-3 py-2 text-sm"
          value={returnNote}
          onChange={(e) => setReturnNote(e.target.value)}
          placeholder={t.ops.returnDocsNote}
        />
        <Button variant="secondary" onClick={() => returnDocs.mutate()} disabled={confirm.isPending || returnDocs.isPending}>
          {t.ops.returnDocs}
        </Button>
      </div>
      <div className="mt-4 grid gap-3">
        <select className={fieldClass()} value={reason} onChange={(e) => setReason(e.target.value as typeof reason)}>
          {DISPUTE_REASONS.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
        <textarea className="min-h-24 w-full rounded-2xl border border-border bg-background px-3 py-2 text-sm" value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t.ops.disputeHint} />
        <Button variant="danger" onClick={() => confirm.mutate("DISPUTED")} disabled={confirm.isPending || returnDocs.isPending || description.trim().length < 8}>
          {t.ops.openDispute}
        </Button>
      </div>
    </Card>
  );
}

function JobRatingCard({ jobId, status }: { jobId: string; status: string }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [overall, setOverall] = useState(5);
  const [comment, setComment] = useState("");
  const ratable = ["COMPLETED", "CONFIRMED", "PROOF_SUBMITTED", "DELIVERED", "DISPUTED"].includes(status);
  const q = useQuery({
    queryKey: ["job-ratings", jobId],
    queryFn: () => api<JobRating[]>(`/jobs/${jobId}/ratings`),
    enabled: ratable,
  });
  const save = useMutation({
    mutationFn: () => api(`/jobs/${jobId}/ratings`, { method: "POST", body: JSON.stringify({ overall, comment: comment || undefined }) }),
    onSuccess: () => {
      toast.success(t.ops.rated);
      qc.invalidateQueries({ queryKey: ["job-ratings", jobId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  if (!ratable) return null;
  const mine = q.data?.find((row) => row.mine);
  return (
    <Card>
      <h2 className="font-bold">{t.ops.rating}</h2>
      <p className="mt-1 text-sm text-muted">{t.ops.ratingHint}</p>
      <div className="mt-4 flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            className={cn("grid h-10 w-10 place-items-center rounded-2xl border text-lg", (mine?.overall ?? overall) >= star ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background")}
            onClick={() => setOverall(star)}
          >
            {star}
          </button>
        ))}
      </div>
      <textarea className="mt-3 min-h-20 w-full rounded-2xl border border-border bg-background px-3 py-2 text-sm" value={comment || mine?.comment || ""} onChange={(e) => setComment(e.target.value)} placeholder={t.ops.ratingComment} />
      <Button className="mt-3" onClick={() => save.mutate()} disabled={save.isPending}>
        {mine ? t.ops.updateRating : t.ops.submitRating}
      </Button>
      {(q.data ?? []).filter((row) => !row.mine).map((row) => (
        <p key={row.id} className="mt-3 text-sm text-muted">
          {row.rater}: {row.overall}/5 {row.comment ? `· ${row.comment}` : ""}
        </p>
      ))}
    </Card>
  );
}

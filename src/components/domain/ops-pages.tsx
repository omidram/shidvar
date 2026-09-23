"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState, ErrorState, PageHeader } from "@/components/domain/chrome";
import { api } from "@/lib/api";
import { disputeHref, jobHref, ticketHref } from "@/lib/portal-links";
import { useI18n } from "@/i18n/provider";
import { useMe } from "@/hooks/use-me";
import { formatDateTime } from "@/lib/utils";
import { statusFa } from "@/lib/status-fa";

type Ticket = {
  id: string;
  number: string;
  category: string;
  priority: string;
  status: string;
  subject: string;
  createdAt: string;
  messages: Array<{ id: string; body: string; createdAt: string; authorId: string; authorName: string }>;
};

type Dispute = {
  id: string;
  number: string;
  reason: string;
  description: string;
  status: string;
  resolution?: string | null;
  createdAt: string;
  reporter: string;
  jobId?: string | null;
  jobNumber?: string | null;
  messages: Array<{ id: string; body: string; createdAt: string; authorId: string }>;
};

const TICKET_CATEGORIES = [
  { id: "BILLING", label: "مالی و فاکتور" },
  { id: "LOAD", label: "بار و حمل" },
  { id: "ACCOUNT", label: "حساب کاربری" },
  { id: "TRACKING", label: "ردیابی" },
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

function fieldClass() {
  return "h-11 w-full rounded-2xl border border-border bg-background px-3 text-sm";
}

export function SupportCenter({ initialTab = "tickets" }: { initialTab?: "tickets" | "disputes" }) {
  const { t } = useI18n();
  const pathname = usePathname();
  const me = useMe();
  const [tab, setTab] = useState<"tickets" | "disputes">(initialTab);
  const tickets = useQuery({ queryKey: ["tickets"], queryFn: () => api<Ticket[]>("/tickets") });
  const disputes = useQuery({ queryKey: ["disputes"], queryFn: () => api<Dispute[]>("/disputes") });
  return (
    <div className="grid gap-6">
      <PageHeader title={t.ops.supportTitle} description={t.ops.supportHint} />
      <div className="flex gap-2">
        <Button variant={tab === "tickets" ? "default" : "secondary"} onClick={() => setTab("tickets")}>
          {t.ops.tickets} ({tickets.data?.length ?? 0})
        </Button>
        <Button variant={tab === "disputes" ? "default" : "secondary"} onClick={() => setTab("disputes")}>
          {t.ops.disputes} ({disputes.data?.length ?? 0})
        </Button>
      </div>
      {tab === "tickets" ? (
        <>
          <CreateTicketForm />
          {tickets.isLoading ? <p>{t.common.loading}</p> : null}
          {!tickets.isLoading && !tickets.data?.length ? <EmptyState title={t.common.empty} hint={t.ops.ticketEmpty} /> : null}
          <div className="grid gap-3">
            {(tickets.data ?? []).map((ticket) => (
              <Link key={ticket.id} href={ticketHref(pathname, ticket.id)}>
                <Card className="transition hover:-translate-y-0.5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-lg font-bold">{ticket.number}</div>
                      <p className="mt-1 font-semibold">{ticket.subject}</p>
                      <p className="mt-1 text-sm text-muted">
                        {statusFa(ticket.category)} · {statusFa(ticket.priority)} · {formatDateTime(ticket.createdAt)}
                      </p>
                    </div>
                    <StatusBadge status={ticket.status} />
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </>
      ) : (
        <>
          {!me.data || me.data.isPlatformStaff ? null : <CreateDisputeForm />}
          {disputes.isLoading ? <p>{t.common.loading}</p> : null}
          {!disputes.isLoading && !disputes.data?.length ? <EmptyState title={t.common.empty} hint={t.ops.disputeEmpty} /> : null}
          <div className="grid gap-3">
            {(disputes.data ?? []).map((dispute) => (
              <Link key={dispute.id} href={disputeHref(pathname, dispute.id)}>
                <Card className="transition hover:-translate-y-0.5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-lg font-bold">{dispute.number}</div>
                      <p className="mt-1 font-semibold">{statusFa(dispute.reason)}</p>
                      <p className="mt-1 text-sm text-muted">
                        {dispute.reporter} · {dispute.jobNumber ?? t.ops.noJob} · {formatDateTime(dispute.createdAt)}
                      </p>
                    </div>
                    <StatusBadge status={dispute.status} />
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function CreateTicketForm() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState<(typeof TICKET_CATEGORIES)[number]["id"]>("LOAD");
  const [body, setBody] = useState("");
  const create = useMutation({
    mutationFn: () => api("/tickets", { method: "POST", body: JSON.stringify({ subject, category, body }) }),
    onSuccess: () => {
      toast.success(t.ops.ticketCreated);
      setSubject("");
      setBody("");
      qc.invalidateQueries({ queryKey: ["tickets"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Card>
      <h2 className="font-bold">{t.ops.newTicket}</h2>
      <form
        className="mt-4 grid gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
      >
        <input className={fieldClass()} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={t.ops.ticketSubject} required />
        <select className={fieldClass()} value={category} onChange={(e) => setCategory(e.target.value as typeof category)}>
          {TICKET_CATEGORIES.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
        <textarea className="min-h-24 w-full rounded-2xl border border-border bg-background px-3 py-2 text-sm" value={body} onChange={(e) => setBody(e.target.value)} placeholder={t.ops.ticketBody} required />
        <Button type="submit" disabled={create.isPending}>
          {t.ops.submitTicket}
        </Button>
      </form>
    </Card>
  );
}

function CreateDisputeForm() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [reason, setReason] = useState<(typeof DISPUTE_REASONS)[number]["id"]>("DAMAGE");
  const [description, setDescription] = useState("");
  const create = useMutation({
    mutationFn: () => api("/disputes", { method: "POST", body: JSON.stringify({ reason, description }) }),
    onSuccess: () => {
      toast.success(t.ops.disputeOpened);
      setDescription("");
      qc.invalidateQueries({ queryKey: ["disputes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Card>
      <h2 className="font-bold">{t.ops.newDispute}</h2>
      <p className="mt-1 text-sm text-muted">{t.ops.disputeStandaloneHint}</p>
      <form
        className="mt-4 grid gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
      >
        <select className={fieldClass()} value={reason} onChange={(e) => setReason(e.target.value as typeof reason)}>
          {DISPUTE_REASONS.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
        <textarea className="min-h-24 w-full rounded-2xl border border-border bg-background px-3 py-2 text-sm" value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t.ops.disputeHint} required />
        <Button type="submit" disabled={create.isPending}>
          {t.ops.openDispute}
        </Button>
      </form>
    </Card>
  );
}

export function TicketDetailView({ id }: { id: string }) {
  const { t } = useI18n();
  const me = useMe();
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const q = useQuery({ queryKey: ["ticket", id], queryFn: () => api<Ticket>(`/tickets/${id}`) });
  const reply = useMutation({
    mutationFn: () => api(`/tickets/${id}/messages`, { method: "POST", body: JSON.stringify({ body }) }),
    onSuccess: () => {
      setBody("");
      qc.invalidateQueries({ queryKey: ["ticket", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const status = useMutation({
    mutationFn: (next: string) => api(`/tickets/${id}`, { method: "PATCH", body: JSON.stringify({ status: next }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ticket", id] }),
    onError: (e: Error) => toast.error(e.message),
  });
  if (q.isLoading) return <p>{t.common.loading}</p>;
  if (q.isError || !q.data) return <ErrorState message={t.common.error} />;
  const ticket = q.data;
  return (
    <div className="grid gap-4">
      <PageHeader title={ticket.number} description={`${ticket.subject} · ${statusFa(ticket.category)}`} />
      <StatusBadge status={ticket.status} />
      {me.data?.isPlatformStaff ? (
        <div className="flex flex-wrap gap-2">
          {["IN_PROGRESS", "WAITING_FOR_USER", "RESOLVED", "CLOSED"].map((next) => (
            <Button key={next} variant="secondary" onClick={() => status.mutate(next)}>
              {statusFa(next)}
            </Button>
          ))}
        </div>
      ) : null}
      <Card>
        <div className="grid gap-3">
          {ticket.messages.map((message) => (
            <div key={message.id} className="rounded-2xl bg-background px-4 py-3">
              <div className="text-xs text-muted">
                {message.authorName} · {formatDateTime(message.createdAt)}
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm">{message.body}</p>
            </div>
          ))}
        </div>
        <form
          className="mt-4 grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (body.trim()) reply.mutate();
          }}
        >
          <textarea className="min-h-24 w-full rounded-2xl border border-border bg-background px-3 py-2 text-sm" value={body} onChange={(e) => setBody(e.target.value)} placeholder={t.ops.reply} />
          <Button type="submit" disabled={reply.isPending || !body.trim()}>
            {t.ops.send}
          </Button>
        </form>
      </Card>
    </div>
  );
}

export function DisputeDetailView({ id }: { id: string }) {
  const { t } = useI18n();
  const pathname = usePathname();
  const me = useMe();
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const [resolution, setResolution] = useState("");
  const q = useQuery({ queryKey: ["dispute", id], queryFn: () => api<Dispute>(`/disputes/${id}`) });
  const reply = useMutation({
    mutationFn: () => api(`/disputes/${id}/messages`, { method: "POST", body: JSON.stringify({ body }) }),
    onSuccess: () => {
      setBody("");
      qc.invalidateQueries({ queryKey: ["dispute", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const resolve = useMutation({
    mutationFn: (next: "RESOLVED" | "REJECTED" | "CLOSED") =>
      api(`/disputes/${id}/resolve`, { method: "POST", body: JSON.stringify({ status: next, resolution }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dispute", id] }),
    onError: (e: Error) => toast.error(e.message),
  });
  if (q.isLoading) return <p>{t.common.loading}</p>;
  if (q.isError || !q.data) return <ErrorState message={t.common.error} />;
  const dispute = q.data;
  return (
    <div className="grid gap-4">
      <PageHeader title={dispute.number} description={`${statusFa(dispute.reason)} · ${dispute.reporter}`} />
      <StatusBadge status={dispute.status} />
      <Card>
        <p className="whitespace-pre-wrap text-sm">{dispute.description}</p>
        {dispute.jobId ? (
          <Button asChild className="mt-4" variant="secondary">
            <Link href={jobHref(pathname, dispute.jobId)}>{dispute.jobNumber ?? t.common.viewLoad}</Link>
          </Button>
        ) : null}
        {dispute.resolution ? <p className="mt-4 text-sm text-muted">{t.ops.resolution}: {dispute.resolution}</p> : null}
      </Card>
      <Card>
        <div className="grid gap-3">
          {dispute.messages.map((message) => (
            <div key={message.id} className="rounded-2xl bg-background px-4 py-3 text-sm">
              <div className="text-xs text-muted">{formatDateTime(message.createdAt)}</div>
              <p className="mt-1 whitespace-pre-wrap">{message.body}</p>
            </div>
          ))}
        </div>
        <form
          className="mt-4 grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (body.trim()) reply.mutate();
          }}
        >
          <textarea className="min-h-24 w-full rounded-2xl border border-border bg-background px-3 py-2 text-sm" value={body} onChange={(e) => setBody(e.target.value)} placeholder={t.ops.reply} />
          <Button type="submit" disabled={reply.isPending || !body.trim()}>
            {t.ops.send}
          </Button>
        </form>
      </Card>
      {me.data?.isPlatformStaff ? (
        <Card>
          <h2 className="font-bold">{t.ops.resolveDispute}</h2>
          <textarea className="mt-3 min-h-24 w-full rounded-2xl border border-border bg-background px-3 py-2 text-sm" value={resolution} onChange={(e) => setResolution(e.target.value)} placeholder={t.ops.resolution} />
          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={() => resolve.mutate("RESOLVED")} disabled={resolution.trim().length < 4}>
              {statusFa("RESOLVED")}
            </Button>
            <Button variant="secondary" onClick={() => resolve.mutate("REJECTED")} disabled={resolution.trim().length < 4}>
              {statusFa("REJECTED")}
            </Button>
            <Button variant="ghost" onClick={() => resolve.mutate("CLOSED")} disabled={resolution.trim().length < 4}>
              {statusFa("CLOSED")}
            </Button>
          </div>
        </Card>
      ) : null}
    </div>
  );
}

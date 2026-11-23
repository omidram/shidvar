"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageHeader } from "@/components/domain/chrome";
import { PartnerShipmentCard, type PartnerShipment } from "@/components/domain/partner-shipment-card";
import { groupPartnerShipments } from "@/components/domain/partner-request-board";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, NativeSelect } from "@/components/ui/input";
import { api, formatApiError } from "@/lib/api";

type DriverOption = { id: string; name: string; phone?: string | null };

export default function AdminPartnerRequestsPage() {
  const qc = useQueryClient();
  const shipments = useQuery({ queryKey: ["partner-shipments"], queryFn: () => api<PartnerShipment[]>("/partner/shipments") });
  const drivers = useQuery({ queryKey: ["partner-drivers"], queryFn: () => api<DriverOption[]>("/admin/partner-drivers") });
  const [drafts, setDrafts] = useState<Record<string, { driverId: string; freight: string }>>({});

  function draft(id: string) {
    return drafts[id] ?? { driverId: "", freight: "" };
  }

  const assign = useMutation({
    mutationFn: ({ id, driverId, freightAmount }: { id: string; driverId: string; freightAmount: number }) =>
      api(`/admin/partner-shipments/${id}/assign`, { method: "POST", body: JSON.stringify({ driverId, freightAmount }) }),
    onSuccess: () => {
      toast.success("راننده و مبلغ باربری ثبت شد");
      qc.invalidateQueries({ queryKey: ["partner-shipments"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (error) => toast.error(formatApiError(error, "تخصیص انجام نشد")),
  });

  const move = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "dispatch" | "deliver" | "invoice" }) =>
      api(`/admin/partner-shipments/${id}/${action}`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["partner-shipments"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (error) => toast.error(formatApiError(error, "این مرحله انجام نشد")),
  });

  const groups = groupPartnerShipments(shipments.data ?? []);

  return (
    <div className="grid gap-4">
      <PageHeader
        title="درخواست‌های طرف قرارداد"
        description="این فهرست جدا از درخواست صاحب بار است. بارها با نام طرف قرارداد چیده شده‌اند و راننده را از همین‌جا اختصاص می‌دهید."
      />
      {shipments.isLoading ? <p className="text-sm text-muted">در حال خواندن بارها…</p> : null}
      {!shipments.isLoading && groups.length === 0 ? <p className="text-sm text-muted">هنوز باری از طرف قرارداد ثبت نشده است.</p> : null}
      {groups.map((group) => (
        <section key={group.name} className="grid gap-3">
          <h2 className="text-lg font-bold">{group.name}</h2>
          {group.items.map((shipment) => (
            <Card key={shipment.id} className="grid gap-3">
              <PartnerShipmentCard shipment={shipment} />
              {["REGISTERED", "ASSIGNED"].includes(shipment.status) ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="راننده">
                    <NativeSelect
                      value={draft(shipment.id).driverId}
                      onChange={(e) => setDrafts({ ...drafts, [shipment.id]: { ...draft(shipment.id), driverId: e.target.value } })}
                    >
                      <option value="">انتخاب راننده</option>
                      {(drivers.data ?? []).map((driver) => (
                        <option key={driver.id} value={driver.id}>
                          {driver.name}
                          {driver.phone ? ` · ${driver.phone}` : ""}
                        </option>
                      ))}
                    </NativeSelect>
                  </Field>
                  <Field label="مبلغ باربری (ریال)">
                    <Input
                      inputMode="numeric"
                      value={draft(shipment.id).freight}
                      onChange={(e) => setDrafts({ ...drafts, [shipment.id]: { ...draft(shipment.id), freight: e.target.value } })}
                    />
                  </Field>
                  <Button
                    disabled={assign.isPending || !draft(shipment.id).driverId || !(Number(draft(shipment.id).freight) > 0)}
                    onClick={() =>
                      assign.mutate({
                        id: shipment.id,
                        driverId: draft(shipment.id).driverId,
                        freightAmount: Number(draft(shipment.id).freight),
                      })
                    }
                  >
                    تخصیص راننده
                  </Button>
                </div>
              ) : null}
              <div className="flex flex-wrap gap-2">
                {shipment.status === "ASSIGNED" ? (
                  <Button disabled={move.isPending} onClick={() => move.mutate({ id: shipment.id, action: "dispatch" })}>
                    ارسال بار
                  </Button>
                ) : null}
                {shipment.status === "IN_TRANSIT" ? (
                  <Button disabled={move.isPending} onClick={() => move.mutate({ id: shipment.id, action: "deliver" })}>
                    رسید به مقصد
                  </Button>
                ) : null}
                {shipment.freightAmount != null && !shipment.invoice ? (
                  <Button variant="secondary" disabled={move.isPending} onClick={() => move.mutate({ id: shipment.id, action: "invoice" })}>
                    صدور فاکتور باربری
                  </Button>
                ) : null}
              </div>
            </Card>
          ))}
        </section>
      ))}
    </div>
  );
}

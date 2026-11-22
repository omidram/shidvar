"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageHeader } from "@/components/domain/chrome";
import { PartnerShipmentCard, type PartnerShipment } from "@/components/domain/partner-shipment-card";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, NativeSelect } from "@/components/ui/input";
import { CitySelect } from "@/components/domain/city-select";
import { IRAN_PROVINCES } from "@/lib/geo/iran-provinces";
import { PasswordInput } from "@/components/ui/password-input";
import { PhoneLink } from "@/components/ui/phone-link";
import { api, formatApiError } from "@/lib/api";
import { statusFa } from "@/lib/status-fa";

type Partner = {
  id: string;
  tradeName: string;
  phone?: string | null;
  status: string;
  shipmentCount: number;
  addressLine?: string;
  city?: string;
  province?: string;
  owner?: { id: string; name: string; firstName?: string; lastName?: string; phone?: string | null; username?: string | null; status: string } | null;
};

const emptyProfile = { tradeName: "", phone: "", firstName: "", lastName: "", addressLine: "", city: "", province: "" };

type DriverOption = { id: string; name: string; phone?: string | null };

export default function AdminPartnersPage() {
  const qc = useQueryClient();
  const partners = useQuery({ queryKey: ["admin-partners"], queryFn: () => api<Partner[]>("/admin/partners") });
  const shipments = useQuery({ queryKey: ["partner-shipments"], queryFn: () => api<PartnerShipment[]>("/partner/shipments") });
  const drivers = useQuery({ queryKey: ["partner-drivers"], queryFn: () => api<DriverOption[]>("/admin/partner-drivers") });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ tradeName: "", phone: "", firstName: "", lastName: "", username: "", password: "" });
  const [drafts, setDrafts] = useState<Record<string, { driverId: string; freight: string; password: string; location: string }>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [profile, setProfile] = useState(emptyProfile);

  function draft(id: string) {
    return drafts[id] ?? { driverId: "", freight: "", password: "", location: "" };
  }

  const create = useMutation({
    mutationFn: () =>
      api("/admin/partners", {
        method: "POST",
        body: JSON.stringify({ ...form, phone: form.phone || undefined }),
      }),
    onSuccess: () => {
      toast.success("حساب طرف قرارداد ساخته شد");
      setForm({ tradeName: "", phone: "", firstName: "", lastName: "", username: "", password: "" });
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["admin-partners"] });
    },
    onError: (error) => toast.error(formatApiError(error, "ساخت حساب انجام نشد")),
  });

  const password = useMutation({
    mutationFn: ({ id, value }: { id: string; value: string }) =>
      api(`/admin/partners/${id}/password`, { method: "POST", body: JSON.stringify({ password: value }) }),
    onSuccess: () => toast.success("رمز عوض شد"),
    onError: (error) => toast.error(formatApiError(error, "تغییر رمز انجام نشد")),
  });

  const saveProfile = useMutation({
    mutationFn: (id: string) => api(`/admin/partners/${id}`, { method: "POST", body: JSON.stringify(profile) }),
    onSuccess: () => {
      toast.success("اطلاعات طرف قرارداد ذخیره شد");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["admin-partners"] });
    },
    onError: (error) => toast.error(formatApiError(error, "ذخیره اطلاعات انجام نشد")),
  });

  const status = useMutation({
    mutationFn: ({ id, next }: { id: string; next: "APPROVED" | "SUSPENDED" }) =>
      api(`/admin/partners/${id}/status`, { method: "POST", body: JSON.stringify({ status: next }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-partners"] }),
    onError: (error) => toast.error(formatApiError(error, "تغییر وضعیت انجام نشد")),
  });

  const assign = useMutation({
    mutationFn: ({ id, driverId, freightAmount, driverLocation }: { id: string; driverId: string; freightAmount: number; driverLocation?: string }) =>
      api(`/admin/partner-shipments/${id}/assign`, { method: "POST", body: JSON.stringify({ driverId, freightAmount, driverLocation: driverLocation || undefined }) }),
    onSuccess: () => {
      toast.success("راننده و مبلغ باربری ثبت شد");
      qc.invalidateQueries({ queryKey: ["partner-shipments"] });
    },
    onError: (error) => toast.error(formatApiError(error, "تخصیص انجام نشد")),
  });

  const move = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "dispatch" | "deliver" | "invoice" }) =>
      api(`/admin/partner-shipments/${id}/${action}`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["partner-shipments"] }),
    onError: (error) => toast.error(formatApiError(error, "این مرحله انجام نشد")),
  });

  return (
    <div className="grid gap-4">
      <PageHeader
        title="طرف قرارداد"
        description="برای هر مشتری نام کاربری و رمز بسازید. حساب‌های نمونه demo1 تا demo10 آماده‌اند و رمز هر کدام همان نام کاربری است. راننده، لوکیشن، مبلغ باربری و فاکتور را شما مشخص می‌کنید."
        actions={<Button onClick={() => setOpen((value) => !value)}>{open ? "بستن فرم" : "حساب جدید"}</Button>}
      />
      {open ? (
        <Card className="grid gap-3">
          <Field label="نام مشتری">
            <Input value={form.tradeName} onChange={(e) => setForm({ ...form, tradeName: e.target.value })} placeholder="مثلاً اطلس پخش ساینا" />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="نام رابط">
              <Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
            </Field>
            <Field label="نام خانوادگی">
              <Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
            </Field>
          </div>
          <Field label="موبایل" hint="کد ورود و بازیابی رمز به همین شماره می‌رود">
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} inputMode="tel" required />
          </Field>
          <Field label="نام کاربری">
            <Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} autoComplete="off" />
          </Field>
          <Field label="رمز عبور" hint="حداقل ۱۰ نویسه، حرف بزرگ، حرف کوچک و عدد">
            <PasswordInput value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} autoComplete="new-password" />
          </Field>
          <Button
            disabled={create.isPending || !form.tradeName || !form.username || !form.password || form.phone.trim().length < 10}
            onClick={() => create.mutate()}
          >
            ساخت حساب
          </Button>
        </Card>
      ) : null}

      <div className="grid gap-3">
        {(partners.data ?? []).map((partner) => (
          <Card key={partner.id} className="grid gap-3">
            <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="break-words text-lg font-bold">{partner.tradeName}</div>
                <p className="mt-1 break-words text-sm text-muted">
                  {partner.owner?.name ?? "بدون رابط"} · {partner.owner?.username ?? "—"} · {statusFa(partner.status)} · {partner.shipmentCount.toLocaleString("fa-IR")} بار
                </p>
                {partner.addressLine ? <p className="mt-1 break-words text-sm text-muted">{[partner.province, partner.city, partner.addressLine].filter(Boolean).join("، ")}</p> : null}
                {partner.owner?.phone ? <PhoneLink phone={partner.owner.phone} /> : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setEditing(editing === partner.id ? null : partner.id);
                    setProfile({
                      tradeName: partner.tradeName,
                      phone: partner.owner?.phone || partner.phone || "",
                      firstName: partner.owner?.firstName || "",
                      lastName: partner.owner?.lastName || "",
                      addressLine: partner.addressLine || "",
                      city: partner.city || "",
                      province: partner.province || "",
                    });
                  }}
                >
                  {editing === partner.id ? "بستن ویرایش" : "ویرایش اطلاعات"}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => status.mutate({ id: partner.id, next: partner.status === "SUSPENDED" ? "APPROVED" : "SUSPENDED" })}
                >
                  {partner.status === "SUSPENDED" ? "فعال کردن" : "تعلیق"}
                </Button>
              </div>
            </div>
            {editing === partner.id ? (
              <div className="grid gap-3 rounded-2xl border border-border p-3">
                <Field label="نام طرف قرارداد">
                  <Input value={profile.tradeName} onChange={(e) => setProfile({ ...profile, tradeName: e.target.value })} />
                </Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="نام رابط">
                    <Input value={profile.firstName} onChange={(e) => setProfile({ ...profile, firstName: e.target.value })} />
                  </Field>
                  <Field label="نام خانوادگی">
                    <Input value={profile.lastName} onChange={(e) => setProfile({ ...profile, lastName: e.target.value })} />
                  </Field>
                </div>
                <Field label="موبایل">
                  <Input value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} inputMode="tel" />
                </Field>
                <Field label="آدرس">
                  <Input value={profile.addressLine} onChange={(e) => setProfile({ ...profile, addressLine: e.target.value })} />
                </Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <CitySelect label="استان" value={profile.province} onChange={(value) => setProfile({ ...profile, province: value })} options={IRAN_PROVINCES} placeholder="استان" />
                  <CitySelect label="شهر" value={profile.city} onChange={(value) => setProfile({ ...profile, city: value })} placeholder="شهر" />
                </div>
                <Button
                  disabled={
                    saveProfile.isPending ||
                    profile.tradeName.trim().length < 2 ||
                    profile.firstName.trim().length < 1 ||
                    profile.lastName.trim().length < 1 ||
                    (profile.phone.trim().length > 0 && profile.phone.trim().length < 10) ||
                    (Boolean(profile.addressLine.trim() || profile.city.trim() || profile.province.trim()) &&
                      (profile.addressLine.trim().length < 2 || profile.city.trim().length < 2 || profile.province.trim().length < 2))
                  }
                  onClick={() => saveProfile.mutate(partner.id)}
                >
                  ذخیره اطلاعات
                </Button>
              </div>
            ) : null}
            <div className="flex min-w-0 flex-wrap gap-2">
              <PasswordInput
                className="sm:max-w-xs"
                placeholder="رمز جدید"
                autoComplete="new-password"
                value={draft(partner.id).password}
                onChange={(e) => setDrafts({ ...drafts, [partner.id]: { ...draft(partner.id), password: e.target.value } })}
              />
              <Button
                variant="secondary"
                disabled={password.isPending || draft(partner.id).password.length < 10}
                onClick={() => password.mutate({ id: partner.id, value: draft(partner.id).password })}
              >
                ذخیره رمز
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <h2 className="text-lg font-bold">بارهای ثبت‌شده</h2>
      <div className="grid gap-3">
        {(shipments.data ?? []).map((shipment) => (
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
                      driverLocation: drafts[shipment.id]?.location ?? shipment.driverLocation ?? "",
                    })
                  }
                >
                  تخصیص راننده
                </Button>
              </div>
            ) : null}
            <div className="flex flex-wrap items-end gap-2">
              <Field label="لوکیشن راننده">
                <Input
                  value={drafts[shipment.id]?.location ?? shipment.driverLocation ?? ""}
                  onChange={(e) => setDrafts({ ...drafts, [shipment.id]: { ...draft(shipment.id), location: e.target.value } })}
                />
              </Field>
              <Button
                variant="secondary"
                disabled={move.isPending || (drafts[shipment.id]?.location ?? shipment.driverLocation ?? "").trim().length < 2}
                onClick={() =>
                  api(`/admin/partner-shipments/${shipment.id}/location`, {
                    method: "POST",
                    body: JSON.stringify({ driverLocation: drafts[shipment.id]?.location ?? shipment.driverLocation }),
                  }).then(() => {
                    toast.success("لوکیشن راننده ثبت شد");
                    qc.invalidateQueries({ queryKey: ["partner-shipments"] });
                  })
                }
              >
                ثبت لوکیشن
              </Button>
            </div>
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
      </div>
    </div>
  );
}

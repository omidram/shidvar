"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Crown, Users } from "lucide-react";
import { ChoiceTile, PageHeader } from "@/components/domain/chrome";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, NativeSelect, Textarea } from "@/components/ui/input";
import { ShamsiDateInput } from "@/components/ui/shamsi-date-input";
import { api } from "@/lib/api";
import { useI18n } from "@/i18n/provider";
import { CitySelect } from "@/components/domain/city-select";
import { ColdIcon, HeavyTruckIcon, TankerIcon, TruckIcon, VanIcon } from "@/components/visual/icons";

type Line = { name: string; quantity: string; unitCode: string };
type Warehouse = {
  id: string;
  name: string;
  address?: { city?: string | null; line1?: string | null };
};
type DirectoryDriver = { id: string; name: string; ratingAvg: number; completedJobs: number; vehicleType: string | null };
type VehicleKey = "VAN" | "LIGHT_TRUCK" | "TRUCK" | "REFRIGERATED" | "TANKER";
const VEHICLES: Array<{ key: VehicleKey; icon: React.ReactNode; body: string }> = [
  { key: "VAN", icon: <VanIcon className="h-7 w-7" />, body: "تا ۵۰۰ کیلو، شهری" },
  { key: "LIGHT_TRUCK", icon: <TruckIcon className="h-7 w-7" />, body: "وانت سنگین" },
  { key: "TRUCK", icon: <HeavyTruckIcon className="h-7 w-7" />, body: "بین‌شهری" },
  { key: "REFRIGERATED", icon: <ColdIcon className="h-7 w-7" />, body: "زنجیره سرد" },
  { key: "TANKER", icon: <TankerIcon className="h-7 w-7" />, body: "مایعات و فله" },
];

function NewRequestForm() {
  const { t } = useI18n();
  const router = useRouter();
  const params = useSearchParams();
  const warehouses = useQuery({
    queryKey: ["warehouses"],
    queryFn: () => api<Warehouse[]>("/tenancy/warehouses"),
  });
  const [step, setStep] = useState(1);
  const [vehicle, setVehicle] = useState<VehicleKey>((params.get("vehicle") as VehicleKey) || "TRUCK");
  const [urgency, setUrgency] = useState("normal");
  const [helper, setHelper] = useState(false);
  const [covered, setCovered] = useState(true);
  const [insurance, setInsurance] = useState(false);
  const [loadType, setLoadType] = useState<"FULL" | "SHARED">("FULL");
  const [waybill, setWaybill] = useState(false);
  const [dispatchMode, setDispatchMode] = useState<"NORMAL" | "VIP">("NORMAL");
  const [vipDriverId, setVipDriverId] = useState("");
  const directory = useQuery({
    queryKey: ["driver-directory"],
    queryFn: () => api<DirectoryDriver[]>("/drivers/directory"),
    enabled: dispatchMode === "VIP",
  });
  const [originWarehouseId, setOriginWarehouseId] = useState("");
  const [destinationWarehouseId, setDestinationWarehouseId] = useState("");
  const [originCity, setOriginCity] = useState(params.get("origin") || "تهران");
  const [destinationCity, setDestinationCity] = useState(params.get("destination") || "آمل");
  const [originLine1, setOriginLine1] = useState("");
  const [destinationLine1, setDestinationLine1] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("2026-09-01");
  const [budget, setBudget] = useState("8500000");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([{ name: "", quantity: "1", unitCode: "carton" }]);
  const [saving, setSaving] = useState(false);
  const qty = lines.reduce((sum, line) => sum + Number(line.quantity || 0), 0);
  const quote = useQuery({
    queryKey: ["price-quote", destinationCity, qty],
    queryFn: () => api<{ matched: boolean; amount: number | null; label: string; zoneName: string | null }>(`/price-books/quote?destinationCity=${encodeURIComponent(destinationCity)}&quantity=${qty}`),
    enabled: Boolean(destinationCity && qty > 0),
  });

  function applyWarehouse(id: string, side: "origin" | "destination") {
    const warehouse = (warehouses.data ?? []).find((item) => item.id === id);
    if (side === "origin") {
      setOriginWarehouseId(id);
      if (!warehouse) return;
      if (warehouse.address?.city) setOriginCity(warehouse.address.city);
      setOriginLine1([warehouse.name, warehouse.address?.line1].filter(Boolean).join("، "));
      return;
    }
    setDestinationWarehouseId(id);
    if (!warehouse) return;
    if (warehouse.address?.city) setDestinationCity(warehouse.address.city);
    setDestinationLine1([warehouse.name, warehouse.address?.line1].filter(Boolean).join("، "));
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
  }

  async function createRequest() {
    if (step !== 3) return;
    if (dispatchMode === "VIP" && !vipDriverId) {
      toast.error("برای بار VIP یک راننده انتخاب کنید");
      return;
    }
    if (lines.some((line) => !line.name.trim() || !(Number(line.quantity) > 0))) {
      toast.error("نام و مقدار هر قلم را بنویسید");
      setStep(2);
      return;
    }
    setSaving(true);
    try {
      const extras = [
        vehicle,
        `فوریت: ${urgency === "urgent" ? t.request.urgent : urgency === "scheduled" ? t.request.scheduled : t.request.normal}`,
        helper ? t.request.helper : null,
        covered ? t.request.covered : null,
      ]
        .filter(Boolean)
        .join(" | ");
      const created = await api<{ id: string }>("/requests", {
        method: "POST",
        body: JSON.stringify({
          originCity,
          destinationCity,
          originLine1: originLine1 || undefined,
          destinationLine1: destinationLine1 || undefined,
          destinationWarehouseId: destinationWarehouseId || undefined,
          requestedDeliveryDate: new Date(deliveryDate).toISOString(),
          budgetAmount: budget ? Number(budget) : undefined,
          notes,
          pickupNotes: extras,
          requiredVehicleType: vehicle,
          packagingNotes: covered ? "حمل مسقف" : "حمل روباز",
          qualityNotes: urgency,
          dispatchMode,
          vipDriverId: dispatchMode === "VIP" ? vipDriverId : undefined,
          needsWaybill: waybill,
          needsInsurance: insurance,
          loadType,
          items: lines.map((line) => ({
            name: line.name.trim(),
            quantity: Number(line.quantity),
            unitCode: line.unitCode,
          })),
        }),
      });
      await api(`/requests/${created.id}/submit`, { method: "POST" });
      toast.success("درخواست ثبت شد و ۱۰۰ اعتبار کسر شد. برای بررسی و اعلام مدیریت ارسال شد");
      router.push(`/requester/requests/${created.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t.common.error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="grid gap-6" onSubmit={onSubmit}>
      <PageHeader
        title={t.request.create}
        description={`${t.request.example} با ثبت درخواست، ۱۰۰ اعتبار از حساب شرکت کم می‌شود.`}
        actions={
          <div className="flex gap-2">
            {step > 1 ? (
              <Button type="button" variant="secondary" onClick={() => setStep(step - 1)}>
                {t.common.prev}
              </Button>
            ) : null}
            {step < 3 ? (
              <Button type="button" onClick={() => setStep(step + 1)}>
                {t.common.next}
              </Button>
            ) : (
              <Button type="button" disabled={saving} onClick={() => void createRequest()}>
                {saving ? t.common.loading : "ثبت درخواست"}
              </Button>
            )}
          </div>
        }
      />
      <div className="grid grid-cols-3 gap-2">
        {[t.request.stepRoute, t.request.stepItems, t.request.stepCargo].map((label, i) => (
          <button
            key={label}
            type="button"
            onClick={() => setStep(i + 1)}
            className={`rounded-2xl px-2 py-2 text-center text-xs leading-5 sm:text-sm ${step === i + 1 ? "bg-primary text-primary-foreground" : "bg-card border border-border"}`}
          >
            {i + 1}. {label}
          </button>
        ))}
      </div>
      <p className="text-sm leading-7 text-muted">
        {step === 1
          ? "اگر انبار ثبت کرده‌اید از فهرست انتخاب کنید. شهر و نشانی خودش پر می‌شود. بعد تاریخ و کرایه را بنویسید."
          : step === 2
            ? "نام کالا و مقدار را خودتان بنویسید. راننده قبل از قبول همین فهرست را می‌بیند."
            : "ماشین، فوریت، همگانی یا VIP، و دربستی یا روباری را انتخاب کنید. با ثبت، درخواست برای بررسی مدیریت می‌رود."}
      </p>

      {step === 1 ? (
        <Card className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2 grid gap-3">
            {warehouses.isLoading ? <p className="text-sm text-muted">در حال خواندن انبارها…</p> : null}
            {warehouses.isError ? <p className="text-sm text-danger">انبارها خوانده نشد. یک بار صفحه را تازه کنید.</p> : null}
            {!warehouses.isLoading && !warehouses.isError && !(warehouses.data ?? []).length ? (
              <p className="text-sm leading-7 text-muted">
                هنوز انباری ثبت نشده است.{" "}
                <Link href="/requester/warehouses" className="font-bold text-primary">
                  ثبت انبار
                </Link>
              </p>
            ) : null}
          </div>
          {(warehouses.data ?? []).length ? (
            <>
              <Field label="انبار مبدأ" hint="با انتخاب انبار، شهر و نشانی بارگیری پر می‌شود.">
                <NativeSelect value={originWarehouseId} onChange={(event) => applyWarehouse(event.target.value, "origin")}>
                  <option value="">انتخاب از انبارهای ثبت‌شده</option>
                  {(warehouses.data ?? []).map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>
                      {warehouse.name}
                      {warehouse.address?.city ? ` · ${warehouse.address.city}` : ""}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field label="انبار مقصد" hint="اگر مقصد هم انبار خودتان است، همین‌جا انتخاب کنید.">
                <NativeSelect value={destinationWarehouseId} onChange={(event) => applyWarehouse(event.target.value, "destination")}>
                  <option value="">مقصد انبار نیست</option>
                  {(warehouses.data ?? []).map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>
                      {warehouse.name}
                      {warehouse.address?.city ? ` · ${warehouse.address.city}` : ""}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            </>
          ) : null}
          <CitySelect label={t.request.originCity} value={originCity} onChange={setOriginCity} required />
          <CitySelect label={t.request.destinationCity} value={destinationCity} onChange={setDestinationCity} required />
          <Field label={`${t.request.originAddress} (${t.common.optional})`}>
            <Input value={originLine1} onChange={(e) => setOriginLine1(e.target.value)} placeholder="انبار مرکزی، تهران" />
          </Field>
          <Field label={`${t.request.destinationAddress} (${t.common.optional})`}>
            <Input value={destinationLine1} onChange={(e) => setDestinationLine1(e.target.value)} placeholder="مرکز پخش آمل" />
          </Field>
          <Field label={t.request.deliveryDate}>
            <ShamsiDateInput value={deliveryDate} onChange={setDeliveryDate} required />
          </Field>
          <Field label={t.request.budget}>
            <Input type="number" value={budget} onChange={(e) => setBudget(e.target.value)} />
          </Field>
          {quote.data ? (
            <div className="md:col-span-2 rounded-2xl bg-background px-4 py-3 text-sm">
              <div className="font-semibold">نرخ دفترچه قیمت</div>
              <p className="mt-1 text-muted">{quote.data.label}</p>
              {quote.data.amount != null ? (
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <span className="font-bold">{new Intl.NumberFormat("fa-IR").format(quote.data.amount)} ریال</span>
                  <Button type="button" variant="secondary" onClick={() => setBudget(String(quote.data?.amount ?? ""))}>
                    استفاده از نرخ دفترچه
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}
        </Card>
      ) : null}

      {step === 2 ? (
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold">{t.request.items}</h2>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setLines([...lines, { name: "", quantity: "1", unitCode: "carton" }])}
            >
              {t.request.addLine}
            </Button>
          </div>
          <div className="grid gap-4">
            {lines.map((line, index) => (
              <div key={index} className="grid gap-3 rounded-3xl border border-border p-4 md:grid-cols-3">
                <Field label={t.request.cargoName}>
                  <Input
                    value={line.name}
                    placeholder="مثلاً ماکارونی کارتن ۲۵تایی"
                    onChange={(e) => setLines(lines.map((l, i) => (i === index ? { ...l, name: e.target.value } : l)))}
                    required
                  />
                </Field>
                <Field label={t.common.quantity}>
                  <Input value={line.quantity} onChange={(e) => setLines(lines.map((l, i) => (i === index ? { ...l, quantity: e.target.value } : l)))} />
                </Field>
                <Field label={t.common.unit}>
                  <NativeSelect value={line.unitCode} onChange={(e) => setLines(lines.map((l, i) => (i === index ? { ...l, unitCode: e.target.value } : l)))}>
                    <option value="carton">کارتن</option>
                    <option value="box">جعبه</option>
                    <option value="kg">کیلوگرم</option>
                    <option value="ton">تن</option>
                    <option value="pallet">پالت</option>
                  </NativeSelect>
                </Field>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {step === 3 ? (
        <Card className="grid gap-5">
          <div>
            <h2 className="font-bold">{t.landing.vehicle}</h2>
            <p className="mt-1 text-sm text-muted">{t.request.vehicleHint}</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {VEHICLES.map((item) => (
                <ChoiceTile
                  key={item.key}
                  title={t.vehicle[item.key]}
                  body={item.body}
                  icon={item.icon}
                  active={vehicle === item.key}
                  onClick={() => setVehicle(item.key)}
                />
              ))}
            </div>
          </div>
          <div>
            <h2 className="font-bold">{t.request.urgency}</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {[
                { value: "normal", label: t.request.normal },
                { value: "urgent", label: t.request.urgent },
                { value: "scheduled", label: t.request.scheduled },
              ].map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setUrgency(item.value)}
                  className={`rounded-full px-4 py-2 text-sm ${urgency === item.value ? "bg-ink text-white" : "bg-background"}`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <h2 className="font-bold">نوع اعلام بار</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <ChoiceTile
                title="همگانی"
                body="به رانندگان تأییدشده به‌صورت عمومی اعلام می‌شود"
                icon={<Users className="h-6 w-6" />}
                active={dispatchMode === "NORMAL"}
                onClick={() => setDispatchMode("NORMAL")}
              />
              <ChoiceTile
                title="VIP"
                body="فقط به یک راننده مشخص اعلام می‌شود"
                icon={<Crown className="h-6 w-6" />}
                active={dispatchMode === "VIP"}
                onClick={() => setDispatchMode("VIP")}
              />
            </div>
            {dispatchMode === "VIP" ? (
              <div className="mt-3">
                <Field label="راننده VIP" hint="مدیریت قبل از اعلام، انتخاب شما را بررسی می‌کند.">
                  <NativeSelect value={vipDriverId} onChange={(e) => setVipDriverId(e.target.value)} required>
                    <option value="">{directory.isLoading ? t.common.loading : "انتخاب راننده"}</option>
                    {(directory.data ?? []).map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} · امتیاز {d.ratingAvg.toLocaleString("fa-IR")} · {d.completedJobs.toLocaleString("fa-IR")} بار
                        {d.vehicleType ? ` · ${t.vehicle[d.vehicleType as VehicleKey] ?? d.vehicleType}` : ""}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
              </div>
            ) : null}
          </div>
          <Field label="نوع بار">
            <NativeSelect value={loadType} onChange={(e) => setLoadType(e.target.value as "FULL" | "SHARED")}>
              <option value="FULL">دربستی (کل ماشین برای این بار)</option>
              <option value="SHARED">روباری (می‌تواند با بار هم‌مقصد حمل شود)</option>
            </NativeSelect>
          </Field>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="flex items-center justify-between rounded-2xl border border-border p-4 text-sm">
              بارنامه
              <input type="checkbox" checked={waybill} onChange={(e) => setWaybill(e.target.checked)} />
            </label>
            <label className="flex items-center justify-between rounded-2xl border border-border p-4 text-sm">
              بیمه‌نامه
              <input type="checkbox" checked={insurance} onChange={(e) => setInsurance(e.target.checked)} />
            </label>
            <label className="flex items-center justify-between rounded-2xl border border-border p-4 text-sm">
              {t.request.helper}
              <input type="checkbox" checked={helper} onChange={(e) => setHelper(e.target.checked)} />
            </label>
            <label className="flex items-center justify-between rounded-2xl border border-border p-4 text-sm">
              {t.request.covered}
              <input type="checkbox" checked={covered} onChange={(e) => setCovered(e.target.checked)} />
            </label>
          </div>
          <Field label={t.common.notes}>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </Card>
      ) : null}
    </form>
  );
}

export default function NewRequestPage() {
  return (
    <Suspense>
      <NewRequestForm />
    </Suspense>
  );
}

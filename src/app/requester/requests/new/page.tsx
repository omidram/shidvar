"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChoiceTile, PageHeader } from "@/components/domain/chrome";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, NativeSelect, Textarea } from "@/components/ui/input";
import { ShamsiDateInput } from "@/components/ui/shamsi-date-input";
import { api } from "@/lib/api";
import { useI18n } from "@/i18n/provider";
import { ColdIcon, HeavyTruckIcon, TankerIcon, TruckIcon, VanIcon } from "@/components/visual/icons";

type Product = { id: string; nameEn: string; nameFa: string; categoryId: string; defaultUnit: string };
type Line = { productId: string; name: string; categoryId: string; quantity: string; unitCode: string };
type VehicleKey = "VAN" | "LIGHT_TRUCK" | "TRUCK" | "REFRIGERATED" | "TANKER";
const VEHICLES: Array<{ key: VehicleKey; icon: React.ReactNode; body: string }> = [
  { key: "VAN", icon: <VanIcon className="h-7 w-7" />, body: "تا ۵۰۰ کیلو، شهری" },
  { key: "LIGHT_TRUCK", icon: <TruckIcon className="h-7 w-7" />, body: "وانت سنگین" },
  { key: "TRUCK", icon: <HeavyTruckIcon className="h-7 w-7" />, body: "بین‌شهری" },
  { key: "REFRIGERATED", icon: <ColdIcon className="h-7 w-7" />, body: "زنجیره سرد" },
  { key: "TANKER", icon: <TankerIcon className="h-7 w-7" />, body: "مایعات و فله" },
];
const CITIES = ["تهران", "آمل", "کرج", "اصفهان", "مشهد", "شیراز", "تبریز", "اهواز", "قم", "یزد", "کرمان", "بندرعباس", "ساری", "رشت", "ارومیه", "کرمانشاه", "همدان", "زاهدان"];

function NewRequestForm() {
  const { t } = useI18n();
  const router = useRouter();
  const params = useSearchParams();
  const products = useQuery({ queryKey: ["products"], queryFn: () => api<Product[]>("/catalog/products") });
  const [step, setStep] = useState(1);
  const [vehicle, setVehicle] = useState<VehicleKey>((params.get("vehicle") as VehicleKey) || "TRUCK");
  const [urgency, setUrgency] = useState("normal");
  const [helper, setHelper] = useState(false);
  const [covered, setCovered] = useState(true);
  const [insurance, setInsurance] = useState(false);
  const [originCity, setOriginCity] = useState(params.get("origin") || "تهران");
  const [destinationCity, setDestinationCity] = useState(params.get("destination") || "آمل");
  const [originLine1, setOriginLine1] = useState("");
  const [destinationLine1, setDestinationLine1] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("2026-09-01");
  const [budget, setBudget] = useState("8500000");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([
    { productId: "", name: "ماکارونی کارتن ۲۵تایی", categoryId: "", quantity: "5", unitCode: "carton" },
  ]);
  const [saving, setSaving] = useState(false);
  const qty = lines.reduce((sum, line) => sum + Number(line.quantity || 0), 0);
  const quote = useQuery({
    queryKey: ["price-quote", destinationCity, qty],
    queryFn: () => api<{ matched: boolean; amount: number | null; label: string; zoneName: string | null }>(`/price-books/quote?destinationCity=${encodeURIComponent(destinationCity)}&quantity=${qty}`),
    enabled: Boolean(destinationCity && qty > 0),
  });

  function applyProduct(index: number, productId: string) {
    const product = products.data?.find((p) => p.id === productId);
    const next = [...lines];
    next[index] = {
      ...next[index],
      productId,
      name: product?.nameFa ?? next[index].name,
      categoryId: product?.categoryId ?? "",
      unitCode: product?.defaultUnit ?? next[index].unitCode,
    };
    setLines(next);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const extras = [
        vehicle,
        `فوریت: ${urgency === "urgent" ? t.request.urgent : urgency === "scheduled" ? t.request.scheduled : t.request.normal}`,
        helper ? t.request.helper : null,
        covered ? t.request.covered : null,
        insurance ? t.request.insurance : null,
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
          requestedDeliveryDate: new Date(deliveryDate).toISOString(),
          budgetAmount: budget ? Number(budget) : undefined,
          notes,
          pickupNotes: extras,
          requiredVehicleType: vehicle,
          packagingNotes: covered ? "حمل مسقف" : "حمل روباز",
          qualityNotes: urgency,
          items: lines.map((line) => ({
            productId: line.productId || undefined,
            categoryId: line.categoryId || undefined,
            name: line.name,
            quantity: Number(line.quantity),
            unitCode: line.unitCode,
          })),
        }),
      });
      await api(`/requests/${created.id}/submit`, { method: "POST" });
      toast.success("درخواست برای رانندگان محدوده ارسال شد");
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
        description={t.request.example}
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
              <Button type="submit" disabled={saving}>
                {saving ? t.common.loading : t.common.submit}
              </Button>
            )}
          </div>
        }
      />
      <div className="grid grid-cols-3 gap-2">
        {[t.request.stepRoute, t.request.stepItems, t.request.stepCargo].map((label, i) => (
          <div key={label} className={`rounded-2xl px-3 py-2 text-center text-sm ${step === i + 1 ? "bg-primary text-primary-foreground" : "bg-card border border-border"}`}>
            {label}
          </div>
        ))}
      </div>

      {step === 1 ? (
        <Card className="grid gap-4 md:grid-cols-2">
          <Field label={t.request.originCity}>
            <Input list="origin-cities" value={originCity} onChange={(e) => setOriginCity(e.target.value)} required />
            <datalist id="origin-cities">
              {CITIES.map((city) => (
                <option key={city} value={city} />
              ))}
            </datalist>
          </Field>
          <Field label={t.request.destinationCity}>
            <Input list="dest-cities" value={destinationCity} onChange={(e) => setDestinationCity(e.target.value)} required />
            <datalist id="dest-cities">
              {CITIES.map((city) => (
                <option key={city} value={city} />
              ))}
            </datalist>
          </Field>
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
              onClick={() => setLines([...lines, { productId: "", name: "", categoryId: "", quantity: "1", unitCode: "carton" }])}
            >
              {t.request.addLine}
            </Button>
          </div>
          <div className="grid gap-4">
            {lines.map((line, index) => (
              <div key={index} className="grid gap-3 rounded-3xl border border-border p-4 md:grid-cols-4">
                <Field label="از کاتالوگ">
                  <NativeSelect value={line.productId} onChange={(e) => applyProduct(index, e.target.value)}>
                    <option value="">شرح دستی</option>
                    {(products.data ?? []).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nameFa}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
                <Field label={t.request.cargoName}>
                  <Input value={line.name} onChange={(e) => setLines(lines.map((l, i) => (i === index ? { ...l, name: e.target.value } : l)))} required />
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
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="flex items-center justify-between rounded-2xl border border-border p-4 text-sm">
              {t.request.helper}
              <input type="checkbox" checked={helper} onChange={(e) => setHelper(e.target.checked)} />
            </label>
            <label className="flex items-center justify-between rounded-2xl border border-border p-4 text-sm">
              {t.request.covered}
              <input type="checkbox" checked={covered} onChange={(e) => setCovered(e.target.checked)} />
            </label>
            <label className="flex items-center justify-between rounded-2xl border border-border p-4 text-sm">
              {t.request.insurance}
              <input type="checkbox" checked={insurance} onChange={(e) => setInsurance(e.target.checked)} />
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

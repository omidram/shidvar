export type SignatureRole = "receiver" | "driver" | "issuer" | "company";

export type DocumentSlot = {
  type: string;
  label: string;
  hint: string;
  required: boolean;
  kinds: Array<"driver" | "company" | "vehicle" | "job">;
  signable?: boolean;
  signatureRole?: SignatureRole;
};

export const DOCUMENT_SLOTS: DocumentSlot[] = [
  { type: "DRIVER_PHOTO", label: "عکس پرسنلی راننده", hint: "عکس تمام‌رخ واضح", required: false, kinds: ["driver"] },
  { type: "DRIVER_NATIONAL_ID", label: "کارت ملی", hint: "اسکن روی کارت ملی", required: false, kinds: ["driver"] },
  { type: "DRIVER_LICENSE", label: "گواهینامه رانندگی", hint: "روی گواهینامه پایه یک یا دو", required: false, kinds: ["driver"] },
  { type: "DRIVER_LICENSE_BACK", label: "پشت گواهینامه", hint: "اسکن پشت گواهینامه", required: false, kinds: ["driver"] },
  { type: "DRIVER_HEALTH_CARD", label: "کارت سلامت", hint: "کارت معاینه پزشکی راننده", required: false, kinds: ["driver"] },
  { type: "DRIVER_BACKGROUND", label: "عدم سوءپیشینه", hint: "گواهی معتبر", required: false, kinds: ["driver"] },
  { type: "VEHICLE_PHOTO", label: "عکس خودرو", hint: "عکس کامل ماشین از کنار", required: false, kinds: ["vehicle", "driver"] },
  { type: "VEHICLE_PLATE", label: "اسکن پلاک", hint: "پلاک خوانا از نزدیک", required: false, kinds: ["vehicle", "driver"] },
  { type: "VEHICLE_TITLE", label: "سند خودرو", hint: "برگ سبز یا سند مالکیت", required: false, kinds: ["vehicle", "driver"] },
  { type: "VEHICLE_CARD", label: "کارت ماشین", hint: "کارت شناسایی وسیله نقلیه", required: false, kinds: ["vehicle", "driver"] },
  { type: "VEHICLE_INSURANCE", label: "بیمه‌نامه شخص ثالث", hint: "بیمه معتبر خودرو", required: false, kinds: ["vehicle", "driver"] },
  { type: "VEHICLE_INSPECTION", label: "معاینه فنی", hint: "برگه معاینه فنی معتبر", required: false, kinds: ["vehicle", "driver"] },
  { type: "COMPANY_NATIONAL_ID", label: "شناسه ملی شرکت", hint: "روزنامه یا گواهی شناسه ملی", required: true, kinds: ["company"] },
  { type: "COMPANY_REGISTRATION", label: "آگهی ثبت شرکت", hint: "آخرین روزنامه رسمی", required: true, kinds: ["company"] },
  { type: "COMPANY_TAX", label: "گواهی مالیاتی", hint: "گواهی ارزش افزوده یا پرونده مالیاتی", required: true, kinds: ["company"] },
  { type: "COMPANY_CEO_ID", label: "کارت ملی مدیرعامل", hint: "اسکن کارت ملی صاحب امضا", required: true, kinds: ["company"] },
  { type: "COMPANY_STATUTE", label: "اساسنامه", hint: "اساسنامه شرکت", required: false, kinds: ["company"] },
  {
    type: "COMPANY_SIGNATURE",
    label: "نمونه امضا",
    hint: "امضای الکترونیک صاحب امضا یا اسکن برگه امضای مجاز",
    required: false,
    kinds: ["company"],
    signable: true,
    signatureRole: "company",
  },
  { type: "COMPANY_WAREHOUSE_LEASE", label: "اجاره‌نامه انبار", hint: "سند یا اجاره محل بارگیری", required: false, kinds: ["company"] },
  {
    type: "JOB_POD_RECEIPT",
    label: "رسید تحویل",
    hint: "عکس یا PDF رسید. اگر روی کاغذ امضا شده، همان فایل کافی است.",
    required: true,
    kinds: ["job"],
  },
  {
    type: "JOB_SIGNED_WAYBILL",
    label: "بارنامه",
    hint: "عکس یا PDF بارنامه. امضای دستی روی همین فایل پذیرفته می‌شود.",
    required: true,
    kinds: ["job"],
  },
  {
    type: "JOB_SIGN_DRIVER",
    label: "امضای راننده",
    hint: "اختیاری. فقط وقتی سند جداگانه امضای دستی ندارد.",
    required: false,
    kinds: ["job"],
    signable: true,
    signatureRole: "driver",
  },
  {
    type: "JOB_SIGN_ISSUER",
    label: "امضای صاحب بار",
    hint: "اختیاری. صاحب بار می‌تواند بعد از دیدن مدارک اینجا امضا کند.",
    required: false,
    kinds: ["job"],
    signable: true,
    signatureRole: "issuer",
  },
];

export const JOB_DELIVERY_DOC_TYPES = ["JOB_POD_RECEIPT", "JOB_SIGNED_WAYBILL"] as const;

export function signatureUrlFromDocs(
  items: Array<{ type: string; document?: { url?: string; isImage?: boolean } | null }>,
  role: Exclude<SignatureRole, "company">,
) {
  const type =
    role === "issuer" ? "JOB_SIGN_ISSUER" : role === "driver" ? "JOB_SIGN_DRIVER" : "JOB_SIGNED_WAYBILL";
  const doc = items.find((item) => item.type === type)?.document;
  return doc?.isImage ? doc.url ?? null : null;
}

export function slotsFor(kind: DocumentSlot["kinds"][number], requiredOnly = false) {
  return DOCUMENT_SLOTS.filter((slot) => slot.kinds.includes(kind) && (!requiredOnly || slot.required));
}

export function slotLabel(type: string) {
  return DOCUMENT_SLOTS.find((slot) => slot.type === type)?.label ?? type;
}

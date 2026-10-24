import { slotsFor } from "@/lib/documents";

export type InfoTarget = "company" | "driver";

export type InfoField = {
  key: string;
  label: string;
  targets: InfoTarget[];
  type?: "text" | "email" | "vehicle";
};

export const INFO_FIELDS: InfoField[] = [
  { key: "firstName", label: "نام", targets: ["company", "driver"] },
  { key: "lastName", label: "نام خانوادگی", targets: ["company", "driver"] },
  { key: "email", label: "ایمیل", targets: ["company", "driver"], type: "email" },
  { key: "legalName", label: "نام ثبتی شرکت", targets: ["company"] },
  { key: "tradeName", label: "نام تجاری شرکت", targets: ["company"] },
  { key: "registrationNumber", label: "شماره ثبت شرکت", targets: ["company"] },
  { key: "taxId", label: "شناسه ملی شرکت", targets: ["company"] },
  { key: "companyPhone", label: "تلفن ثابت شرکت", targets: ["company"] },
  { key: "city", label: "شهر", targets: ["company", "driver"] },
  { key: "address", label: "نشانی دفتر یا انبار", targets: ["company"] },
  { key: "licenseNumber", label: "شماره گواهینامه", targets: ["driver"] },
  { key: "licenseType", label: "نوع گواهینامه", targets: ["driver"] },
  { key: "plateNumber", label: "پلاک خودرو", targets: ["driver"] },
  { key: "vehicleType", label: "نوع ناوگان", targets: ["driver"], type: "vehicle" },
];

export const VEHICLE_OPTIONS = [
  { value: "VAN", label: "وانت سبک" },
  { value: "LIGHT_TRUCK", label: "وانت سنگین" },
  { value: "TRUCK", label: "کامیون" },
  { value: "HEAVY_TRUCK", label: "تریلی" },
  { value: "REFRIGERATED", label: "یخچال‌دار" },
  { value: "TANKER", label: "تانکر" },
  { value: "FLATBED", label: "کفی" },
] as const;

export function fieldsFor(target: InfoTarget) {
  return INFO_FIELDS.filter((field) => field.targets.includes(target));
}

export function documentsFor(target: InfoTarget) {
  return target === "driver" ? [...slotsFor("driver")] : slotsFor("company");
}

export function infoFieldLabel(key: string) {
  return INFO_FIELDS.find((field) => field.key === key)?.label ?? key;
}

import { z } from "zod";
import { toFaDigits } from "@/lib/shamsi";

/** Persian wording for every default zod message, so users never see English validation text. */
export const faErrorMap: z.ZodErrorMap = (issue, ctx) => {
  switch (issue.code) {
    case z.ZodIssueCode.invalid_type:
      if (issue.received === "undefined" || issue.received === "null") return { message: "این مورد الزامی است" };
      return { message: "مقدار واردشده معتبر نیست" };
    case z.ZodIssueCode.too_small:
      if (issue.type === "string") {
        return { message: issue.minimum === 1 ? "این مورد الزامی است" : `حداقل ${toFaDigits(String(issue.minimum))} نویسه وارد کنید` };
      }
      if (issue.type === "array") return { message: `حداقل ${toFaDigits(String(issue.minimum))} مورد لازم است` };
      return { message: `مقدار باید حداقل ${toFaDigits(String(issue.minimum))} باشد` };
    case z.ZodIssueCode.too_big:
      if (issue.type === "string") return { message: `حداکثر ${toFaDigits(String(issue.maximum))} نویسه مجاز است` };
      if (issue.type === "array") return { message: `حداکثر ${toFaDigits(String(issue.maximum))} مورد مجاز است` };
      return { message: `مقدار باید حداکثر ${toFaDigits(String(issue.maximum))} باشد` };
    case z.ZodIssueCode.invalid_string:
      if (issue.validation === "email") return { message: "ایمیل معتبر نیست" };
      if (issue.validation === "uuid") return { message: "شناسه معتبر نیست" };
      return { message: "قالب مقدار واردشده معتبر نیست" };
    case z.ZodIssueCode.invalid_enum_value:
      return { message: "گزینهٔ انتخاب‌شده معتبر نیست" };
    case z.ZodIssueCode.invalid_literal:
    case z.ZodIssueCode.invalid_union:
      return { message: "مقدار واردشده معتبر نیست" };
    default:
      return { message: ctx.defaultError === "Required" ? "این مورد الزامی است" : "مقدار واردشده معتبر نیست" };
  }
};

let installed = false;
export function installFaErrorMap() {
  if (installed) return;
  installed = true;
  z.setErrorMap(faErrorMap);
}

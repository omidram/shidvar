import { toTel } from "@/lib/phone";
import { cn } from "@/lib/utils";

export function PhoneLink({ phone, className }: { phone?: string | null; className?: string }) {
  if (!phone) return null;
  const href = toTel(phone);
  if (!href) return <span className={className}>{phone}</span>;
  return (
    <a
      href={href}
      dir="ltr"
      className={cn("relative z-10 font-semibold text-primary underline", className)}
      onClick={(event) => event.stopPropagation()}
    >
      {phone}
    </a>
  );
}

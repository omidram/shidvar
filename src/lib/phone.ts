export function toTel(phone?: string | null) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  let local = digits;
  if (local.startsWith("0098")) local = local.slice(4);
  else if (local.startsWith("98") && local.length >= 12) local = local.slice(2);
  else if (local.startsWith("0")) local = local.slice(1);
  if (local.length < 10) return null;
  return `tel:+98${local}`;
}

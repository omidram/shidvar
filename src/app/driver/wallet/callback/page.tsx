import { redirect } from "next/navigation";
import { actorFromCookies } from "@/server/auth/session";
import { verifyZarinpalTopup } from "@/server/domains/finance/wallet-service";

function first(value: unknown) {
  if (Array.isArray(value)) return String(value[0] ?? "");
  return value == null ? "" : String(value);
}

function isNextRedirect(error: unknown) {
  return Boolean(
    error &&
      typeof error === "object" &&
      "digest" in error &&
      String((error as { digest: unknown }).digest).includes("NEXT_REDIRECT"),
  );
}

export default async function ZarinpalWalletCallbackPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, unknown>>;
}) {
  const query = (await searchParams) ?? {};
  const authority = first(query.Authority) || first(query.authority);
  const status = first(query.Status) || first(query.status);
  try {
    const actor = await actorFromCookies();
    await verifyZarinpalTopup({ authority, status }, actor);
    redirect("/driver/wallet?pay=ok");
  } catch (error) {
    if (isNextRedirect(error)) throw error;
    redirect("/driver/wallet?pay=fail");
  }
}
